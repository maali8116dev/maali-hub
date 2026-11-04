import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText } from "lucide-react";

interface ApplicationNotFoundProps {
  backRoute: string;
  error?: Error | null;
}

const ApplicationNotFound = ({ backRoute, error }: ApplicationNotFoundProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation("dashboard");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(backRoute)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t("applications.detail.backToApplications")}
        </Button>
      </div>
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">{t("applications.detail.notFound.title")}</h2>
            <p className="text-muted-foreground mb-4">
              {error?.message || t("applications.detail.notFound.description")}
            </p>
            <Button onClick={() => navigate(backRoute)}>
              {t("applications.detail.notFound.viewAll")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ApplicationNotFound;
