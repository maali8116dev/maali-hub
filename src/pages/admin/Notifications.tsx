import NotificationsPage from "@/components/notifications/NotificationsPage";
import { useTranslation } from "react-i18next";

const AdminNotifications = () => {
  const { t } = useTranslation("common");

  return (
    <NotificationsPage
      title={t("notifications.title")}
      subtitle={t("notifications.subtitles.admin")}
    />
  );
};

export default AdminNotifications;
