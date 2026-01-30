import { useState } from "react";
import { Link } from "react-router-dom";
import { Bell, Check, CheckCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: "application" | "system" | "reminder" | "new_application" | "review_assigned" | "deadline_reminder" | "status_change";
  read: boolean;
  createdAt: string;
  link?: string;
}

interface NotificationsDropdownProps {
  notifications: Notification[];
  unreadCount: number;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
}

const NotificationsDropdown = ({
  notifications,
  unreadCount,
  onMarkAsRead,
  onMarkAllAsRead,
}: NotificationsDropdownProps) => {
  const [open, setOpen] = useState(false);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "application":
        return "📄";
      case "system":
        return "⚙️";
      case "reminder":
        return "⏰";
      case "new_application":
        return "📋";
      case "review_assigned":
        return "✅";
      case "deadline_reminder":
        return "⏰";
      case "status_change":
        return "🔄";
      default:
        return "🔔";
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
          aria-label="Notifications"
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
            <h3 className="font-semibold">Notifications</h3>
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
              Mark all read
            </Button>
          )}
        </div>

        <ScrollArea className="h-[400px]">
          {notifications.length > 0 ? (
            <div className="divide-y divide-border">
              {notifications.map((notification) => (
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
                            {notification.title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {notification.message}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(notification.createdAt), {
                              addSuffix: true,
                            })}
                          </p>
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
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bell className="h-12 w-12 text-muted-foreground opacity-50 mb-4" />
              <p className="text-sm font-medium">No notifications</p>
              <p className="text-xs text-muted-foreground mt-1">
                You're all caught up!
              </p>
            </div>
          )}
          <ScrollBar />
        </ScrollArea>

        <div className="border-t border-border px-4 py-3">
          <Link to="/dashboard/notifications" onClick={() => setOpen(false)}>
            <Button variant="ghost" className="w-full justify-center text-sm">
              View all notifications
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationsDropdown;

