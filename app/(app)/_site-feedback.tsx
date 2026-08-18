"use client";

import { useState, useTransition } from "react";
import { submitSiteFeedback } from "./actions";

export function SiteFeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleSubmit = () => {
    if (!text.trim()) return;
    startTransition(async () => {
      const res = await submitSiteFeedback(text);
      if (!res.ok) { alert(res.error); return; }
      setDone(true);
      setText("");
    });
  };

  if (done) {
    return (
      <div className="border border-gray-200 rounded-xl p-4 text-center space-y-1">
        <p className="text-sm font-medium text-gray-700">Thanks for the feedback!</p>
        <button onClick={() => { setDone(false); setOpen(false); }} className="text-xs text-brand hover:underline">
          Send another
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full border border-dashed border-gray-300 rounded-xl p-4 text-sm text-gray-500 hover:border-brand hover:text-brand transition text-center"
      >
        Share feedback or feature ideas
      </button>
    );
  }

  return (
    <div className="border border-gray-200 rounded-xl p-4 space-y-3">
      <p className="text-sm font-semibold text-gray-700">Share feedback or ideas</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What's working, what's not, or what you'd love to see next…"
        rows={4}
        maxLength={1000}
        className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand resize-none"
      />
      <div className="flex gap-2 justify-end">
        <button
          onClick={() => { setOpen(false); setText(""); }}
          className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={pending || !text.trim()}
          className="text-sm px-4 py-1.5 bg-brand text-white rounded-lg hover:bg-brand-dark disabled:opacity-60 transition"
        >
          {pending ? "Sending…" : "Send"}
        </button>
      </div>
    </div>
  );
}
