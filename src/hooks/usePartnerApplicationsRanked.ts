import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PartnerRankedApplication = {
  application_id: string;
  applicant_name: string;
  applicant_email: string;
  organization_name: string | null;
  project_title: string | null;
  submitted_at: string;
  status: string;
  average_score: number | null;
  score_variance: number | null;
  total_reviews: number;
  rank_position: number;
};

export function usePartnerApplicationsRanked(opportunityId?: number) {
  return useQuery({
    queryKey: ["partner-applications-ranked", opportunityId],
    queryFn: async () => {
      if (!opportunityId) return [];
      const { data, error } = await supabase.rpc(
        "get_partner_opportunity_applications_ranked" as any,
        { p_opportunity_id: opportunityId }
      );

      if (error) {
        console.error("Error fetching partner ranked applications:", error);
        throw error;
      }

      return (data || []) as PartnerRankedApplication[];
    },
    enabled: !!opportunityId,
    staleTime: 30 * 1000,
  });
}

export function downloadQualifiedApplicantsCSV(
  applications: PartnerRankedApplication[],
  filename = "qualified-applicants.csv"
) {
  const headers = [
    "Rank",
    "Applicant Name",
    "Organization",
    "Email",
    "Project Title",
    "Status",
    "Avg Score",
    "Reviews",
    "Submitted",
  ];
  const rows = applications.map((a) => [
    a.rank_position,
    a.applicant_name,
    a.organization_name || "",
    a.applicant_email,
    a.project_title || "",
    a.status || "",
    a.average_score?.toFixed(1) ?? "N/A",
    a.total_reviews,
    new Date(a.submitted_at).toLocaleDateString(),
  ]);

  const csvContent = [headers, ...rows]
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    )
    .join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
