"use client";

import { useState } from "react";
import Link from "next/link";
import { IdCard, Video, Link2, Calendar, Sparkles, Wrench } from "lucide-react";
import { BOOTH_CATEGORIES, CATEGORY_COLOR, type BoothRow } from "@/lib/open-house";
import { MatchQuiz } from "./_match-quiz";

type PassportStamp = { org_id: string; video_watched: boolean; link_clicked: boolean; event_added: boolean };

type Props = {
  booths: BoothRow[];
  stamps: PassportStamp[];
  totalEntries: number;
};

export function BoothGrid({ booths, stamps, totalEntries }: Props) {
  const [filter, setFilter] = useState<string>("all");
  const [quizOpen, setQuizOpen] = useState(false);
  const [quizResults, setQuizResults] = useState<BoothRow[] | null>(null);
  const [passportOpen, setPassportOpen] = useState(false);
  const [previewBooth, setPreviewBooth] = useState<BoothRow | null>(null);

  const stampedOrgIds = new Set(stamps.map((s) => s.org_id));

  const displayed = (quizResults ?? booths).filter((b) =>
    filter === "all" || b.category === filter
  );

  const handleQuizResults = (matched: BoothRow[]) => {
    setQuizResults(matched);
    setQuizOpen(false);
    setFilter("all");
  };

  const handleBoothClick = (booth: BoothRow, e: React.MouseEvent) => {
    if (booth.isFake) {
      e.preventDefault();
      setPreviewBooth(booth);
    }
  };

  return (
    <>
      {quizOpen && (
        <MatchQuiz booths={booths} onResults={handleQuizResults} onClose={() => setQuizOpen(false)} />
      )}

      {/* Fake booth preview modal (admin test mode only) */}
      {previewBooth && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                  style={{ backgroundColor: CATEGORY_COLOR[previewBooth.category ?? "Other"] ?? "#6B7280" }}>
                  {previewBooth.org_name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  {previewBooth.category && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: CATEGORY_COLOR[previewBooth.category] ?? "#6B7280" }}>
                      {previewBooth.category}
                    </span>
                  )}
                  <h2 className="text-lg font-bold mt-1">{previewBooth.org_name}</h2>
                  <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                    <Wrench className="w-3 h-3" strokeWidth={2.5} /> Test booth
                  </span>
                </div>
              </div>
              <button onClick={() => setPreviewBooth(null)} aria-label="Close" className="text-gray-400 hover:text-gray-600 text-xl shrink-0">✕</button>
            </div>

            {previewBooth.elevator_pitch && (
              <p className="text-sm text-gray-700 leading-relaxed">{previewBooth.elevator_pitch}</p>
            )}

            <div className="flex gap-3 text-xs text-gray-400">
              <span className="inline-flex items-center gap-1"><Video className="w-3.5 h-3.5" strokeWidth={2.25} /> Video stamp</span>
              <span className="inline-flex items-center gap-1"><Link2 className="w-3.5 h-3.5" strokeWidth={2.25} /> Link stamp</span>
              <span className="inline-flex items-center gap-1"><Calendar className="w-3.5 h-3.5" strokeWidth={2.25} /> Event stamp</span>
            </div>

            {(previewBooth.website_url || previewBooth.instagram_url || previewBooth.tiktok_url) && (
              <div className="flex flex-wrap gap-2">
                {previewBooth.website_url && (
                  <span className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-500">Website ↗</span>
                )}
                {previewBooth.instagram_url && (
                  <span className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-500">Instagram ↗</span>
                )}
                {previewBooth.tiktok_url && (
                  <span className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-500">TikTok ↗</span>
                )}
              </div>
            )}

            <p className="text-xs text-gray-400 text-center pt-2 border-t border-gray-100">
              This is a preview of a test booth. Real booths will have images, videos, and active links.
            </p>
          </div>
        </div>
      )}

      {/* Passport overlay */}
      {passportOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg font-bold flex items-center gap-1.5">
                  <IdCard className="w-4.5 h-4.5" strokeWidth={2.25} /> Your Passport
                </h2>
                <p className="text-sm text-gray-500">
                  {totalEntries}/5 prize pool {totalEntries === 1 ? "entry" : "entries"} earned
                </p>
              </div>
              <button onClick={() => setPassportOpen(false)} aria-label="Close" className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div className="bg-brand h-2 rounded-full transition-all" style={{ width: `${(totalEntries / 5) * 100}%` }} />
            </div>
            {stamps.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No stamps yet — visit booths and watch videos, click links, or add events to collect stamps.</p>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {stamps.map((s) => {
                  const booth = booths.find((b) => b.org_id === s.org_id);
                  if (!booth) return null;
                  const color = CATEGORY_COLOR[booth.category ?? "Other"] ?? "#6B7280";
                  return (
                    <div key={s.org_id} className="flex flex-col items-center gap-1">
                      <div className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xs font-bold text-center leading-tight p-1"
                        style={{ backgroundColor: color }}>
                        {booth.org_logo_url
                          /* eslint-disable-next-line @next/next/no-img-element */
                          ? <img src={booth.org_logo_url} alt="" className="w-full h-full rounded-full object-cover" />
                          : booth.org_name.slice(0, 2).toUpperCase()}
                      </div>
                      <p className="text-xs text-center text-gray-600 leading-tight">{booth.org_name}</p>
                      <p className="text-[10px] text-gray-400 flex items-center justify-center gap-1">
                        {s.video_watched && <Video className="w-2.5 h-2.5" strokeWidth={2.5} />}
                        {s.link_clicked && <Link2 className="w-2.5 h-2.5" strokeWidth={2.5} />}
                        {s.event_added && <Calendar className="w-2.5 h-2.5" strokeWidth={2.5} />}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => { setFilter("all"); setQuizResults(null); }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${filter === "all" && !quizResults ? "bg-brand text-white border-brand" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
            All
          </button>
          {BOOTH_CATEGORIES.map((cat) => (
            <button key={cat} onClick={() => { setFilter(cat); setQuizResults(null); }}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${filter === cat && !quizResults ? "bg-brand text-white border-brand" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
              {cat}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {quizResults && (
            <button onClick={() => setQuizResults(null)} className="text-xs text-gray-500 hover:text-gray-700 underline">Clear match</button>
          )}
          <button onClick={() => setQuizOpen(true)}
            className="px-4 py-2 bg-brand text-white rounded-full text-sm font-semibold hover:bg-brand-dark transition inline-flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" strokeWidth={2.5} /> Match Me
          </button>
          <button onClick={() => setPassportOpen(true)}
            className="relative px-4 py-2 border border-brand text-brand rounded-full text-sm font-semibold hover:bg-brand/5 transition inline-flex items-center gap-1.5">
            <IdCard className="w-3.5 h-3.5" strokeWidth={2.5} /> Passport
            {totalEntries > 0 && (
              <span className="absolute -top-1 -right-1 bg-brand text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                {totalEntries}
              </span>
            )}
          </button>
        </div>
      </div>

      {quizResults && (
        <div className="bg-brand/5 border border-brand/20 rounded-xl px-4 py-2 text-sm text-brand flex items-center gap-1.5 flex-wrap">
          <Sparkles className="w-3.5 h-3.5 shrink-0" strokeWidth={2.5} />
          Showing {quizResults.length} best {quizResults.length === 1 ? "match" : "matches"}.{" "}
          <button onClick={() => setQuizResults(null)} className="underline">See all orgs</button>
        </div>
      )}

      {/* Grid */}
      {displayed.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-12">No booths in this category yet.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayed.map((booth) => {
            const color = CATEGORY_COLOR[booth.category ?? "Other"] ?? "#6B7280";
            const hasStamp = stampedOrgIds.has(booth.org_id);
            return (
              <Link
                key={booth.id}
                href={booth.isFake ? "#" : `/open-house/${booth.org_slug}`}
                onClick={(e) => handleBoothClick(booth, e)}
                className="block border border-gray-200 rounded-2xl overflow-hidden hover:shadow-md hover:border-brand/30 transition group cursor-pointer"
              >
                {/* Cover */}
                <div className="relative h-36 w-full flex items-center justify-center"
                  style={{ backgroundColor: booth.cover_image_url ? undefined : color }}>
                  {booth.cover_image_url
                    /* eslint-disable-next-line @next/next/no-img-element */
                    ? <img src={booth.cover_image_url} alt="" className="w-full h-full object-cover" />
                    : <span className="text-white font-bold text-2xl opacity-60">{booth.org_name.slice(0, 2).toUpperCase()}</span>
                  }
                  {hasStamp && (
                    <span className="absolute top-2 right-2 bg-white rounded-full px-2 py-0.5 text-xs font-semibold text-brand shadow">
                      ✓ Stamped
                    </span>
                  )}
                  {booth.isFake && (
                    <span className="absolute top-2 left-2 bg-black/50 rounded-full px-2 py-0.5 text-xs text-white">Test</span>
                  )}
                </div>
                {/* Info */}
                <div className="p-4 space-y-1.5">
                  {booth.category && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: color }}>
                      {booth.category}
                    </span>
                  )}
                  <h3 className="font-bold text-gray-900 group-hover:text-brand transition">{booth.org_name}</h3>
                  {booth.elevator_pitch && (
                    <p className="text-xs text-gray-500 line-clamp-2">{booth.elevator_pitch}</p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
