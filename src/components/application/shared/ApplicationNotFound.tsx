import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText } from "lucide-react";

interface ApplicationNotFoundProps {
  backRoute: string;
  error?: Error | null;
}

const ApplicationNotFound = ({ backRoute, error }: ApplicationNotFoundProps) => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(backRoute)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Applications
        </Button>
      </div>
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Application Not Found</h2>
            <p className="text-muted-foreground mb-4">
              {error?.message || "The application you're looking for doesn't exist or you don't have access to it."}
            </p>
            <Button onClick={() => navigate(backRoute)}>
              View All Applications
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ApplicationNotFound;

