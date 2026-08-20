import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Bell, Check, CheckCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { resolveNotificationText } from "@/lib/notificationText";
import { useFormattedDistance } from "@/hooks/useFormattedDistance";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: "application" | "system" | "reminder" | "new_application" | "review_assigned" | "deadline_reminder" | "status_change" | "payment" | "review_assignment";
  read: boolean;
  createdAt: string;
  link?: string;
  metadata?: Record<string, unknown>;
}

interface NotificationsDropdownProps {
  notifications: Notification[];
  unreadCount: number;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  notificationsLink?: string;
}

function NotificationDropdownTime({ date }: { date: string }) {
  const formatted = useFormattedDistance(date);
  return <p className="text-xs text-muted-foreground mt-1">{formatted}</p>;
}

const NotificationsDropdown = ({
  notifications,
  unreadCount,
  onMarkAsRead,
  onMarkAllAsRead,
  notificationsLink = "/dashboard/notifications",
}: NotificationsDropdownProps) => {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation("common");

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "application":
        return "ðŸ“„";
      case "system":
        return "âš™ï¸";
      case "reminder":
        return "â°";
      case "new_application":
        return "ðŸ“‹";
      case "review_assigned":
        return "âœ…";
      case "deadline_reminder":
        return "â°";
      case "status_change":
        return "ðŸ”„";
      default:
        return "ðŸ””";
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case "application":
        return "text-primary";
      case "system":
        return "text-muted-foreground";
      case "reminder":
        return "text-warning";
      default:
        return "text-foreground";
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={t("notifications.title")}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{t("notifications.title")}</h3>
            {unreadCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onMarkAllAsRead}
              className="h-8 text-xs"
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              {t("notifications.markAllRead")}
            </Button>
          )}
        </div>

        <ScrollArea className="h-[400px]">
          {notifications.length > 0 ? (
            <div className="divide-y divide-border">
              {notifications.map((notification) => {
                const text = resolveNotificationText(notification, t);
                return (
                <div
                  key={notification.id}
                  className={cn(
                    "relative px-4 py-3 hover:bg-muted/50 transition-colors",
                    !notification.read && "bg-primary/5"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-1 text-lg">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p
                            className={cn(
                              "text-sm font-medium",
                              !notification.read && "font-semibold"
                            )}
                          >
                            {text.title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {text.message}
                          </p>
                          <NotificationDropdownTime date={notification.createdAt} />
                        </div>
                        {!notification.read && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => onMarkAsRead(notification.id)}
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                  {!notification.read && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                  )}
                </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bell className="h-12 w-12 text-muted-foreground opacity-50 mb-4" />
              <p className="text-sm font-medium">{t("notifications.emptyTitle")}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {t("notifications.emptyDescription")}
              </p>
            </div>
          )}
          <ScrollBar />
        </ScrollArea>

        <div className="border-t border-border px-4 py-3">
          <Link to={notificationsLink} onClick={() => setOpen(false)}>
            <Button variant="ghost" className="w-full justify-center text-sm">
              {t("notifications.viewAll")}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationsDropdown;









