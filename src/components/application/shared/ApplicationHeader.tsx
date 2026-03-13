import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import ApplicationStatusBadge from "./ApplicationStatusBadge";

interface ApplicationHeaderProps {
  title: string;
  applicationId: string;
  status: string;
  backRoute: string;
}

const ApplicationHeader = ({ title, applicationId, status, backRoute }: ApplicationHeaderProps) => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(backRoute)} className="w-fit min-h-[44px]">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">{title}</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base break-all">
            ID: {applicationId}
          </p>
        </div>
      </div>
      <ApplicationStatusBadge status={status} />
    </div>
  );
};

export default ApplicationHeader;









