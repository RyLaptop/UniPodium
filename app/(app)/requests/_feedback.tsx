"use client";

import { useState, useTransition } from "react";
import { submitFeedback } from "./actions";

export function FeedbackForm({ requestId }: { requestId: string }) {
  const [open, setOpen] = useState(false);
  const [ghosted, setGhosted] = useState<boolean | null>(null);
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  if (done) {
    return <p className="text-xs text-gray-500 mt-2">Feedback submitted. Thanks!</p>;
  }

  if (!open) {
    return (
      <button
        onClick={(e) => { e.preventDefault(); setOpen(true); }}
        className="mt-2 text-xs text-brand hover:underline"
      >
        Leave feedback
      </button>
    );
  }

  const submit = (wasGhosted: boolean) => {
    setGhosted(wasGhosted);
    startTransition(async () => {
      const res = await submitFeedback(requestId, wasGhosted, note);
      if (res.ok) setDone(true);
      else alert(res.error);
    });
  };

  return (
    <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
      <p className="text-xs font-medium text-gray-700">Were you ghosted by the org?</p>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional note…"
        rows={2}
        className="w-full text-xs px-2 py-1.5 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-brand resize-none"
      />
      <div className="flex gap-2">
        <button
          onClick={() => submit(true)}
          disabled={pending}
          className="text-xs px-3 py-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-60"
        >
          Yes, ghosted
        </button>
        <button
          onClick={() => submit(false)}
          disabled={pending}
          className="text-xs px-3 py-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-60"
        >
          No, it went well
        </button>
        <button
          onClick={(e) => { e.preventDefault(); setOpen(false); }}
          disabled={pending}
          className="text-xs px-3 py-1.5 text-gray-500 hover:text-gray-700 disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
