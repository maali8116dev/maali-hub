import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCheck, Check, Bell, Trash2, FileText, Clock, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  useNotifications,
  useMarkNotificationAsRead,
  useMarkAllNotificationsAsRead,
  useDeleteNotification,
  useDeleteAllNotifications,
  Notification,
} from "@/hooks/useNotifications";
import { useFormattedDistance } from "@/hooks/useFormattedDistance";
import { Skeleton } from "@/components/ui/skeleton";
import { resolveNotificationText } from "@/lib/notificationText";

function withPartnerNotificationContext(link: string) {
  if (/^\/partner\/opportunities\/\d+\/applications$/.test(link)) {
    return `${link}?from=notification`;
  }
  return link;
}

interface NotificationsPageProps {
  title?: string;
  subtitle?: string;
}

function NotificationTime({ date }: { date: string }) {
  const formatted = useFormattedDistance(date);
  return <p className="text-xs text-muted-foreground">{formatted}</p>;
}

const NotificationsPage = ({ title, subtitle }: NotificationsPageProps) => {
  const { t } = useTranslation("common");
  const { data: notifications = [], isLoading } = useNotifications();
  const markAsRead = useMarkNotificationAsRead();
  const markAllAsRead = useMarkAllNotificationsAsRead();
  const deleteNotification = useDeleteNotification();
  const deleteAllNotifications = useDeleteAllNotifications();

  const pageTitle = title ?? t("notifications.title");
  const unreadCount = notifications.filter((n) => !n.read).length;
  const unreadNotifications = notifications.filter((n) => !n.read);
  const readNotifications = notifications.filter((n) => n.read);

  const getTypeLabel = (type: Notification["type"]) =>
    t(`notifications.types.${type}`, { defaultValue: t("notifications.types.default") });

  const handleMarkAsRead = (id: string) => {
    markAsRead.mutate(id);
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead.mutate();
  };

  const handleDeleteNotification = (id: string) => {
    deleteNotification.mutate(id);
  };

  const handleDeleteAll = () => {
    deleteAllNotifications.mutate();
  };

  const getNotificationIcon = (type: Notification["type"]) => {
    switch (type) {
      case "new_application":
        return <FileText className="h-5 w-5" />;
      case "review_assigned":
        return <CheckCircle className="h-5 w-5" />;
      case "deadline_reminder":
        return <Clock className="h-5 w-5" />;
      case "status_change":
        return <AlertCircle className="h-5 w-5" />;
      case "system":
      default:
        return <Bell className="h-5 w-5" />;
    }
  };

  const getNotificationBadge = (type: Notification["type"]) => {
    const styles = {
      new_application: "bg-primary/10 text-primary border-primary/20",
      review_assigned: "bg-success/10 text-success border-success/20",
      deadline_reminder: "bg-warning/10 text-warning border-warning/20",
      status_change: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      system: "bg-muted text-muted-foreground border-border",
      application: "bg-primary/10 text-primary border-primary/20",
      reminder: "bg-warning/10 text-warning border-warning/20",
    };
    return styles[type as keyof typeof styles] || styles.system;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{pageTitle}</h1>
          {subtitle && (
            <p className="text-muted-foreground mt-2">{subtitle}</p>
          )}
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i}>
              <CardContent className="p-4 sm:p-6">
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-full mb-1" />
                <Skeleton className="h-3 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">{pageTitle}</h1>
          {subtitle && (
            <p className="text-muted-foreground mt-2">{subtitle}</p>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          {unreadCount > 0 && (
            <Button
              onClick={handleMarkAllAsRead}
              variant="outline"
              disabled={markAllAsRead.isPending}
              className="min-h-[44px]"
            >
              <CheckCheck className="h-4 w-4 mr-2" />
              {markAllAsRead.isPending ? t("notifications.marking") : t("notifications.markAllRead")}
            </Button>
          )}
          {notifications.length > 0 && (
            <Button
              onClick={handleDeleteAll}
              variant="outline"
              disabled={deleteAllNotifications.isPending}
              className="min-h-[44px] text-destructive hover:text-destructive"
            >
              {deleteAllNotifications.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              {t("notifications.clearAll")}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t("notifications.total")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{notifications.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t("notifications.unread")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{unreadCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t("notifications.read")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">
              {readNotifications.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {unreadNotifications.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">{t("notifications.sections.unread")}</h2>
          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {unreadNotifications.map((notification) => {
                  const text = resolveNotificationText(notification, t);
                  return (
                  <div
                    key={notification.id}
                    className="relative p-4 hover:bg-muted/50 transition-colors bg-primary/5"
                  >
                    <div className="flex items-start gap-4">
                      <div className="mt-1 flex-shrink-0">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold">{text.title}</h3>
                              <Badge
                                variant="outline"
                                className={cn("text-xs", getNotificationBadge(notification.type))}
                              >
                                {getTypeLabel(notification.type)}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              {text.message}
                            </p>
                            <NotificationTime date={notification.createdAt} />
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleMarkAsRead(notification.id)}
                              disabled={markAsRead.isPending}
                              className="h-8 w-8"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteNotification(notification.id)}
                              disabled={deleteNotification.isPending}
                              className="h-8 w-8 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        {notification.link && (
                          <Link to={withPartnerNotificationContext(notification.link)}>
                            <Button variant="link" className="p-0 h-auto mt-2 text-xs">
                              {t("notifications.viewDetails")}
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                  </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {readNotifications.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">{t("notifications.sections.earlier")}</h2>
          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {readNotifications.map((notification) => {
                  const text = resolveNotificationText(notification, t);
                  return (
                  <div
                    key={notification.id}
                    className="p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      <div className="mt-1 flex-shrink-0 text-muted-foreground">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium">{text.title}</h3>
                              <Badge
                                variant="outline"
                                className={cn("text-xs", getNotificationBadge(notification.type))}
                              >
                                {getTypeLabel(notification.type)}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              {text.message}
                            </p>
                            <NotificationTime date={notification.createdAt} />
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteNotification(notification.id)}
                            disabled={deleteNotification.isPending}
                            className="h-8 w-8 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        {notification.link && (
                          <Link to={withPartnerNotificationContext(notification.link)}>
                            <Button variant="link" className="p-0 h-auto mt-2 text-xs">
                              {t("notifications.viewDetails")}
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {notifications.length === 0 && (
        <Card>
          <CardContent className="py-12 flex flex-col items-center text-center">
            <Bell className="h-12 w-12 text-muted-foreground opacity-50 mb-4" />
            <p className="text-sm font-medium">{t("notifications.emptyTitle")}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {t("notifications.emptyDescription")}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default NotificationsPage;
