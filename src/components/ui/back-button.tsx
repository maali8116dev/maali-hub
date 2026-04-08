import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

type BackButtonProps = {
  label: string;
  link: string;
};

export function BackButton({ label, link }: BackButtonProps) {
  return (
    <Button variant="ghost" asChild>
      <Link to={link}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        {label}
      </Link>
    </Button>
  );
}
