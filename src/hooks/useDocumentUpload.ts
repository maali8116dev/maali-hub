import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import i18n from "@/lib/i18n";
import {
  MAX_LIBRARY_DOCUMENTS,
  REPLACEABLE_SLOT_TYPES,
  validateSlotFile,
  type NamedSlotType,
} from "@/lib/documentLibrary";

export type DocumentType = "cv" | "cover_letter" | "id" | null;

export interface UploadedDocument {
  id: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  fileType: string;
  createdAt: string;
  applicationId?: string;
  isLibraryDocument?: boolean;
  opportunityId?: number;
  documentType?: DocumentType;
}

interface UploadProgress {
  fileName: string;
  progress: number;
  status: "uploading" | "completed" | "error";
}

interface UseDocumentUploadReturn {
  uploadDocument: (file: File, applicationId?: string, opportunityId?: number, isLibrary?: boolean, documentType?: DocumentType) => Promise<UploadedDocument | null>;
  uploadDocuments: (files: File[], applicationId?: string, opportunityId?: number, isLibrary?: boolean) => Promise<UploadedDocument[]>;
  uploadToLibrary: (file: File, documentType?: DocumentType) => Promise<UploadedDocument | null>;
  linkLibraryDocumentToApplication: (documentId: string, applicationId: string, opportunityId?: number) => Promise<UploadedDocument | null>;
  deleteDocument: (document: UploadedDocument) => Promise<boolean>;
  fetchUserDocuments: () => Promise<UploadedDocument[]>;
  fetchLibraryDocuments: () => Promise<UploadedDocument[]>;
  fetchApplicationDocuments: (applicationId: string) => Promise<UploadedDocument[]>;
  isUploading: boolean;
  uploadProgress: UploadProgress[];
  documents: UploadedDocument[];
  isLoading: boolean;
}

const BUCKET_NAME = "application-docs";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  // Excel files
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  // PowerPoint files
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  // Images
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

