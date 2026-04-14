"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useLanguage, useAuth } from "@/components/providers";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import {
  type SupaNotification,
  fetchNotifications,
  markNotificationReadInDB,
  markAllReadInDB,
  normalizeNotificationRow,
} from "@/lib/notifications";
import { Icon } from "@/components/ui/icon";

const typeConfig: Record<
  SupaNotification["type"],
  { iconName: string; color: string; bg: string }
> = {
  leave: {
    iconName: "event_available",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-100 dark:bg-emerald-500/15",
  },
  request: {
    iconName: "description",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-100 dark:bg-blue-500/15",
  },
  payroll: {
    iconName: "payments",
    color: "text-primary",
    bg: "bg-primary-container/40",
  },
  attendance: {
    iconName: "schedule",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-100 dark:bg-amber-500/15",
  },
  system: {
    iconName: "info",
    color: "text-tertiary",
    bg: "bg-tertiary-container/40",
  },
};

function formatTime(createdAt: string, isAr: boolean) {
  const diff = Date.now() - new Date(createdAt).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return isAr ? "الآن" : "now";
  if (mins < 60) return isAr ? `${mins}د` : `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return isAr ? `${hrs}س` : `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return isAr ? `${days}ي` : `${days}d`;
}

interface NotificationsPanelProps {
  open: boolean;
  onClose: () => void;
  onUnreadCountChange: (count: number) => void;
}

export function NotificationsPanel({ open, onClose, onUnreadCountChange }: NotificationsPanelProps) {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const router = useRouter();
  const isAr = lang === "ar";
  const [items, setItems] = useState<SupaNotification[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  const unreadCount = items.filter((n) => !n.read).length;

  useEffect(() => {
    onUnreadCountChange(unreadCount);
  }, [unreadCount, onUnreadCountChange]);

  useEffect(() => {
    if (!user.id) return;

    async function load() {
      const data = await fetchNotifications(user.id);
      setItems(data);
    }
    load();

    const channel = supabase
      .channel("hr-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = normalizeNotificationRow(payload.new as Record<string, unknown>);
          if (!row.app_name || row.app_name === "hr" || row.app_name === "both") {
            setItems((prev) => [row, ...prev]);
            if (document.hidden && Notification.permission === "granted") {
              new Notification(isAr ? row.title_ar : row.title_en, {
                body: isAr ? row.desc_ar : row.desc_en,
                icon: "/logo.png",
              });
            }
          }
        }
      )
      .subscribe((status, err) => {
        if (status === "SUBSCRIBED") {
          console.log("[HR] Realtime: notifications channel subscribed ✓");
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          console.warn(
            "[HR] Realtime: notifications channel status =",
            status,
            err ? err.message : "— live notifications won't work. Ensure 'notifications' is added to supabase_realtime publication (run supabase/migrations/006_notifications_fix.sql)."
          );
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user.id, isAr]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  const handleNotificationClick = useCallback(
    async (notification: SupaNotification) => {
      if (!notification.read) {
        setItems((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
        );
        markNotificationReadInDB(notification.id);
      }
      onClose();
      if (notification.href) {
        router.push(notification.href);
      }
    },
    [router, onClose]
  );

  const handleMarkAllRead = useCallback(async () => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    markAllReadInDB(user.id);
  }, [user.id]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[200] bg-inverse-surface/20 backdrop-blur-sm lg:hidden"
        onClick={onClose}
      />

      <div
        ref={panelRef}
        className={cn(
          "fixed top-[var(--njd-navbar-height,64px)] z-[201] w-[calc(100vw-2rem)] sm:w-96 max-h-[70vh] rounded-2xl glass-strong shadow-2xl shadow-primary/10 overflow-hidden",
          "animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200",
          "end-4 sm:end-6"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/20">
          <div className="flex items-center gap-2">
            <h3 className="font-headline font-bold text-base text-on-surface">
              {t.notif.title}
            </h3>
            {unreadCount > 0 && (
              <span className="gradient-btn text-[11px] font-bold px-2 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary-dim font-bold transition-colors"
            >
              <Icon name="done_all" size={16} />
              {t.notif.markAllRead}
            </button>
          )}
        </div>

        {/* List */}
        <div className="overflow-y-auto max-h-[calc(70vh-64px)]">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-on-surface-variant">
              <Icon name="notifications_off" size={40} className="mb-3 opacity-40" />
              <p className="text-sm font-medium">{t.notif.noNotifications}</p>
            </div>
          ) : (
            items.map((notification) => {
              const config = typeConfig[notification.type];

              return (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={cn(
                    "w-full flex items-start gap-3 px-5 py-4 text-start border-b border-outline-variant/15 last:border-0 transition-colors hover:bg-surface-container-low",
                    !notification.read && "bg-primary-container/10"
                  )}
                >
                  <div
                    className={cn(
                      "shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center mt-0.5",
                      config.bg
                    )}
                  >
                    <Icon name={config.iconName} fill size={20} className={config.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={cn(
                          "text-sm leading-snug",
                          !notification.read
                            ? "font-bold text-on-surface"
                            : "font-medium text-on-surface-variant"
                        )}
                      >
                        {isAr ? notification.title_ar : notification.title_en}
                      </p>
                      {!notification.read && (
                        <div className="shrink-0 w-2 h-2 rounded-full bg-primary mt-1.5 shadow-primary-glow" />
                      )}
                    </div>
                    <p className="text-xs text-on-surface-variant mt-0.5 line-clamp-2 leading-relaxed">
                      {isAr ? notification.desc_ar : notification.desc_en}
                    </p>
                    <p className="text-[11px] text-on-surface-variant/70 mt-1.5 font-medium">
                      {formatTime(notification.created_at, isAr)}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
