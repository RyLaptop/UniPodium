"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import { UNIVERSITIES } from "@/lib/university-data";
import type { University } from "@/lib/university-data";
import { MapWrapper } from "./_map-wrapper";
import { AdBanner } from "@/components/ad-banner";

const VALID_UNI_KEYS = Object.keys(UNIVERSITIES) as University[];

function getUniFromCookie(): University {
  if (typeof document === "undefined") return "tamu";
  const match = document.cookie.match(/(?:^|;\s*)uni=([^;]+)/);
  const val = match?.[1] as University | undefined;
  return val && VALID_UNI_KEYS.includes(val) ? val : "tamu";
}

type MapMeeting = {
  id: string;
  title: string;
  org_name: string;
  org_slug: string;
  location: string | null;
  starts_at: string;
  lat: number | null;
  lng: number | null;
};

export function MapPageClient() {
  const [meetings, setMeetings] = useState<MapMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uniName, setUniName] = useState("my university");

  useEffect(() => {
    const uni = getUniFromCookie();
    setUniName(UNIVERSITIES[uni].name);

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }

        const [{ data: memberships }, { data: myRequests }] = await Promise.all([
          supabase.from("org_members")
            .select("org_id, orgs!inner(university)")
            .eq("user_id", user.id)
            .eq("status", "active")
            .eq("orgs.university", uni),
          supabase.from("speak_requests").select("meeting_id").eq("requester_user_id", user.id).eq("status", "approved"),
        ]);

        const orgIds = (memberships ?? []).map((m) => m.org_id as string);
        const speakingMeetingIds = (myRequests ?? []).map((r) => r.meeting_id as string);

        const queries: Promise<{ data: unknown[] | null }>[] = [];
        const now = new Date().toISOString();

        if (orgIds.length > 0) {
          queries.push(
            supabase.from("meetings")
              .select("id, title, location, starts_at, org_id, orgs(name, slug)")
              .in("org_id", orgIds)
              .gte("starts_at", now)
              .order("starts_at", { ascending: true })
              .limit(100) as unknown as Promise<{ data: unknown[] | null }>
          );
        }

        if (speakingMeetingIds.length > 0) {
          queries.push(
            supabase.from("meetings")
              .select("id, title, location, starts_at, org_id, orgs(name, slug)")
              .in("id", speakingMeetingIds)
              .gte("starts_at", now)
              .order("starts_at", { ascending: true })
              .limit(50) as unknown as Promise<{ data: unknown[] | null }>
          );
        }

        const results = queries.length > 0 ? await Promise.all(queries) : [];
        const allRows = results.flatMap((r) => (r.data ?? []) as Record<string, unknown>[]);

        // Keep only the soonest upcoming meeting per org
        const byOrg = new Map<string, Record<string, unknown>>();
        for (const row of allRows) {
          const slug = (row.orgs as { name: string; slug: string } | null)?.slug ?? "";
          const existing = byOrg.get(slug);
          if (!existing || (row.starts_at as string) < (existing.starts_at as string)) {
            byOrg.set(slug, row);
          }
        }

        const out: MapMeeting[] = [];
        for (const row of byOrg.values()) {
          const org = row.orgs as { name: string; slug: string } | null;
          out.push({
            id: row.id as string,
            title: row.title as string,
            org_name: org?.name ?? "",
            org_slug: org?.slug ?? "",
            location: (row.location as string | null) ?? null,
            starts_at: row.starts_at as string,
            lat: null,
            lng: null,
          });
        }
        out.sort((a, b) => a.starts_at.localeCompare(b.starts_at));

        setMeetings(out);
      } catch (err) {
        console.error("[map]", err);
        setError("Could not load map data.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold">Campus map</h1>
          <p className="text-gray-600 mt-1 text-sm">Upcoming meetings for orgs you&apos;re in or speaking at.</p>
        </div>
        <div className="w-full rounded-xl bg-gray-100 animate-pulse" style={{ height: 420 }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Campus map</h1>
        <div className="border border-red-200 bg-red-50 rounded-xl p-6 text-center text-red-700 text-sm">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold">Campus map</h1>
        <p className="text-gray-600 mt-1 text-sm">Upcoming meetings for orgs you&apos;re in or speaking at.</p>
      </div>

      {meetings.length === 0 ? (
        <>
          <div className="border border-dashed border-gray-300 rounded-xl p-8 text-center text-gray-500">
            <p>No upcoming meetings. <Link href="/orgs" className="text-brand hover:underline">Browse orgs</Link> to join some.</p>
          </div>
          <AdBanner variant="apartment" />
        </>
      ) : (
        <div className="space-y-4">
          <div className="isolate w-full rounded-xl overflow-hidden border border-gray-200" style={{ height: 420 }}>
            <MapWrapper meetings={meetings} />
          </div>
          <AdBanner variant="apartment" />
          <div className="grid sm:grid-cols-2 gap-3">
            {meetings.map((m) => (
              <Link
                key={m.id}
                href={`/orgs/${m.org_slug}/meetings/${m.id}`}
                className="border border-gray-200 rounded-lg p-3 hover:border-brand transition"
              >
                <p className="font-medium text-sm truncate">{m.org_name} · {m.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {new Date(m.starts_at).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </p>
                {m.location && (
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(m.location + " " + uniName)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs text-brand hover:underline mt-0.5 flex items-center gap-1"
                  >
                    <MapPin className="w-3 h-3 shrink-0" strokeWidth={2.5} />
                    {m.location}
                  </a>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
