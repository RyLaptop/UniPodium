"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UNIVERSITIES, type University } from "@/lib/university-data";

const UNI_LIST = Object.entries(UNIVERSITIES) as [University, typeof UNIVERSITIES[University]][];

export function UniSelector({ currentUni }: { currentUni: University | null }) {
  const [selected, setSelected] = useState<University | null>(currentUni);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const filtered = search.trim()
    ? UNI_LIST.filter(([, u]) =>
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.label.toLowerCase().includes(search.toLowerCase()) ||
        u.shortName.toLowerCase().includes(search.toLowerCase())
      )
    : UNI_LIST;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setLoading(true);
    document.cookie = `uni=${selected}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    document.documentElement.setAttribute("data-uni", selected);
    router.push("/dashboard");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search your university…"
        className="up-input text-center"
      />

      <div className="grid grid-cols-2 gap-2.5 max-h-72 overflow-y-auto p-1.5 -m-1.5">
        {filtered.map(([key, uni]) => {
          const isSelected = selected === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelected(key)}
              style={{
                backgroundColor: uni.primary,
                color: uni.secondary,
                boxShadow: isSelected
                  ? `0 0 0 2px white, 0 0 0 4px ${uni.primary}`
                  : "0 1px 2px rgba(15,23,42,0.08)",
              }}
              className="relative px-3.5 py-3.5 rounded-xl text-left transition-all duration-150 hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0 active:scale-[0.98]"
            >
              <p className="font-display font-bold text-sm leading-tight">{uni.label}</p>
              <p className="text-xs opacity-75 leading-tight mt-0.5 truncate">{uni.shortName}</p>
              {isSelected && (
                <span
                  className="absolute top-2 right-2.5 text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: uni.secondary, color: uni.primary }}
                >
                  ✓
                </span>
              )}
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="col-span-2 text-center text-sm text-gray-400 py-4">No match found</p>
        )}
      </div>

      <button
        type="submit"
        disabled={!selected || loading}
        className="up-btn w-full text-white"
        style={{
          backgroundColor: selected ? UNIVERSITIES[selected].primary : "#3B82F6",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        {loading ? "Loading…" : selected ? `Browse as ${UNIVERSITIES[selected].label} →` : "Select a university to continue"}
      </button>

      <div className="flex gap-3 pt-1">
        <Link href="/login" className="up-btn-secondary flex-1">
          Sign in
        </Link>
        <Link
          href="/login?mode=signup"
          className="up-btn flex-1 bg-gray-900 text-white hover:bg-gray-800"
        >
          Sign up
        </Link>
      </div>
    </form>
  );
}
