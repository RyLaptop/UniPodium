"use client";

import Link from "next/link";
import { useState } from "react";

export type CalEvent = {
  type: "meeting" | "bulletin";
  title: string;
  time: string;
  href?: string;
};

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function groupByDay(events: CalEvent[]): Map<string, CalEvent[]> {
  const map = new Map<string, CalEvent[]>();
  for (const e of events) {
    const k = dayKey(new Date(e.time));
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(e);
  }
  return map;
}

export function Calendar({ events }: { events: CalEvent[] }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState<string | null>(null);

  const byDay = groupByDay(events);
  const todayKey = dayKey(today);

  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const prev = () => {
    setSelected(null);
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };
  const next = () => {
    setSelected(null);
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };

  const selectedEvents = selected
    ? (byDay.get(selected) ?? []).sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={prev} aria-label="Previous month" className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 text-xl leading-none">‹</button>
        <h2 className="text-lg font-semibold">{MONTHS[month]} {year}</h2>
        <button onClick={next} aria-label="Next month" className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 text-xl leading-none">›</button>
      </div>

      <div className="grid grid-cols-7 text-center mb-1">
        {DAYS.map((d) => (
          <div key={d} className="text-xs font-medium text-gray-400 py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden border border-gray-200">
        {cells.map((day, i) => {
          if (day === null) return <div key={`pad-${i}`} className="bg-white min-h-[4rem]" />;
          const k = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayEvents = byDay.get(k) ?? [];
          const isToday = k === todayKey;
          const isSelected = k === selected;

          return (
            <button
              key={k}
              onClick={() => setSelected(isSelected ? null : k)}
              className={`bg-white min-h-[4rem] p-1 text-left flex flex-col hover:bg-gray-50 transition ${isSelected ? "ring-2 ring-inset ring-brand" : ""}`}
            >
              <span
                className={`text-xs w-5 h-5 flex items-center justify-center rounded-full mb-0.5 ${
                  isToday ? "bg-brand text-white font-bold" : "text-gray-700"
                }`}
              >
                {day}
              </span>
              <div className="space-y-0.5 w-full overflow-hidden">
                {dayEvents.slice(0, 2).map((e, idx) => (
                  <div
                    key={idx}
                    className={`text-xs truncate px-1 rounded ${
                      e.type === "meeting"
                        ? "bg-brand/10 text-brand-dark"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {e.title}
                  </div>
                ))}
                {dayEvents.length > 2 && (
                  <div className="text-xs text-gray-400 px-1">+{dayEvents.length - 2}</div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {selected && selectedEvents.length > 0 && (
        <div className="border border-gray-200 rounded-lg p-4 space-y-2">
          <h3 className="font-semibold text-sm">
            {new Date(selected + "T12:00:00").toLocaleDateString([], {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </h3>
          <ul className="space-y-1.5">
            {selectedEvents.map((e, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    e.type === "meeting" ? "bg-brand" : "bg-blue-500"
                  }`}
                />
                <span className="text-gray-400 w-16 shrink-0 text-xs">
                  {new Date(e.time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </span>
                {e.href ? (
                  <Link href={e.href} className="text-brand hover:underline truncate">
                    {e.title}
                  </Link>
                ) : (
                  <span className="truncate">{e.title}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {selected && selectedEvents.length === 0 && (
        <p className="text-sm text-gray-400 text-center">No events on this day.</p>
      )}

      <div className="flex gap-4 text-xs text-gray-500 pt-1">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-brand/10 border border-brand/20 inline-block" />
          Org meetings
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-blue-100 border border-blue-200 inline-block" />
          Bulletin events
        </span>
      </div>
    </div>
  );
}
