import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCheck, Check, Bell, Trash2, FileText, Clock, AlertCircle, CheckCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: "new_application" | "review_assigned" | "deadline_reminder" | "status_change" | "system";
  read: boolean;
  createdAt: string;
  link?: string;
}

const Notifications = () => {
  // Mock data - replace with API calls when backend is ready
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: "1",
      title: "New Application Assigned",
      message: "A new application for 'AgriTech Innovation Fund' has been assigned to you for review.",
      type: "new_application",
      read: false,
      createdAt: "2024-01-20T10:30:00Z",
      link: "/reviewer/applications/1",
    },
    {
      id: "2",
      title: "Review Deadline Approaching",
      message: "You have 2 days left to complete the review for 'FinTech Mobile Solutions' application.",
      type: "deadline_reminder",
      read: false,
      createdAt: "2024-01-19T14:20:00Z",
      link: "/reviewer/applications/2",
    },
    {
      id: "3",
      title: "Application Status Changed",
      message: "The application for 'Green Energy Innovations' has been updated to 'Under Review'.",
      type: "status_change",
      read: false,
      createdAt: "2024-01-18T09:15:00Z",
      link: "/reviewer/applications/3",
    },
    {
      id: "4",
      title: "Review Completed",
      message: "Your review for 'AI Healthcare Diagnostics' has been successfully submitted.",
      type: "review_assigned",
      read: true,
      createdAt: "2024-01-17T16:45:00Z",
      link: "/reviewer/applications/4",
    },
    {
      id: "5",
      title: "New Application Assigned",
      message: "A new application for 'Women Empowerment Marketplace' requires your review.",
      type: "new_application",
      read: true,
      createdAt: "2024-01-16T11:00:00Z",
      link: "/reviewer/applications/5",
    },
    {
      id: "6",
      title: "System Update",
      message: "Review guidelines have been updated. Please review the new criteria.",
      type: "system",
      read: true,
      createdAt: "2024-01-15T13:30:00Z",
      link: "/reviewer/settings",
    },
    {
      id: "7",
      title: "Review Reminder",
      message: "You have 5 pending applications that need your attention.",
      type: "deadline_reminder",
      read: true,
      createdAt: "2024-01-14T08:00:00Z",
      link: "/reviewer/pending",
    },
  ]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = (id: string) => {
    setNotifications(
      notifications.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications(notifications.map((n) => ({ ...n, read: true })));
  };

  const deleteNotification = (id: string) => {
    setNotifications(notifications.filter((n) => n.id !== id));
  };

  const getNotificationIcon = (type: string) => {
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
        return <Bell className="h-5 w-5" />;
      default:
        return <Bell className="h-5 w-5" />;
    }
  };

  const getNotificationBadge = (type: string) => {
    const styles = {
      new_application: "bg-primary/10 text-primary border-primary/20",
      review_assigned: "bg-success/10 text-success border-success/20",
      deadline_reminder: "bg-warning/10 text-warning border-warning/20",
      status_change: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      system: "bg-muted text-muted-foreground border-border",
    };
    return styles[type as keyof typeof styles] || styles.system;
  };

  const unreadNotifications = notifications.filter((n) => !n.read);
  const readNotifications = notifications.filter((n) => n.read);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Notifications</h1>
          <p className="text-muted-foreground mt-2">
            Stay updated on assigned applications and review activities
          </p>
        </div>
        {unreadCount > 0 && (
          <Button onClick={markAllAsRead} variant="outline">
            <CheckCheck className="h-4 w-4 mr-2" />
            Mark all as read
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{notifications.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Unread</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{unreadCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Read</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">
              {readNotifications.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Unread Notifications */}
      {unreadNotifications.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Unread</h2>
          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {unreadNotifications.map((notification) => (
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
                              <h3 className="font-semibold">{notification.title}</h3>
                              <Badge
                                variant="outline"
                                className={cn("text-xs", getNotificationBadge(notification.type))}
                              >
                                {notification.type.replace("_", " ")}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              {notification.message}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(notification.createdAt), {
                                addSuffix: true,
                              })}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => markAsRead(notification.id)}
                              className="h-8 w-8"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteNotification(notification.id)}
                              className="h-8 w-8 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        {notification.link && (
                          <Link to={notification.link}>
                            <Button variant="link" className="p-0 h-auto mt-2 text-xs">
                              View details →
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
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Earlier</h2>
          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {readNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className="relative p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      <div className="mt-1 flex-shrink-0 opacity-50">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium text-muted-foreground">
                                {notification.title}
                              </h3>
                              <Badge
                                variant="outline"
                                className={cn("text-xs opacity-50", getNotificationBadge(notification.type))}
                              >
                                {notification.type.replace("_", " ")}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
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
                            onClick={() => deleteNotification(notification.id)}
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        {notification.link && (
                          <Link to={notification.link}>
                            <Button variant="link" className="p-0 h-auto mt-2 text-xs">
                              View details →
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
            <h3 className="text-lg font-semibold mb-2">No notifications</h3>
            <p className="text-muted-foreground">
              You're all caught up! New notifications will appear here.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Notifications;


