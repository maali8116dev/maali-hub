import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ApplicationStatusBadge from "./ApplicationStatusBadge";

interface ApplicationMetadataCardProps {
  application: Record<string, any>;
  /** Optional extra rows to display (e.g. "Applicant: Name") */
  extraRows?: Array<{ label: string; value: React.ReactNode }>;
}

const ApplicationMetadataCard = ({ application, extraRows }: ApplicationMetadataCardProps) => (
  <Card>
    <CardHeader className="p-4 sm:p-6">
      <CardTitle className="text-base sm:text-lg">Application Details</CardTitle>
    </CardHeader>
    <CardContent className="space-y-3 text-sm p-4 pt-0 sm:p-6 sm:pt-0">
      <div className="flex justify-between">
        <span className="text-muted-foreground">Submitted:</span>
        <span className="font-medium">
          {new Date(application.created_at).toLocaleDateString()}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Status:</span>
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

export default ApplicationMetadataCard;

