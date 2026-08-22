"use client";

import { useState } from "react";
import { QUIZ_QUESTIONS, BOOTH_CATEGORIES } from "@/lib/open-house";
import type { BoothRow } from "@/lib/open-house";

type Props = {
  booths: BoothRow[];
  onResults: (matched: BoothRow[]) => void;
  onClose: () => void;
};

export function MatchQuiz({ booths, onResults, onClose }: Props) {
  const [step, setStep] = useState(0);
  const [scores, setScores] = useState<Record<string, number>>({});

  const q = QUIZ_QUESTIONS[step];

  const pick = (cats: readonly string[]) => {
    const newScores = { ...scores };
    for (const cat of cats) newScores[cat] = (newScores[cat] ?? 0) + 1;

    if (step < QUIZ_QUESTIONS.length - 1) {
      setScores(newScores);
      setStep((s) => s + 1);
    } else {
      const ranked = Object.entries(newScores).sort((a, b) => b[1] - a[1]);
      const topCats = new Set(ranked.slice(0, 3).map(([c]) => c));
      const matched = booths.filter((b) => b.category && topCats.has(b.category));
      // Fall back to all booths if nothing matches (e.g. no booths in those categories yet)
      onResults(matched.length > 0 ? matched : booths);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-brand font-semibold uppercase tracking-wide">Question {step + 1} of {QUIZ_QUESTIONS.length}</p>
            <div className="flex gap-1 mt-1">
              {QUIZ_QUESTIONS.map((_, i) => (
                <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-brand" : "bg-gray-200"}`} />
              ))}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
        </div>

        <h2 className="text-lg font-bold text-gray-900">{q.q}</h2>

        <div className="grid grid-cols-1 gap-2">
          {q.options.map((opt) => (
            <button
              key={opt.label}
              onClick={() => pick(opt.cats)}
              className="text-left px-4 py-3 border border-gray-200 rounded-xl text-sm hover:border-brand hover:bg-brand/5 transition-colors"
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
