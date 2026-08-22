"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type AuthGateCtx = { isAuthed: boolean; open: () => void };
const Ctx = createContext<AuthGateCtx>({ isAuthed: false, open: () => {} });

function AuthModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    // Mouse-only convenience close on the backdrop; Escape (above) and the visible
    // Close button give keyboard/screen-reader users an equivalent path.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events -- stops the backdrop's onClose from firing when clicking inside the modal */}
      <div
        className="relative bg-white rounded-lg shadow-2xl p-8 w-[30vw] min-w-[300px] max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 text-red-400 hover:text-red-600 text-lg font-bold leading-none"
        >
          ✕
        </button>
        <h2 className="text-xl font-bold mb-2">Sign in required</h2>
        <p className="text-gray-500 text-sm mb-6">
          To access this feature you must be signed in.
        </p>
        <div className="flex flex-col gap-3">
          <Link
            href="/login"
            className="px-4 py-3 bg-brand text-white rounded-lg text-sm text-center font-medium hover:bg-brand-dark transition"
          >
            Sign in
          </Link>
          <Link
            href="/login?mode=signup"
            className="px-4 py-3 border border-gray-300 rounded-lg text-sm text-center text-gray-700 hover:bg-gray-50 transition"
          >
            Create account
          </Link>
        </div>
      </div>
    </div>
  );
}

export function AuthGateProvider({
  children,
  isAuthed,
}: {
  children: ReactNode;
  isAuthed: boolean;
}) {
  const [showing, setShowing] = useState(false);
  const open = useCallback(() => setShowing(true), []);

  return (
    <Ctx.Provider value={{ isAuthed, open }}>
      {children}
      {showing && <AuthModal onClose={() => setShowing(false)} />}
    </Ctx.Provider>
  );
}

export function useAuthGate() {
  return useContext(Ctx);
}

export function AuthGatedLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const { isAuthed, open } = useAuthGate();
  const router = useRouter();

  return (
    <button
      onClick={() => {
        if (!isAuthed) { open(); return; }
        router.push(href);
      }}
      className={className}
    >
      {children}
    </button>
  );
}
