import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCheck, Check, Bell, Trash2, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { useNotifications, useMarkNotificationAsRead, useMarkAllNotificationsAsRead, useDeleteNotification, useDeleteAllNotifications, Notification } from "@/hooks/useNotifications";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "react-i18next";

const Notifications = () => {
  const { t } = useTranslation(['dashboard']);
  // Fetch real notifications
  const { data: notifications = [], isLoading } = useNotifications();
  const markAsRead = useMarkNotificationAsRead();
  const markAllAsRead = useMarkAllNotificationsAsRead();
  const deleteNotification = useDeleteNotification();
  const deleteAllNotifications = useDeleteAllNotifications();
    

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAsRead = (id: string) => {
    markAsRead.mutate(id);
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead.mutate();
  };

  const handleDeleteNotification = (id: string) => {
    deleteNotification.mutate(id);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "application":
        return "ðŸ“„";
      case "system":
        return "âš™ï¸";
      case "reminder":
        return "â°";
      default:
        return "ðŸ””";
    }
  };

  const getNotificationBadge = (type: string) => {
    const styles = {
      application: "bg-primary/10 text-primary border-primary/20",
      system: "bg-muted text-muted-foreground border-border",
      reminder: "bg-warning/10 text-warning border-warning/20",
    };
    return styles[type as keyof typeof styles] || styles.system;
  };

  const unreadNotifications = notifications.filter((n) => !n.read);
  const readNotifications = notifications.filter((n) => n.read);

  if (isLoading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">{t('dashboard:notifications.title')}</h1>
          <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">
            {t('dashboard:notifications.subtitle')}
          </p>
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
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">{t('dashboard:notifications.title')}</h1>
          <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">
            {t('dashboard:notifications.subtitle')}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button 
            onClick={handleMarkAllAsRead} 
            variant="outline" 
            className="min-h-[44px] w-full sm:w-auto"
            disabled={markAllAsRead.isPending}
          >
            <CheckCheck className="h-4 w-4 mr-2" />
            {markAllAsRead.isPending ? t('dashboard:notifications.marking') : t('dashboard:notifications.markAllAsRead')}
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <Card>
          <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">{t('dashboard:notifications.stats.total')}</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold">{notifications.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">{t('dashboard:notifications.stats.unread')}</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold text-warning">{unreadCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">{t('dashboard:notifications.stats.read')}</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold text-muted-foreground">
              {readNotifications.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Unread Notifications */}
      {unreadNotifications.length > 0 && (
        <div className="space-y-3 sm:space-y-4">
          <h2 className="text-lg sm:text-xl font-semibold">{t('dashboard:notifications.sections.unread')}</h2>
          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {unreadNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className="relative p-3 sm:p-4 hover:bg-muted/50 transition-colors bg-primary/5"
                  >
                    <div className="flex items-start gap-3 sm:gap-4">
                      <div className="mt-1 text-xl sm:text-2xl hidden sm:block">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <h3 className="font-semibold text-sm sm:text-base">{notification.title}</h3>
                              <Badge
                                variant="outline"
                                className={cn("text-xs", getNotificationBadge(notification.type))}
                              >
                                {notification.type}
                              </Badge>
                            </div>
                            <p className="text-xs sm:text-sm text-muted-foreground mb-2">
                              {notification.message}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(notification.createdAt), {
                                addSuffix: true,
                              })}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 sm:gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleMarkAsRead(notification.id)}
                              className="h-10 w-10 sm:h-8 sm:w-8"
                              disabled={markAsRead.isPending}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteNotification(notification.id)}
                              className="h-10 w-10 sm:h-8 sm:w-8 text-destructive hover:text-destructive"
                              disabled={deleteNotification.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        {notification.link && (
                          <Link to={notification.link}>
                            <Button variant="link" className="p-0 h-auto mt-2 text-xs min-h-[44px] flex items-center">
                              {t('dashboard:notifications.actions.viewDetails')}
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Read Notifications */}
      {readNotifications.length > 0 && (
        <div className="space-y-3 sm:space-y-4">
          <h2 className="text-lg sm:text-xl font-semibold">{t('dashboard:notifications.sections.earlier')}</h2>
          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {readNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className="relative p-3 sm:p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start gap-3 sm:gap-4">
                      <div className="mt-1 text-xl sm:text-2xl opacity-50 hidden sm:block">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <h3 className="font-medium text-muted-foreground text-sm sm:text-base">
                                {notification.title}
                              </h3>
                              <Badge
                                variant="outline"
                                className={cn("text-xs opacity-50", getNotificationBadge(notification.type))}
                              >
                                {notification.type}
                              </Badge>
                            </div>
                            <p className="text-xs sm:text-sm text-muted-foreground mb-2">
                              {notification.message}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(notification.createdAt), {
                                addSuffix: true,
                              })}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteNotification(notification.id)}
                            className="h-10 w-10 sm:h-8 sm:w-8 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        {notification.link && (
                          <Link to={notification.link}>
                            <Button variant="link" className="p-0 h-auto mt-2 text-xs min-h-[44px] flex items-center">
                              {t('dashboard:notifications.actions.viewDetails')}
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty State */}
      {notifications.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">{t('dashboard:notifications.emptyState.title')}</h3>
            <p className="text-muted-foreground text-sm sm:text-base">
              {t('dashboard:notifications.emptyState.description')}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Notifications;









