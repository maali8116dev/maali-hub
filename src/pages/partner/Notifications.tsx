import NotificationsPage from "@/components/notifications/NotificationsPage";
import { useTranslation } from "react-i18next";

const PartnerNotifications = () => {
  const { t } = useTranslation("common");

  return (
    <NotificationsPage
      title={t("notifications.title")}
      subtitle={t("notifications.subtitles.partner")}
    />
  );
};

export default PartnerNotifications;
