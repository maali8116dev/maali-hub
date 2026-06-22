import NotificationsPage from "@/components/notifications/NotificationsPage";
import { useTranslation } from "react-i18next";

const ReviewerNotifications = () => {
  const { t } = useTranslation("common");

  return (
    <NotificationsPage
      title={t("notifications.title")}
      subtitle={t("notifications.subtitles.reviewer")}
    />
  );
};

export default ReviewerNotifications;
