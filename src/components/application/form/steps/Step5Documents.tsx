import DocumentUploadSection from "@/components/application/DocumentUploadSection";
import type { ApplicationFormData } from "@/stores/applicationForm";

interface Step5DocumentsProps {
  projectId?: number;
  applicantType?: string;
  onFilesChange: (files: File[]) => void;
  onLibraryDocumentsChange: (documentIds: string[]) => void;
}

export function Step5Documents({
  projectId,
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
        projectId={projectId}
        onFilesChange={onFilesChange}
        onLibraryDocumentsChange={onLibraryDocumentsChange}
        applicantType={applicantType}
      />
    </div>
  );
}

