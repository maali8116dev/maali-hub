import { useTranslation } from "react-i18next";
import DocumentUploadSection from "@/components/application/DocumentUploadSection";
import type { ApplicationFormData } from "@/stores/applicationForm";

interface Step5DocumentsProps {
  opportunityId?: number;
  applicantType?: ApplicationFormData["applicantType"];
  onFilesChange: (files: File[]) => void;
  onLibraryDocumentsChange: (documentIds: string[]) => void;
}

export function Step5Documents({
  opportunityId,
  applicantType,
  onFilesChange,
  onLibraryDocumentsChange,
}: Step5DocumentsProps) {
  const { t } = useTranslation("dashboard");

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">{t("applications.form.step5.title")}</h3>
        <p className="text-sm text-muted-foreground mb-4">
          {t("applications.form.step5.description")}
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
