import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type KycIdType = "passport" | "national_id" | "drivers_license" | "business_registration";
export type KycStatus = "pending" | "verified" | "rejected" | "expired";

export interface KycVerification {
  id: string;
  user_id: string;
  id_type: KycIdType;
  id_number: string;
  full_name_on_id: string;
  id_document_url: string | null;
  selfie_url: string | null;
  status: KycStatus;
  rejection_reason: string | null;
  verified_by: string | null;
  verified_at: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

const ID_NUMBER_PATTERNS: Record<KycIdType, { regex: RegExp; hint: string }> = {
  passport: { regex: /^[A-Z0-9]{6,9}$/i, hint: "6-9 alphanumeric characters" },
  national_id: { regex: /^[A-Z0-9]{5,20}$/i, hint: "5-20 alphanumeric characters" },
  drivers_license: { regex: /^[A-Z0-9]{5,20}$/i, hint: "5-20 alphanumeric characters" },
  business_registration: { regex: /^[A-Z0-9\-/]{5,30}$/i, hint: "5-30 alphanumeric characters" },
};

export const validateIdNumber = (idType: KycIdType, idNumber: string): string | null => {
  const pattern = ID_NUMBER_PATTERNS[idType];
  if (!pattern) return null;
  if (!pattern.regex.test(idNumber)) {
    return `Invalid format. Expected: ${pattern.hint}`;
  }
  return null;
};

export const getIdNumberHint = (idType: KycIdType): string => {
  return ID_NUMBER_PATTERNS[idType]?.hint || "";
};

export const useKycVerification = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["kyc-verification", user?.id],
    queryFn: async (): Promise<KycVerification | null> => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("kyc_verifications")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data as KycVerification | null;
    },
    enabled: !!user?.id,
  });

  return query;
};

export const useSubmitKyc = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id_type: KycIdType;
      id_number: string;
      full_name_on_id: string;
      id_document_url: string | null;
      selfie_url: string | null;
    }) => {
      if (!user?.id) throw new Error("Not authenticated");

      // Check if record exists
      const { data: existing } = await supabase
        .from("kyc_verifications")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from("kyc_verifications")
          .update({
            ...data,
            status: "pending" as const,
            rejection_reason: null,
          })
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from("kyc_verifications")
          .insert({
            user_id: user.id,
            ...data,
            status: "pending" as const,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kyc-verification"] });
      toast.success("Identity verification submitted for review");
    },
    onError: (error: Error) => {
      toast.error(`Failed to submit: ${error.message}`);
    },
  });
};

export const useAdminUpdateKyc = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      userId: string;
      status: "verified" | "rejected";
      admin_notes?: string;
      rejection_reason?: string;
      verified_by: string;
    }) => {
      const updateData: Record<string, unknown> = {
        status: data.status,
        admin_notes: data.admin_notes || null,
      };

      if (data.status === "verified") {
        updateData.verified_by = data.verified_by;
        updateData.verified_at = new Date().toISOString();
        updateData.rejection_reason = null;
      } else if (data.status === "rejected") {
        updateData.rejection_reason = data.rejection_reason || null;
        updateData.verified_by = null;
        updateData.verified_at = null;
      }

      const { error } = await supabase
        .from("kyc_verifications")
        .update(updateData)
        .eq("user_id", data.userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kyc-verification"] });
      queryClient.invalidateQueries({ queryKey: ["admin-kyc"] });
      toast.success("KYC status updated");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update KYC: ${error.message}`);
    },
  });
};

export const useAdminKycForUser = (userId: string | undefined) => {
  return useQuery({
    queryKey: ["admin-kyc", userId],
    queryFn: async (): Promise<KycVerification | null> => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("kyc_verifications")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;
      return data as KycVerification | null;
    },
    enabled: !!userId,
  });
};

export const useKycFileUpload = () => {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);

  const upload = async (file: File, type: "id" | "selfie"): Promise<string | null> => {
    if (!user?.id) return null;

    const allowedTypes = ["image/jpeg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Only JPG and PNG images are allowed");
      return null;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File must be less than 5MB");
      return null;
    }

    setIsUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const fileName = `${user.id}/${type}-${Date.now()}.${ext}`;

      const { data, error } = await supabase.storage
        .from("kyc-documents")
        .upload(fileName, file, { cacheControl: "3600", upsert: true });

      if (error) throw error;

      // For private buckets, we store the path and use signed URLs
      return data.path;
    } catch (error: any) {
      toast.error(`Upload failed: ${error.message}`);
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const getSignedUrl = async (path: string): Promise<string | null> => {
    const { data, error } = await supabase.storage
      .from("kyc-documents")
      .createSignedUrl(path, 3600); // 1 hour
    if (error) return null;
    return data.signedUrl;
  };

  return { upload, getSignedUrl, isUploading };
};
