"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/providers";
import { useData } from "@/lib/data-store";
import type { Notification } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import {
  Bell,
  CheckCircle,
  FileText,
  Banknote,
  AlertTriangle,
  Info,
  Check,
} from "lucide-react";

const typeConfig: Record<
  Notification["type"],
  { icon: typeof Bell; color: string; bg: string }
> = {
  leave: {
    icon: CheckCircle,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-100 dark:bg-emerald-500/15",
  },
  request: {
    icon: FileText,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-100 dark:bg-blue-500/15",
  },
  payroll: {
    icon: Banknote,
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-100 dark:bg-purple-500/15",
  },
  attendance: {
    icon: AlertTriangle,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-100 dark:bg-amber-500/15",
  },
  system: {
    icon: Info,
    color: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-100 dark:bg-rose-500/15",
  },
};

function formatTime(minutes: number, t: ReturnType<typeof useLanguage>["t"]) {
  if (minutes < 1) return t.notif.justNow;
  if (minutes < 60) return `${minutes}${t.notif.minutesAgo}`;
  return `${Math.floor(minutes / 60)}${t.notif.hoursAgo}`;
}

export function NotificationsPanel() {
  const { t, lang } = useLanguage();
  const router = useRouter();
  const {
    notifications: items,
    markNotificationRead,
    markAllNotificationsRead,
  } = useData();
  const isAr = lang === "ar";
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const unreadCount = items.filter((n) => !n.read).length;

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  const handleNotificationClick = useCallback(
    (notification: { id: string; href?: string }) => {
      markNotificationRead(notification.id);
      setOpen(false);
      if (notification.href) {
        router.push(notification.href);
      }
    },
    [router, markNotificationRead]
  );

  return (
    <div ref={panelRef} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen((p) => !p)}
        className="relative p-2 rounded-lg hover:bg-accent transition-colors"
        aria-label={t.notif.title}
      >
        <Bell
          className={cn(
            "w-5 h-5 transition-colors",
            open ? "text-primary" : "text-muted-foreground"
          )}
        />
        {unreadCount > 0 && (
          <span className="absolute top-1 end-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center animate-in zoom-in-50">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <>
          {/* Backdrop on mobile */}
          <div
            className="fixed inset-0 z-40 bg-black/20 lg:hidden"
            onClick={() => setOpen(false)}
          />

          {/* Dropdown */}
          <div
            className={cn(
              "absolute top-full mt-2 z-50 w-[calc(100vw-2rem)] sm:w-96 max-h-[70vh] rounded-xl border border-border bg-card shadow-xl overflow-hidden",
              "animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-150",
              "end-0 sm:end-0"
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm">{t.notif.title}</h3>
                {unreadCount > 0 && (
                  <span className="bg-primary/10 text-primary text-[11px] font-bold px-1.5 py-0.5 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={markAllNotificationsRead}
                  className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  {t.notif.markAllRead}
                </button>
              )}
            </div>

            {/* Notification list */}
            <div className="overflow-y-auto max-h-[calc(70vh-56px)]">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                  <Bell className="w-8 h-8 mb-2 opacity-40" />
                  <p className="text-sm">{t.notif.noNotifications}</p>
                </div>
              ) : (
                items.map((notification) => {
                  const config = typeConfig[notification.type];
                  const Icon = config.icon;

                  return (
                    <button
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={cn(
                        "w-full flex items-start gap-3 p-4 text-start border-b border-border/50 last:border-0 transition-colors hover:bg-accent/40",
                        !notification.read && "bg-primary/[0.03]"
                      )}
                    >
                      {/* Icon */}
                      <div
                        className={cn(
                          "shrink-0 w-9 h-9 rounded-lg flex items-center justify-center mt-0.5",
                          config.bg
                        )}
                      >
                        <Icon className={cn("w-4.5 h-4.5", config.color)} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={cn(
                              "text-sm leading-snug",
                              !notification.read
                                ? "font-semibold text-foreground"
                                : "font-medium text-muted-foreground"
                            )}
                          >
                            {isAr ? notification.titleAr : notification.titleEn}
                          </p>
                          {/* Unread dot */}
                          {!notification.read && (
                            <div className="shrink-0 w-2 h-2 rounded-full bg-primary mt-1.5" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                          {isAr ? notification.descAr : notification.descEn}
                        </p>
                        <p className="text-[11px] text-muted-foreground/70 mt-1.5">
                          {formatTime(notification.time, t)}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
