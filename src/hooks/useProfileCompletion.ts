import { useMemo } from "react";
import { useProfile } from "./useProfile";

/**
 * Hook to check if a user's profile needs completion
 * Returns whether the profile is incomplete and what percentage is complete
 */
export function useProfileCompletion() {
  const { data: profile, isLoading } = useProfile();

  const { isIncomplete, completionPercentage, missingFields } = useMemo(() => {
    // If profile is loading, return loading state
    if (isLoading) {
      return {
        isIncomplete: false,
        completionPercentage: 0,
        missingFields: [],
      };
    }
    
    // If profile doesn't exist yet (new user), consider it incomplete
    if (!profile) {
      return {
        isIncomplete: true,
        completionPercentage: 0,
        missingFields: ['firstName', 'lastName', 'country', 'businessSector'],
      };
    }

    // Required fields for a complete profile
    const requiredFields = [
      { key: 'firstName', value: profile.firstName },
      { key: 'lastName', value: profile.lastName },
      { key: 'country', value: profile.country },
      { key: 'businessSector', value: profile.businessSector },
    ];

    // Optional but recommended fields
    const recommendedFields = [
      { key: 'businessName', value: profile.businessName },
      { key: 'bio', value: profile.bio },
    ];

    const allFields = [...requiredFields, ...recommendedFields];
    const filledFields = allFields.filter(
      (field) => field.value && field.value.trim() !== ""
    );

    const missingRequired = requiredFields.filter(
      (field) => !field.value || field.value.trim() === ""
    );

    const completionPercentage = Math.round(
      (filledFields.length / allFields.length) * 100
    );

    return {
      isIncomplete: missingRequired.length > 0,
      completionPercentage,
      missingFields: missingRequired.map((f) => f.key),
    };
  }, [profile, isLoading]);

  return {
    isIncomplete,
    completionPercentage,
    missingFields,
    isLoading,
  };
}

