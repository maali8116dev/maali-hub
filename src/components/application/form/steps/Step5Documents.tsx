import DocumentUploadSection from "@/components/application/DocumentUploadSection";
import type { ApplicationFormData } from "@/stores/applicationForm";

interface Step5DocumentsProps {
  opportunityId?: number;
  applicantType?: "Individual" | "Organization" | "Startup / SME" | "NGO / Non-profit" | "Research / Academic";
  onFilesChange: (files: File[]) => void;
  onLibraryDocumentsChange: (documentIds: string[]) => void;
}

export function Step5Documents({
  opportunityId,
  applicantType,
  onFilesChange,
  onLibraryDocumentsChange,
}: Step5DocumentsProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">Upload Documents</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Upload supporting documents for your application (optional).
        </p>
      </div>

      <DocumentUploadSection
        opportunityId={opportunityId}
        onFilesChange={onFilesChange}
        onLibraryDocumentsChange={onLibraryDocumentsChange}
        applicantType={applicantType}
      />
    </div>
  );
}









