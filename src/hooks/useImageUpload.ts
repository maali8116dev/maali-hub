import { useState } from "react";
import { toast } from "sonner";
import { deleteFileByUrl, uploadFileToBucket } from "@/lib/storageUploads";

interface UploadOptions {
  bucket: string;
  folder?: string;
  maxSizeMB?: number;
  allowedTypes?: string[];
}

export const useImageUpload = (options: UploadOptions) => {
  const { 
    bucket, 
    folder = "", 
    maxSizeMB = 5,
    allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"]
  } = options;
  
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadImage = async (file: File): Promise<string | null> => {
    setIsUploading(true);
    setUploadProgress(0);

    try {
      setUploadProgress(30);

      const { publicUrl } = await uploadFileToBucket(file, {
        bucket,
        folder,
        maxSizeMB,
        allowedTypes,
        cacheControl: "3600",
        upsert: false,
        isPublic: true,
      });

      setUploadProgress(80);
      setUploadProgress(100);
      toast.success("Image loaded successfully");
      
      return publicUrl;
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to load image,Please try again");
      return null;
    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadProgress(0), 500);
    }
  };

  const deleteImage = async (imageUrl: string): Promise<boolean> => {
    try {
      await deleteFileByUrl(bucket, imageUrl);
      toast.success("Image deleted successfully");
      return true;
    } catch (error) {
      console.error("Delete error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete image");
      return false;
    }
  };

  return {
    uploadImage,
    deleteImage,
    isUploading,
    uploadProgress,
  };
};








