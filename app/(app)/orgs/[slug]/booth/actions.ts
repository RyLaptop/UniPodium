"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isOrgStaff } from "@/lib/auth/org-access";
import { validateImageUpload } from "@/lib/utils";

export async function saveBooth(orgId: string, orgSlug: string, data: {
  elevator_pitch: string;
  video_url: string;
  website_url: string;
  instagram_url: string;
  tiktok_url: string;
  cover_image_url: string;
  image_urls: string[];
  category: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };
  if (!await isOrgStaff(supabase, orgId, user.id)) return { ok: false as const, error: "Staff only" };

  const svc = createServiceClient();
  const { error } = await svc.from("org_booths").upsert(
    { org_id: orgId, ...data, updated_at: new Date().toISOString() },
    { onConflict: "org_id" }
  );
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/open-house/${orgSlug}`);
  revalidatePath(`/orgs/${orgSlug}/booth`);
  return { ok: true as const };
}

export async function addBoothEvent(orgId: string, event: {
  title: string; event_at: string; location: string; description: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };
  if (!await isOrgStaff(supabase, orgId, user.id)) return { ok: false as const, error: "Staff only" };

  const svc = createServiceClient();
  const { error } = await svc.from("booth_events").insert({ org_id: orgId, ...event });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function deleteBoothEvent(eventId: string, orgId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };
  if (!await isOrgStaff(supabase, orgId, user.id)) return { ok: false as const, error: "Staff only" };

  const svc = createServiceClient();
  const { error } = await svc.from("booth_events").delete().eq("id", eventId).eq("org_id", orgId);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function getBoothImageUploadUrl(orgId: string, fileName: string, contentType: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };
  if (!await isOrgStaff(supabase, orgId, user.id)) return { ok: false as const, error: "Staff only" };
  const uploadError = validateImageUpload({ type: contentType });
  if (uploadError) return { ok: false as const, error: uploadError };

  const ext = fileName.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${orgId}/${Date.now()}.${ext}`;
  const svc = createServiceClient();
  const { data, error } = await svc.storage.from("booth-images").createSignedUploadUrl(path);
  if (error) return { ok: false as const, error: error.message };

  const { data: urlData } = svc.storage.from("booth-images").getPublicUrl(path);
  return { ok: true as const, signedUrl: data.signedUrl, path, publicUrl: urlData.publicUrl };
}
