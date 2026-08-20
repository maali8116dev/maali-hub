import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ApplicationStatusBadge from "./ApplicationStatusBadge";

interface ApplicationMetadataCardProps {
  application: Record<string, any>;
  extraRows?: Array<{ label: string; value: React.ReactNode }>;
}

const ApplicationMetadataCard = ({ application, extraRows }: ApplicationMetadataCardProps) => {
  const { t } = useTranslation("dashboard");

  return (
    <Card>
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="text-base sm:text-lg">{t("applications.detail.metadata.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm p-4 pt-0 sm:p-6 sm:pt-0">
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t("applications.detail.metadata.submitted")}</span>
          <span className="font-medium">
            {new Date(application.created_at).toLocaleDateString()}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t("applications.detail.metadata.status")}</span>
          <ApplicationStatusBadge status={application.status || "pending"} />
        </div>
        {extraRows?.map((row, idx) => (
          <div key={idx} className="flex justify-between">
            <span className="text-muted-foreground">{row.label}:</span>
            <span className="font-medium">{row.value}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default ApplicationMetadataCard;
