import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import i18n from "@/lib/i18n";

const BUCKET = "opportunity-files";
const MAX_SIZE_MB = 10;
const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

export interface OpportunityDocument {
  id: string;
  opportunityId: number;
  filePath: string;
  fileName: string;
  fileSize: number | null;
  fileType: string | null;
  createdAt: string;
}

function toDocument(row: {
  id: string;
  opportunity_id: number;
  file_path: string;
  file_name: string;
  file_size: number | null;
  file_type: string | null;
  created_at: string;
}): OpportunityDocument {
  return {
    id: row.id,
    opportunityId: row.opportunity_id,
    filePath: row.file_path,
    fileName: row.file_name,
    fileSize: row.file_size,
    fileType: row.file_type,
    createdAt: row.created_at,
  };
}

export function useOpportunityFiles(opportunityId: number | undefined) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);

  const queryKey = ["opportunity-documents", opportunityId];

  const { data: documents = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!opportunityId) return [];
      const { data, error } = await supabase
        .from("opportunity_documents")
        .select("id, opportunity_id, file_path, file_name, file_size, file_type, created_at")
        .eq("opportunity_id", opportunityId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []).map(toDocument);
    },
    enabled: !!opportunityId,
  });

  /** Upload for the current opportunity (from hook param). */
  const upload = useCallback(
    async (file: File): Promise<OpportunityDocument | null> => uploadWithId(opportunityId!, file),
    [opportunityId]
  );

  /** Upload to a specific opportunity (e.g. right after creating it). */
  const uploadWithId = useCallback(
    async (oppId: number, file: File): Promise<OpportunityDocument | null> => {
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        toast({
          title: i18n.t("toasts.opportunityFiles.fileTooLarge", { ns: "common" }),
          description: i18n.t("toasts.opportunityFiles.fileTooLargeDesc", { ns: "common", maxSizeMB: MAX_SIZE_MB }),
          variant: "destructive",
        });
        return null;
      }
      if (ALLOWED_TYPES.length && !ALLOWED_TYPES.includes(file.type)) {
        toast({
          title: i18n.t("toasts.opportunityFiles.fileTypeNotAllowed", { ns: "common" }),
          description: i18n.t("toasts.opportunityFiles.fileTypeNotAllowedDesc", { ns: "common" }),
          variant: "destructive",
        });
        return null;
      }

      setIsUploading(true);
      const sanitized = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const filePath = `opportunity_${oppId}/${Date.now()}_${sanitized}`;

      try {
        const { error: uploadError } = await supabase.storage.from(BUCKET).upload(filePath, file, { upsert: false });
        if (uploadError) throw uploadError;

        const { data: row, error: insertError } = await supabase
          .from("opportunity_documents")
          .insert({
            opportunity_id: oppId,
            file_path: filePath,
            file_name: file.name,
            file_size: file.size,
            file_type: file.type || null,
          })
          .select("id, opportunity_id, file_path, file_name, file_size, file_type, created_at")
          .single();
        if (insertError) throw insertError;

        if (oppId === opportunityId) {
          queryClient.setQueryData(queryKey, (old: OpportunityDocument[] = []) => [...old, toDocument(row)]);
        }
        toast({ title: i18n.t("toasts.opportunityFiles.fileAdded", { ns: "common" }), description: file.name });
        return toDocument(row);
      } catch (e) {
        console.error(e);
        toast({
          title: i18n.t("toasts.opportunityFiles.uploadFailed", { ns: "common" }),
          description: e instanceof Error ? e.message : i18n.t("toasts.opportunityFiles.uploadFailedDesc", { ns: "common" }),
          variant: "destructive",
        });
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [opportunityId, queryClient, queryKey, toast]
  );

  const remove = useCallback(
    async (doc: OpportunityDocument): Promise<boolean> => {
      try {
        await supabase.storage.from(BUCKET).remove([doc.filePath]);
        const { error } = await supabase.from("opportunity_documents").delete().eq("id", doc.id);
        if (error) throw error;
        queryClient.setQueryData(queryKey, (old: OpportunityDocument[] = []) => old.filter((d) => d.id !== doc.id));
        toast({ title: i18n.t("toasts.opportunityFiles.fileRemoved", { ns: "common" }), description: doc.fileName });
        return true;
      } catch (e) {
        console.error(e);
        toast({
          title: i18n.t("toasts.opportunityFiles.removeFailed", { ns: "common" }),
          description: e instanceof Error ? e.message : i18n.t("toasts.opportunityFiles.removeFailedDesc", { ns: "common" }),
          variant: "destructive",
        });
        return false;
      }
    },
    [queryClient, queryKey, toast]
  );

  const getSignedUrl = useCallback(async (filePath: string, expiresIn = 3600): Promise<string | null> => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(filePath, expiresIn);
    if (error) return null;
    return data.signedUrl;
  }, []);

  return { documents, isLoading, isUploading, upload, uploadWithId, remove, getSignedUrl, refetch: () => queryClient.invalidateQueries({ queryKey }) };
}
