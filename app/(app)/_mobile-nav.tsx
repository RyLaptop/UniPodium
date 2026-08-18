"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { useAuthGate } from "./_auth-gate";

export function MobileNav({
  links,
  requestBadge,
  isAdmin,
  userId,
  displayName,
  uniLabel,
}: {
  links: { href: string; label: string; requiresAuth?: boolean }[];
  requestBadge: number;
  isAdmin: boolean;
  userId: string | null;
  displayName: string;
  uniLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const close = () => setOpen(false);
  const { isAuthed, open: openAuthGate } = useAuthGate();

  // The panel below is portaled to document.body — it must be, because it's
  // triggered from inside the header, and the header's backdrop-blur (for
  // the translucent-nav look) creates a CSS containing block for any
  // `position: fixed` descendant. Left un-portaled, "fixed inset-0" silently
  // resolves against the ~64px header box instead of the real viewport.
  useEffect(() => setMounted(true), []);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="md:hidden flex flex-col gap-1 p-2"
        aria-label="Open menu"
      >
        <span className="w-5 h-0.5 bg-gray-700 block" />
        <span className="w-5 h-0.5 bg-gray-700 block" />
        <span className="w-5 h-0.5 bg-gray-700 block" />
      </button>

      {open && mounted && createPortal(
        <div className="fixed inset-0 z-50 bg-white flex flex-col md:hidden">
          <div className="flex items-center justify-between px-4 h-14 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <svg width="22" height="22" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" style={{ color: "rgb(var(--color-brand))" }}>
                <circle cx="40" cy="10" r="4.5" fill="currentColor"/>
                <line x1="40" y1="14.5" x2="40" y2="22" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                <path d="M14 22 L66 22 L60 36 L20 36 Z" fill="#0F172A"/>
                <line x1="26" y1="30" x2="54" y2="30" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M30 36 L50 36 L47 62 L33 62 Z" fill="#0F172A"/>
                <path d="M22 62 L58 62 L60 70 L20 70 Z" fill="#0F172A"/>
              </svg>
              <div className="flex flex-col leading-none">
                <span className="font-bold text-[15px]" style={{ letterSpacing: "-0.025em" }}>
                  <span className="text-slate-900">Uni</span><span className="text-brand">Podium</span>
                </span>
                <span className="text-[9px] text-gray-400 font-normal">{uniLabel}</span>
              </div>
            </div>
            <button
              onClick={close}
              className="text-gray-500 text-2xl leading-none"
              aria-label="Close menu"
            >
              ✕
            </button>
          </div>

          <nav className="flex-1 flex flex-col p-4 gap-1 text-base overflow-y-auto">
            {links.map(({ href, label, requiresAuth }) => {
              const showDot = label === "Requests" && requestBadge > 0;
              if (requiresAuth && !isAuthed) {
                return (
                  <button
                    key={href}
                    onClick={() => { close(); openAuthGate(); }}
                    className="relative flex items-center gap-2 px-3 py-3 rounded-lg text-gray-700 hover:bg-gray-50 hover:text-brand text-left"
                  >
                    {label}
                    {showDot && <span className="w-2 h-2 bg-red-500 rounded-full" />}
                  </button>
                );
              }
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={close}
                  className="relative flex items-center gap-2 px-3 py-3 rounded-lg text-gray-700 hover:bg-gray-50 hover:text-brand"
                >
                  {label}
                  {showDot && <span className="w-2 h-2 bg-red-500 rounded-full" />}
                </Link>
              );
            })}
            {isAdmin && (
              <Link
                href="/bulletin/admin"
                onClick={close}
                className="px-3 py-3 rounded-lg text-gray-700 hover:bg-gray-50 hover:text-brand"
              >
                Admin
              </Link>
            )}
          </nav>

          <div className="p-4 border-t border-gray-100 space-y-2">
            {userId ? (
              <>
                <Link
                  href={`/profile/${userId}`}
                  onClick={close}
                  className="block w-full px-4 py-2.5 text-sm text-gray-700 hover:text-brand text-center"
                >
                  {displayName} · View profile
                </Link>
                <form action={signOut}>
                  <button
                    type="submit"
                    className="up-btn-secondary w-full"
                  >
                    Sign out
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={close}
                  className="up-btn-primary w-full"
                >
                  Sign in
                </Link>
                <Link
                  href="/login?mode=signup"
                  onClick={close}
                  className="up-btn-secondary w-full"
                >
                  Create account
                </Link>
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
