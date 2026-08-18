import { redirect } from "next/navigation";
import { Store, Wrench } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getUniversity } from "@/lib/university";
import { FAKE_BOOTHS, type BoothRow } from "@/lib/open-house";
import { BoothGrid } from "./_booth-grid";

export const dynamic = "force-dynamic";

export default async function OpenHousePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const uni = await getUniversity();
  const svc = createServiceClient();

  const { data: profile } = user
    ? await supabase.from("users").select("is_site_admin").eq("id", user.id).single()
    : { data: null };
  const isAdmin = profile?.is_site_admin ?? false;

  const { data: settings } = await svc.from("open_house_settings")
    .select("is_active, is_test_mode, starts_at, ends_at")
    .eq("university", uni)
    .maybeSingle();

  const isActive = settings?.is_active ?? false;
  const isTestMode = settings?.is_test_mode ?? false;

  // Admins in test mode bypass the active gate
  if (!isActive && !(isAdmin && isTestMode)) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center space-y-3">
        <Store className="w-10 h-10 text-gray-300" strokeWidth={1.75} />
        <h1 className="font-display text-2xl font-bold text-gray-800">Podium Open House</h1>
        <p className="text-gray-500 text-sm max-w-sm">
          Open House isn&apos;t live yet. Check back soon — all campus orgs will be showcasing their booths here for 48 hours.
        </p>
      </div>
    );
  }

  // Load real booths
  const { data: boothRows } = await svc
    .from("org_booths")
    .select("id, org_id, elevator_pitch, video_url, website_url, instagram_url, tiktok_url, cover_image_url, image_urls, category, orgs!inner(name, slug, logo_url, university)")
    .eq("orgs.university", uni);

  const booths: BoothRow[] = (boothRows ?? []).map((b) => {
    const org = b.orgs as unknown as { name: string; slug: string; logo_url: string | null };
    return {
      id: b.id,
      org_id: b.org_id,
      org_name: org.name,
      org_slug: org.slug,
      org_logo_url: org.logo_url,
      elevator_pitch: b.elevator_pitch as string | null,
      video_url: b.video_url as string | null,
      website_url: b.website_url as string | null,
      instagram_url: b.instagram_url as string | null,
      tiktok_url: b.tiktok_url as string | null,
      cover_image_url: b.cover_image_url as string | null,
      image_urls: (b.image_urls as string[]) ?? [],
      category: b.category as string | null,
    };
  });

  // In test mode for admins, append fake booths
  const allBooths: BoothRow[] = isAdmin && isTestMode
    ? [...booths, ...FAKE_BOOTHS]
    : booths;

  // Load passport stamps for current user
  const stamps = user
    ? (await supabase.from("passport_stamps").select("org_id, video_watched, link_clicked, event_added").eq("user_id", user.id)).data ?? []
    : [];

  const totalEntries = Math.min(5, stamps.reduce((acc, s) => {
    return acc + (s.video_watched ? 1 : 0) + (s.link_clicked ? 1 : 0) + (s.event_added ? 1 : 0);
  }, 0));

  const endsAt = settings?.ends_at ? new Date(settings.ends_at) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl overflow-hidden bg-gradient-to-r from-brand to-brand-dark p-6 sm:p-8 text-white">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm font-semibold opacity-75 uppercase tracking-wide flex items-center gap-1.5">
              {isAdmin && isTestMode && !isActive
                ? <><Wrench className="w-3.5 h-3.5" strokeWidth={2.5} /> Admin Test Mode</>
                : <><Store className="w-3.5 h-3.5" strokeWidth={2.5} /> Live Now</>}
            </p>
            <h1 className="font-display text-3xl font-extrabold mt-1">Podium Open House</h1>
            <p className="text-sm opacity-80 mt-1">
              Discover every org on campus — watch, explore, and find your people.
            </p>
            {endsAt && isActive && (
              <p className="text-xs opacity-60 mt-2">Open until {endsAt.toLocaleString()}</p>
            )}
          </div>
          <div className="text-center bg-white/10 rounded-xl px-4 py-3">
            <p className="text-2xl font-bold">{allBooths.length}</p>
            <p className="text-xs opacity-75">booths</p>
          </div>
        </div>
      </div>

      <BoothGrid
        booths={allBooths}
        stamps={(stamps as { org_id: string; video_watched: boolean; link_clicked: boolean; event_added: boolean }[])}
        totalEntries={totalEntries}
      />
    </div>
  );
}
