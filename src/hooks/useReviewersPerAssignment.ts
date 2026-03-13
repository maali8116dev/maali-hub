import { useState } from 'react';

// Hook to manage reviewers per assignment setting
export const useReviewersPerAssignment = () => {
  const [numReviewers, setNumReviewers] = useState<number>(3);

  const updateNumReviewers = (value: number) => {
    setNumReviewers(value);
  };

  return { numReviewers, updateNumReviewers };
};









