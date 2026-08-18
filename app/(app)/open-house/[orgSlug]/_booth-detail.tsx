"use client";

import { useState } from "react";
import Link from "next/link";
import { Video, Link2, Calendar, IdCard, Check } from "lucide-react";
import { CATEGORY_COLOR, type BoothRow, type BoothEventRow } from "@/lib/open-house";
import { stampPassport } from "../actions";

type Stamp = { video_watched: boolean; link_clicked: boolean; event_added: boolean } | null;

type Props = {
  booth: BoothRow;
  events: BoothEventRow[];
  initialStamp: Stamp;
  isAuthed: boolean;
};

function getYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

export function BoothDetail({ booth, events, initialStamp, isAuthed }: Props) {
  const [stamp, setStamp] = useState<Stamp>(initialStamp);
  const [galleryIdx, setGalleryIdx] = useState(0);
  const [videoStamped, setVideoStamped] = useState(initialStamp?.video_watched ?? false);
  const color = CATEGORY_COLOR[booth.category ?? "Other"] ?? "#6B7280";

  const doStamp = async (action: "video" | "link" | "event") => {
    if (!isAuthed) return;
    const res = await stampPassport(booth.org_id, action);
    if (res.ok) {
      setStamp((prev) => ({
        video_watched: prev?.video_watched ?? false,
        link_clicked: prev?.link_clicked ?? false,
        event_added: prev?.event_added ?? false,
        ...(action === "video" ? { video_watched: true } : {}),
        ...(action === "link" ? { link_clicked: true } : {}),
        ...(action === "event" ? { event_added: true } : {}),
      }));
      if (action === "video") setVideoStamped(true);
    }
  };

  const ytId = booth.video_url ? getYouTubeId(booth.video_url) : null;
  const allImages = [
    ...(booth.cover_image_url ? [booth.cover_image_url] : []),
    ...booth.image_urls,
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <Link href="/open-house" className="text-sm text-gray-500 hover:text-brand">← Open House</Link>

      {/* Header */}
      <div className="flex items-start gap-4">
        {booth.org_logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={booth.org_logo_url} alt="" className="w-16 h-16 rounded-full object-cover border border-gray-200 shrink-0" />
        ) : (
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl shrink-0"
            style={{ backgroundColor: color }}>
            {booth.org_name.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div>
          {booth.category && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: color }}>
              {booth.category}
            </span>
          )}
          <h1 className="text-2xl font-bold mt-1">{booth.org_name}</h1>
        </div>
      </div>

      {/* Passport stamp tracker */}
      {isAuthed && (
        <div className="flex gap-4 text-xs bg-gray-50 rounded-xl px-4 py-3">
          <span className={`inline-flex items-center gap-1 ${stamp?.video_watched ? "text-brand font-semibold" : "text-gray-400"}`}>
            <Video className="w-3.5 h-3.5" strokeWidth={2.25} /> Video{stamp?.video_watched && <Check className="w-3 h-3" strokeWidth={3} />}
          </span>
          <span className={`inline-flex items-center gap-1 ${stamp?.link_clicked ? "text-brand font-semibold" : "text-gray-400"}`}>
            <Link2 className="w-3.5 h-3.5" strokeWidth={2.25} /> Link{stamp?.link_clicked && <Check className="w-3 h-3" strokeWidth={3} />}
          </span>
          <span className={`inline-flex items-center gap-1 ${stamp?.event_added ? "text-brand font-semibold" : "text-gray-400"}`}>
            <Calendar className="w-3.5 h-3.5" strokeWidth={2.25} /> Event{stamp?.event_added && <Check className="w-3 h-3" strokeWidth={3} />}
          </span>
          {(stamp?.video_watched || stamp?.link_clicked || stamp?.event_added) && (
            <span className="ml-auto text-brand font-semibold inline-flex items-center gap-1">
              <IdCard className="w-3.5 h-3.5" strokeWidth={2.5} /> Stamped!
            </span>
          )}
        </div>
      )}

      {/* Gallery */}
      {allImages.length > 0 && (
        <div className="space-y-2">
          <div className="rounded-xl overflow-hidden h-60 w-full relative bg-gray-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={allImages[galleryIdx]} alt="" className="w-full h-full object-cover" />
            {allImages.length > 1 && (
              <>
                <button
                  onClick={() => setGalleryIdx((i) => (i - 1 + allImages.length) % allImages.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm hover:bg-black/60 transition"
                >‹</button>
                <button
                  onClick={() => setGalleryIdx((i) => (i + 1) % allImages.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm hover:bg-black/60 transition"
                >›</button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                  {allImages.map((_, i) => (
                    <button key={i} onClick={() => setGalleryIdx(i)}
                      className={`w-1.5 h-1.5 rounded-full transition ${i === galleryIdx ? "bg-white" : "bg-white/50"}`} />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Elevator pitch */}
      {booth.elevator_pitch && (
        <p className="text-gray-700 leading-relaxed">{booth.elevator_pitch}</p>
      )}

      {/* Video */}
      {booth.video_url && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Video</h2>
            {isAuthed && !videoStamped && (
              <button onClick={() => doStamp("video")}
                className="text-xs text-brand hover:underline">
                Mark as watched (+1 entry)
              </button>
            )}
          </div>
          {ytId ? (
            <div className="rounded-xl overflow-hidden aspect-video bg-gray-100"
              onClick={() => { if (!videoStamped) doStamp("video"); }}>
              <iframe
                src={`https://www.youtube.com/embed/${ytId}`}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <a href={booth.video_url} target="_blank" rel="noopener noreferrer"
              onClick={() => doStamp("video")}
              className="inline-flex items-center gap-1 text-brand hover:underline text-sm">
              Watch video ↗
            </a>
          )}
        </div>
      )}

      {/* Links */}
      {(booth.website_url || booth.instagram_url || booth.tiktok_url) && (
        <div className="space-y-2">
          <h2 className="font-semibold text-gray-800">Links</h2>
          <div className="flex flex-wrap gap-2">
            {booth.website_url && (
              <a href={booth.website_url} target="_blank" rel="noopener noreferrer"
                onClick={() => doStamp("link")}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-700 hover:border-brand hover:text-brand transition">
                Website ↗
              </a>
            )}
            {booth.instagram_url && (
              <a href={booth.instagram_url} target="_blank" rel="noopener noreferrer"
                onClick={() => doStamp("link")}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-700 hover:border-brand hover:text-brand transition">
                Instagram ↗
              </a>
            )}
            {booth.tiktok_url && (
              <a href={booth.tiktok_url} target="_blank" rel="noopener noreferrer"
                onClick={() => doStamp("link")}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-700 hover:border-brand hover:text-brand transition">
                TikTok ↗
              </a>
            )}
          </div>
          {isAuthed && !stamp?.link_clicked && (
            <p className="text-xs text-gray-400">Click any link to earn a passport stamp (+1 entry)</p>
          )}
        </div>
      )}

      {/* Rush events */}
      {events.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-semibold text-gray-800">Rush & Interest Events</h2>
          <ul className="space-y-3">
            {events.map((ev) => {
              const dt = new Date(ev.event_at);
              const startStr = dt.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
              const endDt = new Date(dt.getTime() + 60 * 60 * 1000);
              const endStr = endDt.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
              const calUrl = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(ev.title)}&dates=${startStr}/${endStr}&details=${encodeURIComponent(ev.description ?? "")}&location=${encodeURIComponent(ev.location ?? "")}`;
              return (
                <li key={ev.id} className="border border-gray-200 rounded-xl p-4 space-y-1.5">
                  <p className="font-medium">{ev.title}</p>
                  <p className="text-sm text-gray-500">
                    {dt.toLocaleString()}{ev.location ? ` · ${ev.location}` : ""}
                  </p>
                  {ev.description && <p className="text-sm text-gray-600">{ev.description}</p>}
                  <a href={calUrl} target="_blank" rel="noopener noreferrer"
                    onClick={() => doStamp("event")}
                    className="inline-flex items-center gap-1 text-xs text-brand hover:underline">
                    <Calendar className="w-3.5 h-3.5" strokeWidth={2.25} />
                    Add to Google Calendar{isAuthed && !stamp?.event_added ? " (+1 entry)" : ""}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {!isAuthed && (
        <p className="text-sm text-gray-400 text-center py-4 border border-dashed border-gray-200 rounded-xl">
          <Link href="/login" className="text-brand hover:underline">Sign in</Link> to collect passport stamps and enter the prize pool.
        </p>
      )}
    </div>
  );
}
