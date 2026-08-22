"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { notify } from "@/lib/notifications";
import { sendEmail } from "@/lib/email/send";
import { bulletinDecisionEmail } from "@/lib/email/templates";
import { getUniversity } from "@/lib/university";
import { validateImageUpload } from "@/lib/utils";

export type SubmitBulletinResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function submitBulletinPost(
  _prev: SubmitBulletinResult | null,
  formData: FormData
): Promise<SubmitBulletinResult> {
  const eventTitle = String(formData.get("event_title") ?? "").trim();
  const eventDescription = String(formData.get("event_description") ?? "").trim();
  const eventAtStr = String(formData.get("event_at") ?? "").trim();
  const eventLocation = String(formData.get("event_location") ?? "").trim();
  const orgId = String(formData.get("org_id") ?? "").trim();
  const websiteUrl = String(formData.get("website_url") ?? "").trim() || null;
  const instagramUrl = String(formData.get("instagram_url") ?? "").trim() || null;
  const thumbnailFile = formData.get("thumbnail") as File | null;
  const bannerFile = formData.get("banner") as File | null;
  const isUniversityPost = orgId === "__university__";

  if (eventTitle.length < 3) {
    return { ok: false, error: "Title is too short (min 3 chars)." };
  }
  if (!eventAtStr) {
    return { ok: false, error: "Event date/time is required." };
  }
  const eventAt = new Date(eventAtStr);
  if (isNaN(eventAt.getTime())) {
    return { ok: false, error: "Invalid date/time." };
  }
  if (eventAt.getTime() < Date.now() - 60 * 60 * 1000) {
    return { ok: false, error: "Event date is in the past." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const uni = await getUniversity();

  const { data: userProfile } = await supabase.from("users").select("is_site_admin").eq("id", user.id).single();
  const submitterIsAdmin = userProfile?.is_site_admin ?? false;

  if (orgId && !isUniversityPost) {
    if (!submitterIsAdmin) {
      const { data: mem } = await supabase
        .from("org_members")
        .select("role")
        .eq("org_id", orgId)
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();
      if (!mem || !["officer", "director"].includes(mem.role)) {
        return { ok: false, error: "You must be an officer or director to submit on behalf of an org." };
      }
    }
  }

  const svc = createServiceClient();

  const autoApprove = submitterIsAdmin;

  const { data, error } = await supabase
    .from("bulletin_posts")
    .insert({
      submitter_id: user.id,
      org_id: isUniversityPost ? null : (orgId || null),
      is_university_post: isUniversityPost,
      event_title: eventTitle,
      event_description: eventDescription || null,
      event_at: eventAt.toISOString(),
      event_location: eventLocation || null,
      website_url: websiteUrl,
      instagram_url: instagramUrl,
      status: autoApprove ? "approved" : "pending",
      university: uni,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "Insert failed." };

  // Upload images to storage and update post with URLs
  const postId = data.id;
  const imageUpdates: { thumbnail_url?: string; banner_url?: string } = {};

  async function uploadImage(file: File, slot: "thumbnail" | "banner") {
    if (!file || file.size === 0) return;
    if (validateImageUpload(file)) return;
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${postId}/${slot}.${ext}`;
    const bytes = await file.arrayBuffer();
    const { error: uploadErr } = await svc.storage
      .from("bulletin-images")
      .upload(path, bytes, { contentType: file.type, upsert: true });
    if (!uploadErr) {
      const { data: { publicUrl } } = svc.storage.from("bulletin-images").getPublicUrl(path);
      imageUpdates[`${slot}_url` as "thumbnail_url" | "banner_url"] = publicUrl;
    }
  }

  await Promise.all([
    thumbnailFile && thumbnailFile.size > 0 ? uploadImage(thumbnailFile, "thumbnail") : Promise.resolve(),
    bannerFile && bannerFile.size > 0 ? uploadImage(bannerFile, "banner") : Promise.resolve(),
  ]);

  if (Object.keys(imageUpdates).length > 0) {
    await svc.from("bulletin_posts").update(imageUpdates).eq("id", postId);
  }

  revalidatePath("/bulletin");
  redirect("/bulletin?submitted=1");
}

export async function cancelBulletinPost(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  const { data: profile } = await supabase.from("users").select("is_site_admin").eq("id", user.id).single();
  const isAdmin = profile?.is_site_admin ?? false;

  const svc = createServiceClient();
  const { data: post } = await svc.from("bulletin_posts").select("submitter_id, org_id").eq("id", id).single();
  if (!post) return { ok: false as const, error: "Post not found." };

  if (!isAdmin) {
    const isSubmitter = post.submitter_id === user.id;
    let isOrgStaff = false;
    if (post.org_id) {
      const { data: mem } = await supabase.from("org_members").select("role")
        .eq("org_id", post.org_id).eq("user_id", user.id).eq("status", "active").maybeSingle();
      isOrgStaff = mem?.role === "director";
    }
    if (!isSubmitter && !isOrgStaff) return { ok: false as const, error: "Not authorized." };
  }

  const { error } = await svc.from("bulletin_posts").delete().eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/bulletin");
  return { ok: true as const };
}

export type EditBulletinResult = { ok: true } | { ok: false; error: string };

export async function editBulletinPost(
  _prev: EditBulletinResult | null,
  formData: FormData
): Promise<EditBulletinResult> {
  const id = String(formData.get("post_id") ?? "").trim();
  const title = String(formData.get("event_title") ?? "").trim();
  const description = String(formData.get("event_description") ?? "").trim();
  const eventAtStr = String(formData.get("event_at") ?? "").trim();
  const location = String(formData.get("event_location") ?? "").trim();
  const websiteUrl = String(formData.get("website_url") ?? "").trim() || null;
  const instagramUrl = String(formData.get("instagram_url") ?? "").trim() || null;
  const orgId = String(formData.get("org_id") ?? "").trim();
  const thumbnailFile = formData.get("thumbnail") as File | null;
  const bannerFile = formData.get("banner") as File | null;
  const isUniversityPost = orgId === "__university__";

  if (!id) return { ok: false, error: "Missing post ID." };
  if (title.length < 3) return { ok: false, error: "Title too short." };
  const eventDate = new Date(eventAtStr);
  if (isNaN(eventDate.getTime())) return { ok: false, error: "Invalid date." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { data: profile } = await supabase.from("users").select("is_site_admin").eq("id", user.id).single();
  const isAdmin = profile?.is_site_admin ?? false;

  const svc = createServiceClient();
  const { data: post } = await svc.from("bulletin_posts").select("submitter_id, org_id").eq("id", id).single();
  if (!post) return { ok: false, error: "Post not found." };

  if (!isAdmin) {
    const isSubmitter = post.submitter_id === user.id;
    let isOrgStaff = false;
    if (post.org_id) {
      const { data: mem } = await supabase.from("org_members").select("role")
        .eq("org_id", post.org_id).eq("user_id", user.id).eq("status", "active").maybeSingle();
      isOrgStaff = mem?.role === "director";
    }
    if (!isSubmitter && !isOrgStaff) return { ok: false, error: "Not authorized." };

    if (orgId && !isUniversityPost) {
      const { data: mem } = await supabase.from("org_members").select("role")
        .eq("org_id", orgId).eq("user_id", user.id).eq("status", "active").maybeSingle();
      if (!mem || !["officer", "director"].includes(mem.role)) {
        return { ok: false, error: "You must be an officer or director to submit on behalf of that org." };
      }
    }
  }

  const updates: Record<string, unknown> = {
    event_title: title,
    event_description: description || null,
    event_at: eventDate.toISOString(),
    event_location: location || null,
    website_url: websiteUrl,
    instagram_url: instagramUrl,
    org_id: isUniversityPost ? null : (orgId || null),
    is_university_post: isUniversityPost,
  };

  // Upload images if provided
  const postId = id;
  async function uploadImage(file: File, slot: "thumbnail" | "banner") {
    if (!file || file.size === 0) return;
    if (validateImageUpload(file)) return;
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${postId}/${slot}.${ext}`;
    const bytes = await file.arrayBuffer();
    const { error: uploadErr } = await svc.storage
      .from("bulletin-images")
      .upload(path, bytes, { contentType: file.type, upsert: true });
    if (!uploadErr) {
      const { data: { publicUrl } } = svc.storage.from("bulletin-images").getPublicUrl(path);
      updates[`${slot}_url`] = publicUrl;
    }
  }

  await Promise.all([
    thumbnailFile && thumbnailFile.size > 0 ? uploadImage(thumbnailFile, "thumbnail") : Promise.resolve(),
    bannerFile && bannerFile.size > 0 ? uploadImage(bannerFile, "banner") : Promise.resolve(),
  ]);

  const { error } = await svc.from("bulletin_posts").update(updates).eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/bulletin");
  revalidatePath(`/bulletin/${id}`);
  return { ok: true };
}

export async function clearBulletinPost(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  const svc = createServiceClient();
  const { error, count } = await svc
    .from("bulletin_posts")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("submitter_id", user.id)
    .eq("status", "denied");

  if (error) return { ok: false as const, error: error.message };
  if (count === 0) return { ok: false as const, error: "Post not found or already cleared." };

  revalidatePath("/bulletin");
  return { ok: true as const };
}

export async function reviewBulletinPost(
  id: string,
  decision: "approved" | "denied"
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  const svc = createServiceClient();
  const { error } = await svc
    .from("bulletin_posts")
    .update({
      status: decision,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { ok: false as const, error: error.message };

  const { data: post } = await svc
    .from("bulletin_posts")
    .select("submitter_id, event_title")
    .eq("id", id)
    .single();
  if (post) {
    await notify([{
      userId: post.submitter_id,
      type: "bulletin_update",
      title: decision === "approved" ? "Bulletin post approved!" : "Bulletin post declined",
      body: post.event_title,
      link: "/bulletin",
    }]);
    const { data: submitter } = await svc.from("users").select("email, full_name").eq("id", post.submitter_id).single();
    if (submitter?.email) {
      const tmpl = bulletinDecisionEmail({ recipientName: submitter.full_name ?? submitter.email.split("@")[0], eventTitle: post.event_title, approved: decision === "approved" });
      await sendEmail({ to: submitter.email, ...tmpl });
    }
  }

  revalidatePath("/bulletin");
  revalidatePath("/bulletin/admin");
  return { ok: true as const };
}
