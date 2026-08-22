"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BOOTH_CATEGORIES, type BoothCategory, type BoothEventRow } from "@/lib/open-house";
import { saveBooth, addBoothEvent, deleteBoothEvent, getBoothImageUploadUrl } from "./actions";

type Props = {
  orgId: string;
  orgSlug: string;
  existing: {
    elevator_pitch: string | null;
    video_url: string | null;
    website_url: string | null;
    instagram_url: string | null;
    tiktok_url: string | null;
    cover_image_url: string | null;
    image_urls: string[];
    category: string | null;
  } | null;
  existingEvents: BoothEventRow[];
};

export function BoothForm({ orgId, orgSlug, existing, existingEvents }: Props) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  const [pitch, setPitch] = useState(existing?.elevator_pitch ?? "");
  const [videoUrl, setVideoUrl] = useState(existing?.video_url ?? "");
  const [website, setWebsite] = useState(existing?.website_url ?? "");
  const [instagram, setInstagram] = useState(existing?.instagram_url ?? "");
  const [tiktok, setTiktok] = useState(existing?.tiktok_url ?? "");
  const [coverUrl, setCoverUrl] = useState(existing?.cover_image_url ?? "");
  const [imageUrls, setImageUrls] = useState<string[]>(existing?.image_urls ?? []);
  const [category, setCategory] = useState<string>(existing?.category ?? "");
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);

  // Rush event form
  const [events, setEvents] = useState<BoothEventRow[]>(existingEvents);
  const [evTitle, setEvTitle] = useState("");
  const [evAt, setEvAt] = useState("");
  const [evLoc, setEvLoc] = useState("");
  const [evDesc, setEvDesc] = useState("");
  const [evPending, startEvTransition] = useTransition();

  const uploadImage = async (file: File, target: "cover" | "gallery") => {
    if (file.size > 10 * 1024 * 1024) { alert("Max 10MB per image."); return; }
    const setter = target === "cover" ? setUploadingCover : setUploadingImg;
    setter(true);
    try {
      const res = await getBoothImageUploadUrl(orgId, file.name, file.type);
      if (!res.ok) { alert(res.error); return; }
      await fetch(res.signedUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      if (target === "cover") setCoverUrl(res.publicUrl);
      else setImageUrls((prev) => [...prev, res.publicUrl].slice(0, 5));
    } catch {
      alert("Upload failed. Try again.");
    } finally {
      setter(false);
    }
  };

  const handleSave = () => {
    startTransition(async () => {
      const res = await saveBooth(orgId, orgSlug, {
        elevator_pitch: pitch,
        video_url: videoUrl,
        website_url: website,
        instagram_url: instagram,
        tiktok_url: tiktok,
        cover_image_url: coverUrl,
        image_urls: imageUrls,
        category,
      });
      if (!res.ok) { alert(res.error); return; }
      setSaved(true);
      router.refresh();
    });
  };

  const handleAddEvent = () => {
    if (!evTitle || !evAt) return;
    startEvTransition(async () => {
      const res = await addBoothEvent(orgId, { title: evTitle, event_at: evAt, location: evLoc, description: evDesc });
      if (!res.ok) { alert(res.error); return; }
      setEvTitle(""); setEvAt(""); setEvLoc(""); setEvDesc("");
      router.refresh();
    });
  };

  const handleDeleteEvent = (id: string) => {
    startEvTransition(async () => {
      const res = await deleteBoothEvent(id, orgId);
      if (!res.ok) { alert(res.error); return; }
      setEvents((prev) => prev.filter((e) => e.id !== id));
    });
  };

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Category */}
      <div className="space-y-2">
        <label htmlFor="booth-category" className="text-sm font-semibold text-gray-700">Category</label>
        <select id="booth-category" value={category} onChange={(e) => setCategory(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
          <option value="">— Select a category —</option>
          {BOOTH_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Elevator pitch */}
      <div className="space-y-2">
        <label htmlFor="booth-pitch" className="text-sm font-semibold text-gray-700">Elevator Pitch</label>
        <textarea id="booth-pitch" value={pitch} onChange={(e) => setPitch(e.target.value)} rows={4} maxLength={500}
          placeholder="Sell your org in 2-3 sentences. What do you do, why should someone join?"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand" />
        <p className="text-xs text-gray-400 text-right">{pitch.length}/500</p>
      </div>

      {/* Cover image */}
      <div className="space-y-2">
        <label htmlFor="booth-cover" className="text-sm font-semibold text-gray-700">Cover Image</label>
        {coverUrl && (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={coverUrl} alt="Cover" className="w-full h-40 object-cover rounded-lg border border-gray-200" />
            <button onClick={() => setCoverUrl("")} className="absolute top-2 right-2 bg-white rounded-full px-2 py-0.5 text-xs text-red-500 border border-red-200">Remove</button>
          </div>
        )}
        <input id="booth-cover" type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0], "cover")}
          className="text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-brand file:text-white file:text-sm hover:file:bg-brand-dark" />
        {uploadingCover && <p className="text-xs text-gray-400">Uploading…</p>}
      </div>

      {/* Gallery images */}
      <div className="space-y-2">
        <p className="text-sm font-semibold text-gray-700">Gallery Images <span className="font-normal text-gray-400">(up to 5)</span></p>
        {imageUrls.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {imageUrls.map((url, i) => (
              <div key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="w-full h-24 object-cover rounded-lg border border-gray-200" />
                <button onClick={() => setImageUrls((prev) => prev.filter((_, j) => j !== i))}
                  className="absolute top-1 right-1 bg-white rounded-full w-5 h-5 text-xs text-red-500 border border-red-200 flex items-center justify-center">×</button>
              </div>
            ))}
          </div>
        )}
        {imageUrls.length < 5 && (
          <>
            <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0], "gallery")}
              className="text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-gray-100 file:text-gray-700 file:text-sm hover:file:bg-gray-200" />
            {uploadingImg && <p className="text-xs text-gray-400">Uploading…</p>}
          </>
        )}
      </div>

      {/* Video */}
      <div className="space-y-2">
        <label htmlFor="booth-video" className="text-sm font-semibold text-gray-700">Video URL <span className="font-normal text-gray-400">(YouTube, TikTok, or Instagram Reel — ~30 sec)</span></label>
        <input id="booth-video" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} type="url"
          placeholder="https://youtube.com/watch?v=..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
      </div>

      {/* Links */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-gray-700">Links</p>
        <input value={website} onChange={(e) => setWebsite(e.target.value)} type="url" placeholder="Website URL" aria-label="Website URL"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
        <input value={instagram} onChange={(e) => setInstagram(e.target.value)} type="url" placeholder="Instagram URL" aria-label="Instagram URL"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
        <input value={tiktok} onChange={(e) => setTiktok(e.target.value)} type="url" placeholder="TikTok URL" aria-label="TikTok URL"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
      </div>

      {/* Rush events */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-gray-700">Rush / Interest Events</p>
        {events.length > 0 && (
          <ul className="space-y-2">
            {events.map((ev) => (
              <li key={ev.id} className="flex items-center justify-between border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <div>
                  <p className="font-medium">{ev.title}</p>
                  <p className="text-xs text-gray-500">{new Date(ev.event_at).toLocaleString()} {ev.location ? `· ${ev.location}` : ""}</p>
                </div>
                <button onClick={() => handleDeleteEvent(ev.id)} disabled={evPending}
                  className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50">Remove</button>
              </li>
            ))}
          </ul>
        )}
        <div className="border border-dashed border-gray-200 rounded-lg p-3 space-y-2">
          <p className="text-xs font-medium text-gray-500">Add event</p>
          <input value={evTitle} onChange={(e) => setEvTitle(e.target.value)} placeholder="Event title"
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-brand" />
          <input value={evAt} onChange={(e) => setEvAt(e.target.value)} type="datetime-local"
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-brand" />
          <input value={evLoc} onChange={(e) => setEvLoc(e.target.value)} placeholder="Location (optional)"
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-brand" />
          <input value={evDesc} onChange={(e) => setEvDesc(e.target.value)} placeholder="Description (optional)"
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-brand" />
          <button onClick={handleAddEvent} disabled={evPending || !evTitle || !evAt}
            className="text-sm px-3 py-1.5 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition">
            {evPending ? "Adding…" : "Add event"}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button onClick={handleSave} disabled={pending}
          className="px-6 py-2.5 bg-brand text-white rounded-lg font-medium hover:bg-brand-dark disabled:opacity-60 transition">
          {pending ? "Saving…" : "Save Booth"}
        </button>
        {saved && <p className="text-sm text-green-600">Saved!</p>}
      </div>
    </div>
  );
}
