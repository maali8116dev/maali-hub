import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type PartnerApplication = {
  id: string;
  status: string | null;
  fullLegalName: string | null;
  organizationName: string | null;
  contactEmail: string | null;
  projectTitle: string | null;
  createdAt: string;
  projectId: number;
};

export function usePartnerApplications(projectId?: number) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["partner-applications", user?.id, projectId],
    queryFn: async () => {
      let query = supabase
        .from("applications")
        .select("id, status, full_legal_name, organization_name, contact_email, project_title, created_at, project_id")
        .eq("is_draft", false)
        .order("created_at", { ascending: false });

      if (projectId) {
        query = query.eq("project_id", projectId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((a) => ({
        id: a.id,
        status: a.status,
        fullLegalName: a.full_legal_name,
        organizationName: a.organization_name,
        contactEmail: a.contact_email,
        projectTitle: a.project_title,
        createdAt: a.created_at,
        projectId: a.project_id,
      }));
    },
    enabled: !!user,
  });
}

export function downloadApplicationsCSV(applications: PartnerApplication[], filename = "applications.csv") {
  const headers = ["ID", "Status", "Applicant Name", "Organization", "Email", "Project Title", "Submitted"];
  const rows = applications.map((a) => [
    a.id,
    a.status || "",
    a.fullLegalName || "",
    a.organizationName || "",
    a.contactEmail || "",
    a.projectTitle || "",
    new Date(a.createdAt).toLocaleDateString(),
  ]);

  const csvContent = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
