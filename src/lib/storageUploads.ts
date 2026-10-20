import { supabase } from "@/integrations/supabase/client";

export interface UploadConfig {
  bucket: string;
  folder?: string;
  filePath?: string;
  allowedTypes?: string[];
  maxSizeMB?: number;
  cacheControl?: string;
  upsert?: boolean;
  isPublic?: boolean;
}

const buildFilePath = (file: File, folder?: string, filePath?: string) => {
  if (filePath) return filePath;
  const ext = file.name.split(".").pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`;
  return folder ? `${folder}/${fileName}` : fileName;
};

const validateFile = (file: File, allowedTypes?: string[], maxSizeMB?: number) => {
  if (allowedTypes?.length && !allowedTypes.includes(file.type)) {
    throw new Error(
      `Invalid file type. Allowed types: ${allowedTypes
        .map((t) => t.split("/")[1]?.toUpperCase() || t)
        .join(", ")}`
    );
  }

  if (maxSizeMB) {
    const maxSize = maxSizeMB * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error(`File size must be less than ${maxSizeMB}MB`);
    }
  }
};

export const uploadFileToBucket = async (file: File, config: UploadConfig) => {
  const {
    bucket,
    folder,
    filePath,
    allowedTypes,
    maxSizeMB,
    cacheControl = "3600",
    upsert = false,
    isPublic = true,
  } = config;

  validateFile(file, allowedTypes, maxSizeMB);

  const path = buildFilePath(file, folder, filePath);
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { cacheControl, upsert });

  if (error) throw error;

  if (!isPublic) {
    return { path: data.path, publicUrl: null as string | null };
  }

  const { data: publicData } = supabase.storage
    .from(bucket)
    .getPublicUrl(data.path);

  return { path: data.path, publicUrl: publicData.publicUrl };
};

export const getSignedUrl = async (bucket: string, path: string, expiresInSeconds = 3600) => {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);

  if (error) throw error;
  return data.signedUrl;
};

export const deleteFileByPath = async (bucket: string, path: string) => {
  const { error } = await supabase.storage
    .from(bucket)
    .remove([path]);
  if (error) throw error;
};

export const deleteFileByUrl = async (bucket: string, fileUrl: string) => {
  const url = new URL(fileUrl);
  const pathParts = url.pathname.split(`/storage/v1/object/public/${bucket}/`);
  if (pathParts.length < 2) {
    throw new Error("Could not extract file path from URL");
  }
  const path = pathParts[1];
  await deleteFileByPath(bucket, path);
};
