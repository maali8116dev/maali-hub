import { useTranslation } from "react-i18next";
import { getApplicationStatusBadge } from "@/lib/statusBadges";

interface ApplicationStatusBadgeProps {
  status: string;
}

const ApplicationStatusBadge = ({ status }: ApplicationStatusBadgeProps) => {
  const { t } = useTranslation("common");
  return <>{getApplicationStatusBadge(status, undefined, t)}</>;
};

export default ApplicationStatusBadge;
