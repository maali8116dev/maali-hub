import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface UploadedDocument {
  id: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  fileType: string;
  createdAt: string;
  applicationId?: string;
}

interface UploadProgress {
  fileName: string;
  progress: number;
  status: "uploading" | "completed" | "error";
}

interface UseDocumentUploadReturn {
  uploadDocument: (file: File, applicationId?: string) => Promise<UploadedDocument | null>;
  uploadDocuments: (files: File[], applicationId?: string) => Promise<UploadedDocument[]>;
  deleteDocument: (document: UploadedDocument) => Promise<boolean>;
  fetchUserDocuments: () => Promise<UploadedDocument[]>;
  fetchApplicationDocuments: (applicationId: string) => Promise<UploadedDocument[]>;
  isUploading: boolean;
  uploadProgress: UploadProgress[];
  documents: UploadedDocument[];
  isLoading: boolean;
}

const BUCKET_NAME = "application-docs";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

export function useDocumentUpload(): UseDocumentUploadReturn {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const validateFile = useCallback((file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return `File "${file.name}" is too large. Maximum size is 10MB.`;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return `File "${file.name}" has an invalid type. Allowed types: PDF, DOC, DOCX, TXT.`;
    }
    return null;
  }, []);

  const uploadDocument = useCallback(async (
    file: File,
    applicationId?: string
  ): Promise<UploadedDocument | null> => {
    // Validate file
    const validationError = validateFile(file);
    if (validationError) {
      toast({
        title: "Upload Error",
        description: validationError,
        variant: "destructive",
      });
      return null;
    }

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in to upload documents.",
        variant: "destructive",
      });
      return null;
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
      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, file);

      if (uploadError) {
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

      // Save metadata to database
      const { data: docData, error: dbError } = await supabase
        .from("application_documents")
        .insert({
          user_id: user.id,
          application_id: applicationId || null,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          file_type: file.type,
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
      };

      // Add to local state
      setDocuments((prev) => [...prev, uploadedDoc]);

      return uploadedDoc;
    } catch (error) {
      console.error("Upload error:", error);
      setUploadProgress((prev) =>
        prev.map((p) =>
          p.fileName === file.name ? { ...p, status: "error" } : p
        )
      );
      toast({
        title: "Upload Failed",
        description: `Failed to upload "${file.name}". Please try again.`,
        variant: "destructive",
      });
      return null;
    }
  }, [toast, validateFile]);

  const uploadDocuments = useCallback(async (
    files: File[],
    applicationId?: string
  ): Promise<UploadedDocument[]> => {
    setIsUploading(true);
    const results: UploadedDocument[] = [];

    for (const file of files) {
      const result = await uploadDocument(file, applicationId);
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
        title: "Upload Complete",
        description: `${results.length} file(s) uploaded successfully.`,
      });
    }

    return results;
  }, [uploadDocument, toast]);

  const deleteDocument = useCallback(async (
    document: UploadedDocument
  ): Promise<boolean> => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([document.filePath]);

      if (storageError) {
        throw storageError;
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from("application_documents")
        .delete()
        .eq("id", document.id);

      if (dbError) {
        throw dbError;
      }

      // Remove from local state
      setDocuments((prev) => prev.filter((d) => d.id !== document.id));

      toast({
        title: "Document Deleted",
        description: `"${document.fileName}" has been deleted.`,
      });

      return true;
    } catch (error) {
      console.error("Delete error:", error);
      toast({
        title: "Delete Failed",
        description: `Failed to delete "${document.fileName}". Please try again.`,
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
        .select("*")
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
      }));

      setDocuments(docs);
      return docs;
    } catch (error) {
      console.error("Fetch documents error:", error);
      toast({
        title: "Error",
        description: "Failed to load documents. Please try again.",
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
        .select("*")
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

  return {
    uploadDocument,
    uploadDocuments,
    deleteDocument,
    fetchUserDocuments,
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
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(filePath, 3600); // 1 hour expiry

    if (error) {
      throw error;
    }

    return data.signedUrl;
  } catch (error) {
    console.error("Error getting download URL:", error);
    return null;
  }
}
