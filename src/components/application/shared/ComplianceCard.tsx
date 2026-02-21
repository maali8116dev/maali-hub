import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, AlertCircle } from "lucide-react";

interface ComplianceCardProps {
  application: Record<string, any>;
}

interface ComplianceItemProps {
  label: string;
  confirmed: boolean;
  confirmedText: string;
  notConfirmedText: string;
}

const ComplianceItem = ({ label, confirmed, confirmedText, notConfirmedText }: ComplianceItemProps) => (
  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
    {confirmed ? (
      <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
    ) : (
      <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
    )}
    <div className="flex-1">
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-muted-foreground">
        {confirmed ? confirmedText : notConfirmedText}
      </p>
    </div>
  </div>
);

const ComplianceCard = ({ application }: ComplianceCardProps) => {
  const hasCompliance =
    application.information_accurate_confirmed !== undefined ||
    application.conflict_of_interest_declared !== undefined ||
    application.reporting_requirements_agreed !== undefined ||
    application.data_processing_consented !== undefined;

  if (!hasCompliance) return null;

  return (
    <Card>
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="text-base sm:text-lg">Compliance & Declarations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0 sm:p-6 sm:pt-0">
        <div className="space-y-2">
          {application.information_accurate_confirmed !== undefined && (
            <ComplianceItem
              label="Information Accurate Confirmed"
              confirmed={application.information_accurate_confirmed}
              confirmedText="Confirmed"
              notConfirmedText="Not confirmed"
            />
          )}
          {application.conflict_of_interest_declared !== undefined && (
            <ComplianceItem
              label="Conflict of Interest Declared"
              confirmed={application.conflict_of_interest_declared}
              confirmedText="Declared"
              notConfirmedText="Not declared"
            />
          )}
          {application.reporting_requirements_agreed !== undefined && (
            <ComplianceItem
              label="Reporting Requirements Agreed"
              confirmed={application.reporting_requirements_agreed}
              confirmedText="Agreed"
              notConfirmedText="Not agreed"
            />
          )}
          {application.data_processing_consented !== undefined && (
            <ComplianceItem
              label="Data Processing Consented"
              confirmed={application.data_processing_consented}
              confirmedText="Consented"
              notConfirmedText="Not consented"
            />
          )}
        </div>
        {application.declaration_date && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              Declaration Date: {new Date(application.declaration_date).toLocaleDateString()}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ComplianceCard;