export function useDocumentUpload(): UseDocumentUploadReturn {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const resolveOpportunityIdForDocument = useCallback(async (
    userId: string,
    explicitOpportunityId?: number
  ): Promise<number> => {
    if (typeof explicitOpportunityId === "number" && Number.isFinite(explicitOpportunityId)) {
      return explicitOpportunityId;
    }

    // Prefer a user's most recent application opportunity
    const { data: recentApplication } = await supabase
      .from("applications")
      .select("opportunity_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (typeof recentApplication?.opportunity_id === "number") {
      return recentApplication.opportunity_id;
    }

    // Fallback: any available opportunity
    const { data: anyOpportunity } = await supabase
      .from("opportunities")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (typeof anyOpportunity?.id === "number") {
      return anyOpportunity.id;
    }

    throw new Error(i18n.t("toasts.documents.noOpportunity", { ns: "common" }));
  }, []);

  const validateFile = useCallback((file: File): "tooLarge" | "invalidType" | null => {
    if (file.size > MAX_FILE_SIZE) {
      return "tooLarge";
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return "invalidType";
    }
    return null;
  }, []);

  const uploadDocument = useCallback(async (
    file: File,
    applicationId?: string,
    opportunityId?: number,
    isLibrary: boolean = false,
    documentType: DocumentType = null
  ): Promise<UploadedDocument | null> => {
    // Validate file
    const validationError = validateFile(file);
    if (validationError) {
      toast({
        title: i18n.t("toasts.documents.uploadError", { ns: "common" }),
        description: i18n.t(
          validationError === "tooLarge" ? "toasts.documents.fileTooLarge" : "toasts.documents.invalidFileType",
          { ns: "common", fileName: file.name },
        ),
        variant: "destructive",
      });
      return null;
    }

    if (
      isLibrary &&
      documentType &&
      REPLACEABLE_SLOT_TYPES.includes(documentType as NamedSlotType)
    ) {
      if (!validateSlotFile(file)) {
        toast({
          title: i18n.t("toasts.documents.uploadError", { ns: "common" }),
          description: i18n.t("toasts.documents.slotInvalidType", { ns: "common", fileName: file.name }),
          variant: "destructive",
        });
        return null;
      }
    }

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: i18n.t("toasts.documents.authError", { ns: "common" }),
        description: i18n.t("toasts.documents.authErrorDesc", { ns: "common" }),
        variant: "destructive",
      });
      return null;
    }

    const { data: canApply, error: membershipError } = await supabase.rpc(
      "user_can_apply_to_opportunities",
      { p_user_id: user.id },
    );
    if (membershipError) {
      console.error("Membership check failed:", membershipError);
    } else if (canApply === false) {
      toast({
        title: i18n.t("toasts.documents.membershipRequired", { ns: "common" }),
        description: i18n.t("toasts.documents.membershipUploadDesc", { ns: "common" }),
        variant: "destructive",
      });
      return null;
    }

    if (isLibrary) {
      const { data: libraryRows, count, error: countError } = await supabase
        .from("application_documents")
        .select("id, file_path, document_type")
        .eq("user_id", user.id)
        .eq("is_library_document", true)
        .is("application_id", null);

      if (countError) {
        console.error("Library count failed:", countError);
      }

      const rows = libraryRows ?? [];
      const isReplaceableSlot =
        documentType &&
        REPLACEABLE_SLOT_TYPES.includes(documentType as NamedSlotType);
      const existingSlotRows = isReplaceableSlot
        ? rows.filter((r) => r.document_type === documentType)
        : [];

      const libraryCount = count ?? rows.length;
      if (!isReplaceableSlot && libraryCount >= MAX_LIBRARY_DOCUMENTS) {
        toast({
          title: i18n.t("toasts.documents.limitReached", { ns: "common" }),
          description: i18n.t("toasts.documents.limitReachedDesc", { ns: "common", max: MAX_LIBRARY_DOCUMENTS }),
          variant: "destructive",
        });
        return null;
      }

      for (const row of existingSlotRows) {
        await supabase.from("application_documents").delete().eq("id", row.id);
        const { count: pathRefs } = await supabase
          .from("application_documents")
          .select("id", { count: "exact", head: true })
          .eq("file_path", row.file_path);
        if (!pathRefs) {
          await supabase.storage.from(BUCKET_NAME).remove([row.file_path]);
        }
      }
    }

    // Generate unique file path: user_id/timestamp_filename
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filePath = `${user.id}/${timestamp}_${sanitizedFileName}`;

    try {
      // Update progress
      setUploadProgress((prev) => [
        ...prev.filter((p) => p.fileName !== file.name),
        { fileName: file.name, progress: 0, status: "uploading" },
      ]);

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error("Storage upload error:", uploadError);
        // Provide more specific error message
        if (uploadError.message.includes("new row violates row-level security")) {
          throw new Error("Permission denied. Please check your account permissions.");
        } else if (uploadError.message.includes("Bucket not found")) {
          throw new Error("Storage bucket not configured. Please contact support.");
        } else if (uploadError.message.includes("duplicate")) {
          throw new Error("A file with this name already exists. Please rename the file.");
        }
        throw uploadError;
      }

      // Update progress to completed
      setUploadProgress((prev) =>
        prev.map((p) =>
          p.fileName === file.name
            ? { ...p, progress: 100, status: "completed" }
            : p
        )
      );

      const resolvedOpportunityId = await resolveOpportunityIdForDocument(user.id, opportunityId);

      // Save metadata to database
      // Library documents should have application_id = null
      const { data: docData, error: dbError } = await supabase
        .from("application_documents")
        .insert({
          user_id: user.id,
          application_id: isLibrary ? null : (applicationId || null),
          opportunity_id: resolvedOpportunityId,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          file_type: file.type,
          is_library_document: isLibrary,
          document_type: documentType || null,
        })
        .select()
        .single();

      if (dbError) {
        // Rollback: delete the uploaded file
        await supabase.storage.from(BUCKET_NAME).remove([filePath]);
        throw dbError;
      }

      const uploadedDoc: UploadedDocument = {
        id: docData.id,
        fileName: docData.file_name,
        filePath: docData.file_path,
        fileSize: docData.file_size || 0,
        fileType: docData.file_type || "",
        createdAt: docData.created_at,
        applicationId: docData.application_id || undefined,
        isLibraryDocument: docData.is_library_document || false,
        opportunityId: docData.opportunity_id || undefined,
        documentType: (docData.document_type as DocumentType) ?? null,
      };

      // Add to local state
      setDocuments((prev) => [...prev, uploadedDoc]);

      return uploadedDoc;
    } catch (error: any) {
      console.error("Upload error:", error);
      setUploadProgress((prev) =>
        prev.map((p) =>
          p.fileName === file.name ? { ...p, status: "error" } : p
        )
      );
      
      // Show more specific error message
      const errorMessage = error?.message || error?.error_description || i18n.t("toasts.documents.uploadFailedDesc", { ns: "common", fileName: file.name });
      
      toast({
        title: i18n.t("toasts.documents.uploadFailed", { ns: "common" }),
        description: errorMessage,
        variant: "destructive",
      });
      return null;
    }
  }, [toast, validateFile, resolveOpportunityIdForDocument]);

  const uploadDocuments = useCallback(async (
    files: File[],
    applicationId?: string,
    opportunityId?: number,
    isLibrary: boolean = false
  ): Promise<UploadedDocument[]> => {
    setIsUploading(true);
    const results: UploadedDocument[] = [];

    for (const file of files) {
      const result = await uploadDocument(file, applicationId, opportunityId, isLibrary);
      if (result) {
        results.push(result);
      }
    }

    setIsUploading(false);

    // Clear progress after a delay
    setTimeout(() => {
      setUploadProgress([]);
    }, 2000);

    if (results.length > 0) {
      toast({
        title: i18n.t("toasts.documents.uploadComplete", { ns: "common" }),
        description: i18n.t("toasts.documents.uploadCompleteDesc", { ns: "common", count: results.length }),
      });
    }

    return results;
  }, [uploadDocument, toast]);

  const deleteDocument = useCallback(async (
    document: UploadedDocument
  ): Promise<boolean> => {
    try {
      // Delete the database record first
      const { error: dbError } = await supabase
        .from("application_documents")
        .delete()
        .eq("id", document.id);

      if (dbError) {
        throw dbError;
      }

      // Only delete from storage if no other document records reference the same file
      const { count, error: countError } = await supabase
        .from("application_documents")
        .select("id", { count: "exact", head: true })
        .eq("file_path", document.filePath);

      if (countError) {
        console.warn("Could not check for shared file references:", countError);
      }

      // If no other records reference this file, safe to delete from storage
      if (!count || count === 0) {
        const { error: storageError } = await supabase.storage
          .from(BUCKET_NAME)
          .remove([document.filePath]);

        if (storageError) {
          console.warn("Storage cleanup failed (document record already removed):", storageError);
        }
      }

      // Remove from local state
      setDocuments((prev) => prev.filter((d) => d.id !== document.id));

      toast({
        title: i18n.t("toasts.documents.documentDeleted", { ns: "common" }),
        description: i18n.t("toasts.documents.documentDeletedDesc", { ns: "common", fileName: document.fileName }),
      });

      return true;
    } catch (error) {
      console.error("Delete error:", error);
      toast({
        title: i18n.t("toasts.documents.deleteFailed", { ns: "common" }),
        description: i18n.t("toasts.documents.deleteFailedDesc", { ns: "common", fileName: document.fileName }),
        variant: "destructive",
      });
      return false;
    }
  }, [toast]);

  const fetchUserDocuments = useCallback(async (): Promise<UploadedDocument[]> => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return [];
      }

      const { data, error } = await supabase
        .from("application_documents")
        .select("id, user_id, application_id, opportunity_id, file_name, file_path, file_size, file_type, created_at, is_library_document, document_type")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      const docs: UploadedDocument[] = (data || []).map((doc) => ({
        id: doc.id,
        fileName: doc.file_name,
        filePath: doc.file_path,
        fileSize: doc.file_size || 0,
        fileType: doc.file_type || "",
        createdAt: doc.created_at,
        applicationId: doc.application_id || undefined,
        isLibraryDocument: doc.is_library_document || false,
        opportunityId: doc.opportunity_id || undefined,
        documentType: ((doc as any).document_type as DocumentType) ?? null,
      }));

      setDocuments(docs);
      return docs;
    } catch (error) {
      console.error("Fetch documents error:", error);
      toast({
        title: i18n.t("toasts.error", { ns: "common" }),
        description: i18n.t("toasts.documents.loadFailed", { ns: "common" }),
        variant: "destructive",
      });
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const fetchApplicationDocuments = useCallback(async (
    applicationId: string
  ): Promise<UploadedDocument[]> => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("application_documents")
        .select("id, user_id, application_id, opportunity_id, file_name, file_path, file_size, file_type, created_at, is_library_document, document_type")
        .eq("application_id", applicationId)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      const docs: UploadedDocument[] = (data || []).map((doc) => ({
        id: doc.id,
        fileName: doc.file_name,
        filePath: doc.file_path,
        fileSize: doc.file_size || 0,
        fileType: doc.file_type || "",
        createdAt: doc.created_at,
        applicationId: doc.application_id || undefined,
        isLibraryDocument: doc.is_library_document || false,
        opportunityId: doc.opportunity_id || undefined,
        documentType: ((doc as any).document_type as DocumentType) ?? null,
      }));

      setDocuments(docs);
      return docs;
    } catch (error) {
      console.error("Fetch application documents error:", error);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Upload document to library (reusable across applications)
  const uploadToLibrary = useCallback(async (
    file: File,
    documentType: DocumentType = null,
  ): Promise<UploadedDocument | null> => {
    return uploadDocument(file, undefined, undefined, true, documentType);
  }, [uploadDocument]);

  // Link a library document to an application (creates a copy/reference)
  const linkLibraryDocumentToApplication = useCallback(async (
    documentId: string,
    applicationId: string,
    opportunityId?: number
  ): Promise<UploadedDocument | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data: canApply } = await supabase.rpc(
        "user_can_apply_to_opportunities",
        { p_user_id: user.id },
      );
      if (canApply === false) {
        toast({
          title: i18n.t("toasts.documents.membershipRequired", { ns: "common" }),
          description: i18n.t("toasts.documents.membershipAttachDesc", { ns: "common" }),
          variant: "destructive",
        });
        return null;
      }

      // First, get the library document
      const { data: libraryDoc, error: fetchError } = await supabase
        .from("application_documents")
        .select("id, user_id, application_id, opportunity_id, file_name, file_path, file_size, file_type, created_at, is_library_document, document_type")
        .eq("id", documentId)
        .eq("is_library_document", true)
        .is("application_id", null)
        .single();

      if (fetchError || !libraryDoc) {
        throw new Error("Library document not found");
      }

      // Create a new document record linked to the application
      // This references the same file_path but creates a new record for the application
      const { data: docData, error: dbError } = await supabase
        .from("application_documents")
        .insert({
          user_id: libraryDoc.user_id,
          application_id: applicationId,
          opportunity_id: opportunityId || null,
          file_name: libraryDoc.file_name,
          file_path: libraryDoc.file_path, // Same file, different record
          file_size: libraryDoc.file_size,
          file_type: libraryDoc.file_type,
          is_library_document: false, // This is now an application document
        })
        .select()
        .single();

      if (dbError) {
        throw dbError;
      }

      const linkedDoc: UploadedDocument = {
        id: docData.id,
        fileName: docData.file_name,
        filePath: docData.file_path,
        fileSize: docData.file_size || 0,
        fileType: docData.file_type || "",
        createdAt: docData.created_at,
        applicationId: docData.application_id || undefined,
        isLibraryDocument: false,
        opportunityId: docData.opportunity_id || undefined,
      };

      toast({
        title: i18n.t("toasts.documents.documentLinked", { ns: "common" }),
        description: i18n.t("toasts.documents.documentLinkedDesc", { ns: "common", fileName: libraryDoc.file_name }),
      });

      return linkedDoc;
    } catch (error: any) {
      console.error("Link library document error:", error);
      toast({
        title: i18n.t("toasts.documents.linkFailed", { ns: "common" }),
        description: error?.message || i18n.t("toasts.documents.linkFailedDesc", { ns: "common" }),
        variant: "destructive",
      });
      return null;
    }
  }, [toast]);

  // Fetch only library documents (reusable documents)
  const fetchLibraryDocuments = useCallback(async (): Promise<UploadedDocument[]> => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return [];
      }

      const { data, error } = await supabase
        .from("application_documents")
        .select("id, user_id, application_id, opportunity_id, file_name, file_path, file_size, file_type, created_at, is_library_document, document_type")
        .eq("user_id", user.id)
        .eq("is_library_document", true)
        .is("application_id", null)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      const docs: UploadedDocument[] = (data || []).map((doc) => ({
        id: doc.id,
        fileName: doc.file_name,
        filePath: doc.file_path,
        fileSize: doc.file_size || 0,
        fileType: doc.file_type || "",
        createdAt: doc.created_at,
        applicationId: undefined,
        isLibraryDocument: true,
        opportunityId: doc.opportunity_id || undefined,
        documentType: (doc.document_type as DocumentType) ?? null,
      }));

      setDocuments(docs);
      return docs;
    } catch (error) {
      console.error("Fetch library documents error:", error);
      toast({
        title: i18n.t("toasts.error", { ns: "common" }),
        description: i18n.t("toasts.documents.loadLibraryFailed", { ns: "common" }),
        variant: "destructive",
      });
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  return {
    uploadDocument,
    uploadDocuments,
    uploadToLibrary,
    linkLibraryDocumentToApplication,
    deleteDocument,
    fetchUserDocuments,
    fetchLibraryDocuments,
    fetchApplicationDocuments,
    isUploading,
    uploadProgress,
    documents,
    isLoading,
  };
}

/**
 * Get a signed URL for downloading a document
 */
export async function getDocumentDownloadUrl(filePath: string): Promise<string | null> {
  try {
    // Validate file path
    if (!filePath || filePath.trim() === "") {
      console.error("Invalid file path provided:", filePath);
      return null;
    }

    // Remove leading slash if present (Supabase storage paths shouldn't start with /)
    const cleanPath = filePath.startsWith("/") ? filePath.slice(1) : filePath;

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(cleanPath, 3600); // 1 hour expiry

    if (error) {
      console.error("Storage error details:", {
        error,
        filePath: cleanPath,
        bucket: BUCKET_NAME,
        message: error.message,
      });
      
      // Provide more specific error messages
      if (error.message.includes("not found") || error.message.includes("Object not found")) {
        console.error(`File not found in storage: ${cleanPath}`);
        throw new Error(`Document file not found. The file may have been deleted or the path is incorrect.`);
      }
      throw error;
    }

    return data.signedUrl;
  } catch (error) {
    console.error("Error getting download URL:", error);
    return null;
  }
}








