import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePartnerOrgLinked } from "@/hooks/usePartnerOrg";

type PartnerCreateOpportunityButtonProps = Omit<ButtonProps, "onClick" | "disabled"> & {
  label?: string;
  showIcon?: boolean;
};

export function PartnerCreateOpportunityButton({
  label,
  showIcon = true,
  children,
  ...buttonProps
}: PartnerCreateOpportunityButtonProps) {
  const navigate = useNavigate();
  const { t } = useTranslation("dashboard");
  const { isLinked } = usePartnerOrgLinked();
  const text = label ?? children ?? t("opportunities.page.create");

  const button = (
    <Button
      {...buttonProps}
      disabled={!isLinked || buttonProps.disabled}
      onClick={() => navigate("/partner/opportunities/new")}
    >
      {showIcon ? <Plus className="h-4 w-4 mr-2" /> : null}
      {text}
    </Button>
  );

  if (isLinked) return button;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">{button}</span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{t("partner.orgNotLinked.createDisabledTooltip")}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
