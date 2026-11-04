import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";

interface MembershipRequiredBannerProps {
  title?: string;
  description?: string;
  className?: string;
}

export function MembershipRequiredBanner({
  title = "Full membership required",
  description = "Become a Full Member ($2/month) to apply for funding opportunities.",
  className,
}: MembershipRequiredBannerProps) {
  const navigate = useNavigate();

  return (
    <Alert className={`border-primary/30 bg-primary/5 ${className ?? ""}`}>
      <Zap className="h-4 w-4 text-primary" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>{description}</p>
        <Button variant="hero" size="sm" onClick={() => navigate("/join")}>
          Become a Member
        </Button>
      </AlertDescription>
    </Alert>
  );
}
