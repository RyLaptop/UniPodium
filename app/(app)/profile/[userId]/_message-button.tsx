"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestDm } from "@/app/(app)/messages/actions";
import { useAuthGate } from "@/app/(app)/_auth-gate";

export function MessageButton({
  targetUserId,
  existingThreadId,
  existingStatus,
}: {
  targetUserId: string;
  existingThreadId: string | null;
  existingStatus: "pending" | "accepted" | "declined" | null;
}) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { isAuthed, open: openAuthModal } = useAuthGate();

  const send = () => {
    if (!isAuthed) { openAuthModal(); return; }
    if (!msg.trim()) return;
    startTransition(async () => {
      const res = await requestDm(targetUserId, msg.trim());
      if (!res.ok) { alert(res.error); return; }
      router.push(`/messages/${res.threadId}`);
    });
  };

  if (existingStatus === "accepted" && existingThreadId) {
    return (
      <Link
        href={`/messages/${existingThreadId}`}
        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 hover:border-brand hover:text-brand transition"
      >
        Message
      </Link>
    );
  }

  if (existingStatus === "pending") {
    return (
      <button
        disabled
        className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-400 cursor-default"
      >
        Message pending
      </button>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => { if (!isAuthed) { openAuthModal(); return; } setOpen(true); }}
        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 hover:border-brand hover:text-brand transition"
      >
        Message
      </button>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg p-3 space-y-2 max-w-sm">
      <p className="text-sm font-medium">Send a message request</p>
      <textarea
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        placeholder="Introduce yourself…"
        rows={3}
        maxLength={500}
        className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand resize-none"
      />
      <div className="flex gap-2">
        <button onClick={send} disabled={pending || !msg.trim()}
          className="px-3 py-1.5 bg-brand text-white text-sm rounded-lg hover:bg-brand-dark disabled:opacity-60">
          {pending ? "Sending…" : "Send"}
        </button>
        <button onClick={() => setOpen(false)} className="px-3 py-1.5 border border-gray-200 text-sm rounded-lg hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </div>
  );
}
