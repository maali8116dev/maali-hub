import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Clock } from "lucide-react";

interface ApplicationStatusBadgeProps {
  status: string;
}

const ApplicationStatusBadge = ({ status }: ApplicationStatusBadgeProps) => {
  switch (status) {
    case "pending":
      return (
        <Badge className="bg-warning/10 text-warning border-warning/20">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      );
    case "under_review":
      return (
        <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
          Under Review
        </Badge>
      );
    case "approved":
      return (
        <Badge className="bg-success/10 text-success border-success/20">
          <CheckCircle className="h-3 w-3 mr-1" />
          Approved
        </Badge>
      );
    case "rejected":
      return (
        <Badge className="bg-destructive/10 text-destructive border-destructive/20">
          <XCircle className="h-3 w-3 mr-1" />
          Rejected
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

export default ApplicationStatusBadge;









