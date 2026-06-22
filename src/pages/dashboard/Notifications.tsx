import NotificationsPage from "@/components/notifications/NotificationsPage";
import { useTranslation } from "react-i18next";

const Notifications = () => {
  const { t } = useTranslation("common");

  return (
    <NotificationsPage
      title={t("notifications.title")}
      subtitle={t("notifications.subtitles.member")}
    />
  );
};

export default Notifications;
