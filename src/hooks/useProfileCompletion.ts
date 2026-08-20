import { useMemo } from "react";
import { useProfile } from "./useProfile";
import { useKycVerification } from "./useKycVerification";

/**
 * Hook to check if a user's profile needs completion.
 * Returns whether the profile is incomplete and what percentage is complete.
 * Includes KYC verification status as one of the completion items.
 */
export function useProfileCompletion() {
  const { data: profile, isLoading: isLoadingProfile } = useProfile();
  const { data: kyc, isLoading: isLoadingKyc } = useKycVerification();

  const isLoading = isLoadingProfile || isLoadingKyc;

  const { isIncomplete, completionPercentage, missingFields } = useMemo(() => {
    if (isLoading) {
      return { isIncomplete: false, completionPercentage: 0, missingFields: [] };
    }

    if (!profile) {
      return {
        isIncomplete: true,
        completionPercentage: 0,
        missingFields: ["firstName", "lastName", "country", "businesssector"],
      };
    }

    const items = [
      { key: "firstName",     value: profile.firstName,     required: true },
      { key: "lastName",      value: profile.lastName,      required: true },
      { key: "country",       value: profile.country,       required: true },
      { key: "businesssector",value: profile.businesssector,required: true },
      { key: "phoneNumber",   value: profile.phoneNumber,   required: false },
      { key: "businessName",  value: profile.businessName,  required: false },
      { key: "bio",           value: profile.bio,           required: false },
      { key: "kyc",           value: kyc?.status === "verified" ? "verified" : null, required: false },
    ];

    const filledCount = items.filter((i) => i.value && String(i.value).trim() !== "").length;
    const missingRequired = items.filter((i) => i.required && (!i.value || String(i.value).trim() === ""));

    return {
      isIncomplete: missingRequired.length > 0,
      completionPercentage: Math.round((filledCount / items.length) * 100),
      missingFields: missingRequired.map((i) => i.key),
    };
  }, [profile, kyc, isLoading]);

  return { isIncomplete, completionPercentage, missingFields, isLoading };
}
