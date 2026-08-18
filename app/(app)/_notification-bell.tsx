"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MessageCircle, ClipboardList, Pin, Users, Calendar, Bell, type LucideIcon } from "lucide-react";
import { dismissNotification } from "./notifications/actions";

export type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  created_at: string;
};

export function NotificationBell({ initialNotifs }: { initialNotifs: Notification[] }) {
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState(initialNotifs);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  // Sync when server re-renders with fresh data
  useEffect(() => {
    setNotifs(initialNotifs);
  }, [initialNotifs]);

  // Close on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const dismiss = (id: string) => {
    setNotifs((prev) => prev.filter((n) => n.id !== id));
    startTransition(async () => {
      await dismissNotification(id);
      router.refresh();
    });
  };

  const count = notifs.length;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        className="relative p-2 text-gray-600 hover:text-brand rounded"
      >
        <BellIcon />
        {count > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50 flex flex-col max-h-[28rem]">
          <div className="px-3 py-2 border-b border-gray-100 shrink-0 flex items-center justify-between">
            <p className="text-sm font-semibold">Notifications</p>
            {count > 0 && (
              <span className="text-xs text-gray-400">{count} new</span>
            )}
          </div>

          <ul className="overflow-y-auto divide-y divide-gray-50">
            {notifs.length === 0 ? (
              <li className="px-3 py-6 text-sm text-gray-500 text-center">
                All caught up!
              </li>
            ) : (
              notifs.map((n) => (
                <li key={n.id} className="flex items-start gap-2 px-3 py-2.5 hover:bg-gray-50">
                  <TypeIcon type={n.type} />
                  <div className="flex-1 min-w-0">
                    {n.link ? (
                      <Link
                        href={n.link}
                        onClick={() => setOpen(false)}
                        className="block"
                      >
                        <p className="text-sm font-medium leading-snug">{n.title}</p>
                        {n.body && (
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>
                        )}
                      </Link>
                    ) : (
                      <>
                        <p className="text-sm font-medium leading-snug">{n.title}</p>
                        {n.body && (
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>
                        )}
                      </>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">{formatTime(n.created_at)}</p>
                  </div>
                  <button
                    onClick={() => dismiss(n.id)}
                    aria-label="Dismiss"
                    className="shrink-0 text-gray-300 hover:text-gray-600 text-lg leading-none mt-0.5"
                  >
                    ×
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function TypeIcon({ type }: { type: string }) {
  const icons: Record<string, LucideIcon> = {
    chat_message: MessageCircle,
    request_update: ClipboardList,
    bulletin_update: Pin,
    org_member_request: Users,
    org_meeting: Calendar,
  };
  const Icon = icons[type] ?? Bell;
  return (
    <span className="shrink-0 mt-0.5 text-gray-400" aria-hidden>
      <Icon className="w-4 h-4" strokeWidth={2.25} />
    </span>
  );
}

function BellIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return d.toLocaleDateString();
}
