import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useToast } from "@/hooks/use-toast";
import i18n from "@/lib/i18n";

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: "application" | "system" | "reminder" | "new_application" | "review_assigned" | "deadline_reminder" | "status_change" | "payment" | "review_assignment";
  read: boolean;
  link?: string;
  metadata?: {
    template?: string;
    params?: Record<string, unknown>;
    application_id?: string;
    project_id?: number;
    status?: string;
    previous_status?: string;
    [key: string]: any;
  };
  createdAt: string;
}

// Transform database notification to app format
const transformNotification = (dbNotification: any): Notification => ({
  id: dbNotification.id,
  userId: dbNotification.user_id,
  title: dbNotification.title,
  message: dbNotification.message,
  type: dbNotification.type,
  read: dbNotification.read,
  link: dbNotification.link || undefined,
  metadata: dbNotification.metadata || undefined,
  createdAt: dbNotification.created_at,
});

// Cap to keep dropdown payloads bounded as notifications accumulate over time.
// Unread count is fetched separately so it stays accurate beyond this window.
const NOTIFICATIONS_PAGE_SIZE = 50;

// Fetch the most recent notifications for the current user
const fetchNotifications = async (): Promise<Notification[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  const { data, error } = await supabase
    .from("notifications")
    .select("id, user_id, title, message, type, read, link, metadata, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(NOTIFICATIONS_PAGE_SIZE);

  if (error) throw error;

  return data.map(transformNotification);
};

// Fetch unread count via HEAD request — does not transfer rows.
const fetchUnreadNotificationCount = async (): Promise<number> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("read", false);

  if (error) throw error;
  return count ?? 0;
};

// Mark notification as read
const markNotificationAsRead = async (notificationId: string): Promise<void> => {
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", notificationId);

  if (error) throw error;
};

// Mark all notifications as read
const markAllNotificationsAsRead = async (): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", user.id)
    .eq("read", false);

  if (error) throw error;
};

// Delete notification
const deleteNotification = async (notificationId: string): Promise<void> => {
  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", notificationId);

  if (error) throw error;
};

// Delete all notifications
const deleteAllNotifications = async (): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("user_id", user.id);

  if (error) throw error;
};

// Create a notification (can be called for any user via RPC function)
const createNotification = async (
  userId: string,
  title: string,
  message: string,
  type: Notification["type"],
  link?: string,
  metadata?: Record<string, any>
): Promise<string | null> => {
  const { data, error } = await supabase.rpc("create_notification", {
    p_user_id: userId,
    p_title: title,
    p_message: message,
    p_type: type,
    p_link: link || null,
    p_metadata: metadata || null,
  });

  if (error) {
    console.error("Error creating notification:", {
      userId,
      title,
      error: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    // Throw error so callers can handle it appropriately
    throw new Error(`Failed to create notification: ${error.message}`);
  }

  // Return the notification ID if successful
  return data || null;
};

// Hook to fetch notifications with real-time subscriptions
export const useNotifications = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: fetchNotifications,
    enabled: !!user,
    refetchOnWindowFocus: false, // Disabled - using realtime subscriptions instead
    // Removed refetchInterval - using subscriptions instead for real-time updates
    // This reduces API calls by ~99% (only refetches when data actually changes)
  });

  // Set up real-time subscription for notifications
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*", // Listen for INSERT, UPDATE, DELETE
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          // Invalidate and refetch notifications when any change occurs
          queryClient.invalidateQueries({
            queryKey: ["notifications", user.id],
          });
          queryClient.invalidateQueries({
            queryKey: ["notifications-unread-count", user.id],
          });

          // If a new notification is created for this user, show a toast
          if (payload.eventType === "INSERT" && payload.new) {
            const newNotification: any = payload.new;

            toast({
              title: newNotification.title || i18n.t("toasts.notifications.fallbackTitle", { ns: "common" }),
              description: newNotification.message,
            });
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log(`âœ… Subscribed to notifications for user ${user.id}`);
        } else if (status === "CHANNEL_ERROR") {
          console.error("âŒ Error subscribing to notifications channel");
        } else if (status === "TIMED_OUT") {
          console.warn("âš ï¸ Notification subscription timed out, retrying...");
        }
      });

    // Cleanup subscription on unmount or user change
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  return query;
};

// Hook to get unread count.
// Uses a HEAD count query so it stays correct even if the user has more than
// NOTIFICATIONS_PAGE_SIZE notifications.
export const useUnreadNotificationCount = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["notifications-unread-count", user?.id],
    queryFn: fetchUnreadNotificationCount,
    enabled: !!user,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`notifications-unread:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["notifications-unread-count", user.id],
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  return data ?? 0;
};

// Hook to mark notification as read
export const useMarkNotificationAsRead = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: markNotificationAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
    },
  });
};

// Hook to mark all notifications as read
export const useMarkAllNotificationsAsRead = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: markAllNotificationsAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
    },
  });
};

// Hook to delete notification
export const useDeleteNotification = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: deleteNotification,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
    },
  });
};

// Hook to delete all notifications
export const useDeleteAllNotifications = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: deleteAllNotifications,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
    },
  });
};

// Export the createNotification function for direct use
export { createNotification };









