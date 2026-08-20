"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { notify } from "@/lib/notifications";
import { sendEmail } from "@/lib/email/send";
import { orgCreationDecisionEmail } from "@/lib/email/templates";
import { getUniversity } from "@/lib/university";
import { isUuid } from "@/lib/utils";
import type { SupabaseClient } from "@supabase/supabase-js";

async function isDirectorOrAdmin(supabase: SupabaseClient, orgId: string, userId: string): Promise<boolean> {
  const [{ data: mem }, { data: profile }] = await Promise.all([
    supabase.from("org_members").select("role").eq("org_id", orgId).eq("user_id", userId).eq("status", "active").maybeSingle(),
    supabase.from("users").select("is_site_admin").eq("id", userId).single(),
  ]);
  return mem?.role === "director" || (profile?.is_site_admin ?? false);
}

export type CreateOrgResult =
  | { ok: true; slug: string }
  | { ok: false; error: string };

export async function createOrg(
  _prev: CreateOrgResult | null,
  formData: FormData
): Promise<CreateOrgResult> {
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const tags = formData.getAll("tags").map(String).filter(Boolean);

  if (!/^[a-z0-9-]{2,40}$/.test(slug)) {
    return {
      ok: false,
      error: "Slug must be 2–40 chars, lowercase letters, numbers, and dashes.",
    };
  }
  if (name.length < 2) {
    return { ok: false, error: "Name is too short." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_org", {
    p_slug: slug,
    p_name: name,
    p_description: description,
  });

  if (error) {
    if (error.message.includes("duplicate") || error.code === "23505") {
      return { ok: false, error: "That slug is already taken." };
    }
    return { ok: false, error: error.message };
  }

  const uni = await getUniversity();
  const svc = createServiceClient();
  // Set status to pending, apply tags, and stamp university
  await svc.from("orgs").update({ status: "pending", university: uni, ...(tags.length > 0 ? { tags } : {}) }).eq("slug", slug);

  // Notify all site admins
  const { data: admins } = await svc.from("users").select("id").eq("is_site_admin", true);
  if (admins && admins.length > 0) {
    await notify(admins.map((a) => ({
      userId: a.id,
      type: "org_member_request" as const,
      title: `New org request: ${name}`,
      body: `"${slug}" is pending approval`,
      link: `/bulletin/admin`,
    })));
  }

  revalidatePath("/orgs");
  return { ok: true, slug };
}

export async function joinOrg(orgId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  const { error } = await supabase.from("org_members").insert({
    org_id: orgId,
    user_id: user.id,
    role: "member",
    status: "pending",
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: false as const, error: "You already have a pending or active membership." };
    }
    return { ok: false as const, error: error.message };
  }

  const [{ data: org }, { data: directors }, { data: me }] = await Promise.all([
    supabase.from("orgs").select("name, slug").eq("id", orgId).single(),
    supabase.from("org_members").select("user_id").eq("org_id", orgId).eq("role", "director").eq("status", "active"),
    supabase.from("users").select("full_name, email").eq("id", user.id).single(),
  ]);
  if (org && directors && directors.length > 0) {
    const myName = me?.full_name ?? user.email ?? "Someone";
    await notify(directors.map((d) => ({
      userId: d.user_id,
      type: "org_member_request",
      title: `New join request for ${org.name}`,
      body: `${myName} wants to join`,
      link: `/orgs/${org.slug}`,
    })));
  }

  revalidatePath("/orgs");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function leaveOrg(orgId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  const { error } = await supabase
    .from("org_members")
    .delete()
    .eq("org_id", orgId)
    .eq("user_id", user.id);

  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/orgs");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function approveMember(orgId: string, userId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };
  if (!await isDirectorOrAdmin(supabase, orgId, user.id)) {
    return { ok: false as const, error: "Only directors can approve members." };
  }

  const svc = createServiceClient();
  const { error } = await svc
    .from("org_members")
    .update({ status: "active" })
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .eq("status", "pending");

  if (error) return { ok: false as const, error: error.message };

  const { data: org } = await svc.from("orgs").select("name, slug").eq("id", orgId).single();
  if (org) {
    await notify([{ userId, type: "org_member_request", title: `You're now a member of ${org.name}!`, link: `/orgs/${org.slug}` }]);
  }

  revalidatePath(`/orgs`);
  return { ok: true as const };
}

export async function denyMember(orgId: string, userId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };
  if (!await isDirectorOrAdmin(supabase, orgId, user.id)) {
    return { ok: false as const, error: "Only directors can deny members." };
  }

  const svc = createServiceClient();
  const { data: org } = await svc.from("orgs").select("name").eq("id", orgId).single();

  const { error } = await svc
    .from("org_members")
    .delete()
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .eq("status", "pending");

  if (error) return { ok: false as const, error: error.message };

  if (org) {
    await notify([{ userId, type: "org_member_request", title: `Join request for ${org.name} was declined` }]);
  }

  revalidatePath(`/orgs`);
  return { ok: true as const };
}

export async function makeOfficer(orgId: string, userId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  if (!await isDirectorOrAdmin(supabase, orgId, user.id)) {
    return { ok: false as const, error: "Only directors can manage staff." };
  }

  const svc = createServiceClient();
  const { error } = await svc
    .from("org_members")
    .update({ role: "officer" })
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .eq("status", "active")
    .eq("role", "member");

  if (error) return { ok: false as const, error: error.message };

  const { data: org } = await supabase.from("orgs").select("name, slug").eq("id", orgId).single();
  if (org) {
    await notify([{ userId, type: "org_member_request", title: `You're now an officer of ${org.name}!`, link: `/orgs/${org.slug}` }]);
  }

  revalidatePath(`/orgs`);
  return { ok: true as const };
}

export async function promoteMember(orgId: string, userId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  if (!await isDirectorOrAdmin(supabase, orgId, user.id)) {
    return { ok: false as const, error: "Only directors can promote to STAFF." };
  }

  const svc = createServiceClient();
  const { error } = await svc
    .from("org_members")
    .update({ role: "director" })
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .eq("status", "active")
    .eq("role", "officer");

  if (error) return { ok: false as const, error: error.message };

  const { data: org } = await supabase.from("orgs").select("name, slug").eq("id", orgId).single();
  if (org) {
    await notify([{ userId, type: "org_member_request", title: `You're now STAFF of ${org.name}!`, link: `/orgs/${org.slug}` }]);
  }

  revalidatePath(`/orgs`);
  return { ok: true as const };
}

export async function demoteMember(orgId: string, userId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  if (!await isDirectorOrAdmin(supabase, orgId, user.id)) {
    return { ok: false as const, error: "Only directors can demote staff." };
  }

  const svc = createServiceClient();
  const { error } = await svc
    .from("org_members")
    .update({ role: "member" })
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .eq("status", "active")
    .eq("role", "officer");

  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/orgs`);
  return { ok: true as const };
}

export async function demoteToOfficer(orgId: string, userId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  if (!await isDirectorOrAdmin(supabase, orgId, user.id)) {
    return { ok: false as const, error: "Only directors can change roles." };
  }

  const svc = createServiceClient();
  const { error } = await svc
    .from("org_members")
    .update({ role: "officer" })
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .eq("status", "active")
    .eq("role", "director");

  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/orgs`);
  return { ok: true as const };
}

export async function updateOrg(
  orgId: string,
  orgSlug: string,
  data: { name: string; description: string; tags: string[]; contactEmail?: string; websiteUrl?: string; tiktokUrl?: string; instagramUrl?: string; groupmeUrl?: string; flareUrl?: string; socialLinksLocked?: boolean }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  if (!await isDirectorOrAdmin(supabase, orgId, user.id)) {
    return { ok: false as const, error: "Only STAFF can edit the org." };
  }

  if (data.name.length < 2) return { ok: false as const, error: "Name is too short." };

  const svc = createServiceClient();
  const { error } = await svc
    .from("orgs")
    .update({
      name: data.name,
      description: data.description || null,
      tags: data.tags,
      contact_email: data.contactEmail || null,
      website_url: data.websiteUrl || null,
      tiktok_url: data.tiktokUrl || null,
      instagram_url: data.instagramUrl || null,
      groupme_url: data.groupmeUrl || null,
      flare_url: data.flareUrl || null,
      social_links_locked: data.socialLinksLocked ?? false,
    })
    .eq("id", orgId);

  if (error) return { ok: false as const, error: error.message };

  revalidatePath(`/orgs/${orgSlug}`);
  revalidatePath("/orgs");
  return { ok: true as const };
}

export async function removeMember(orgId: string, targetUserId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  if (!await isDirectorOrAdmin(supabase, orgId, user.id)) {
    return { ok: false as const, error: "Only STAFF can remove members." };
  }

  const { data: targetMem } = await supabase
    .from("org_members").select("role")
    .eq("org_id", orgId).eq("user_id", targetUserId).eq("status", "active").maybeSingle();
  if (!targetMem) return { ok: false as const, error: "Member not found." };
  if (targetMem.role === "director") return { ok: false as const, error: "Cannot remove STAFF members." };

  const svc = createServiceClient();
  const { error } = await svc.from("org_members").delete()
    .eq("org_id", orgId).eq("user_id", targetUserId).eq("status", "active");

  if (error) return { ok: false as const, error: error.message };

  const { data: org } = await supabase.from("orgs").select("name").eq("id", orgId).single();
  if (org) {
    await notify([{ userId: targetUserId, type: "org_member_request", title: `You've been removed from ${org.name}` }]);
  }

  revalidatePath(`/orgs`);
  return { ok: true as const };
}

// ── Invite links ─────────────────────────────────────────────────────────────

export async function generateInvite(orgId: string, orgSlug: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  if (!await isDirectorOrAdmin(supabase, orgId, user.id)) return { ok: false as const, error: "Only STAFF can generate invite links." };

  const code = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  const svc = createServiceClient();

  // Replace any existing invite for this org
  await svc.from("org_invites").delete().eq("org_id", orgId);
  const { data, error } = await svc.from("org_invites")
    .insert({ org_id: orgId, created_by: user.id, code })
    .select("id, code")
    .single();

  if (error) return { ok: false as const, error: error.message };

  revalidatePath(`/orgs/${orgSlug}`);
  return { ok: true as const, code: data.code, inviteId: data.id };
}

export async function deleteInvite(inviteId: string, orgSlug: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  const svc = createServiceClient();
  const { data: invite } = await svc.from("org_invites").select("org_id").eq("id", inviteId).single();
  if (!invite) return { ok: false as const, error: "Not found." };

  if (!await isDirectorOrAdmin(supabase, invite.org_id, user.id)) return { ok: false as const, error: "Not authorized." };

  await svc.from("org_invites").delete().eq("id", inviteId);

  revalidatePath(`/orgs/${orgSlug}`);
  return { ok: true as const };
}

export async function setMemberTitle(orgId: string, targetUserId: string, title: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  if (!await isDirectorOrAdmin(supabase, orgId, user.id)) return { ok: false as const, error: "Only STAFF can set titles." };

  const svc = createServiceClient();
  const { error } = await svc.from("org_members")
    .update({ title: title.trim() || null })
    .eq("org_id", orgId).eq("user_id", targetUserId).eq("status", "active");

  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/orgs`);
  return { ok: true as const };
}

export async function uploadOrgLogo(orgId: string, orgSlug: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  if (!await isDirectorOrAdmin(supabase, orgId, user.id)) return { ok: false as const, error: "Only STAFF can upload logos." };

  const file = formData.get("logo") as File | null;
  if (!file || file.size === 0) return { ok: false as const, error: "No file provided." };
  if (file.size > 2 * 1024 * 1024) return { ok: false as const, error: "Logo must be under 2MB." };
  if (!file.type.startsWith("image/")) return { ok: false as const, error: "File must be an image." };

  const ext = file.name.split(".").pop() ?? "png";
  const path = `${orgId}/logo.${ext}`;
  const bytes = await file.arrayBuffer();

  const svc = createServiceClient();
  const { error: upErr } = await svc.storage.from("org-logos").upload(path, bytes, {
    contentType: file.type,
    upsert: true,
  });
  if (upErr) return { ok: false as const, error: upErr.message };

  const { data: { publicUrl } } = svc.storage.from("org-logos").getPublicUrl(path);
  const { error } = await svc.from("orgs").update({ logo_url: publicUrl }).eq("id", orgId);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath(`/orgs/${orgSlug}`);
  return { ok: true as const, url: publicUrl };
}

export async function addAffiliation(orgId: string, orgSlug: string, affiliateOrgId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };
  if (!isUuid(orgId) || !isUuid(affiliateOrgId)) return { ok: false as const, error: "Invalid org." };

  if (!await isDirectorOrAdmin(supabase, orgId, user.id)) return { ok: false as const, error: "Only STAFF can manage affiliations." };

  const svc = createServiceClient();

  // Check no existing row between these two orgs (in either direction)
  const { data: existing } = await svc.from("org_affiliations")
    .select("id")
    .or(`and(org_id.eq.${orgId},affiliate_org_id.eq.${affiliateOrgId}),and(org_id.eq.${affiliateOrgId},affiliate_org_id.eq.${orgId})`)
    .maybeSingle();
  if (existing) return { ok: false as const, error: "A request already exists between these orgs." };

  const { error } = await svc.from("org_affiliations").insert({
    org_id: orgId,
    affiliate_org_id: affiliateOrgId,
    status: "pending",
  });
  if (error) return { ok: false as const, error: error.message };

  // Notify staff of the target org
  const [{ data: myOrg }, { data: targetStaff }] = await Promise.all([
    svc.from("orgs").select("name").eq("id", orgId).single(),
    svc.from("org_members").select("user_id").eq("org_id", affiliateOrgId)
      .in("role", ["director", "officer"]).eq("status", "active"),
  ]);
  const targetSlug = await svc.from("orgs").select("slug").eq("id", affiliateOrgId).single().then((r) => r.data?.slug ?? "");
  if (targetStaff && targetStaff.length > 0) {
    await notify(targetStaff.map((m) => ({
      userId: m.user_id,
      type: "request_update" as const,
      title: `${myOrg?.name ?? "An org"} wants to affiliate`,
      body: `Review the request on your org page.`,
      link: `/orgs/${targetSlug}`,
    })));
  }

  revalidatePath(`/orgs/${orgSlug}`);
  return { ok: true as const };
}

export async function removeAffiliation(affiliationId: string, orgSlug: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  const svc = createServiceClient();

  // Verify the user is staff of one of the orgs in this affiliation
  const { data: row } = await svc.from("org_affiliations").select("org_id, affiliate_org_id").eq("id", affiliationId).single();
  if (!row) return { ok: false as const, error: "Not found." };

  const { data: myMem } = await supabase.from("org_members").select("role")
    .in("org_id", [row.org_id, row.affiliate_org_id])
    .eq("user_id", user.id).eq("status", "active").in("role", ["director", "officer"]).maybeSingle();
  if (!myMem) return { ok: false as const, error: "Not authorized." };

  await svc.from("org_affiliations").delete().eq("id", affiliationId);

  revalidatePath(`/orgs/${orgSlug}`);
  return { ok: true as const };
}

export async function respondAffiliation(affiliationId: string, orgSlug: string, accept: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  const svc = createServiceClient();

  const { data: row } = await svc.from("org_affiliations")
    .select("org_id, affiliate_org_id, status")
    .eq("id", affiliationId).single();
  if (!row) return { ok: false as const, error: "Not found." };
  if (row.status !== "pending") return { ok: false as const, error: "Already responded." };

  // Only staff of the target org (affiliate_org_id) can respond
  const { data: myMem } = await supabase.from("org_members").select("role")
    .eq("org_id", row.affiliate_org_id).eq("user_id", user.id)
    .eq("status", "active").in("role", ["director", "officer"]).maybeSingle();
  if (!myMem) return { ok: false as const, error: "Not authorized." };

  await svc.from("org_affiliations").update({ status: accept ? "accepted" : "declined" }).eq("id", affiliationId);

  // Notify requesting org staff
  const [{ data: myOrg }, { data: requesterStaff }] = await Promise.all([
    svc.from("orgs").select("name, slug").eq("id", row.affiliate_org_id).single(),
    svc.from("org_members").select("user_id").eq("org_id", row.org_id)
      .in("role", ["director", "officer"]).eq("status", "active"),
  ]);
  const requesterSlug = await svc.from("orgs").select("slug").eq("id", row.org_id).single().then((r) => r.data?.slug ?? "");
  if (requesterStaff && requesterStaff.length > 0) {
    await notify(requesterStaff.map((m) => ({
      userId: m.user_id,
      type: "request_update" as const,
      title: accept
        ? `${myOrg?.name ?? "An org"} accepted your affiliation request`
        : `${myOrg?.name ?? "An org"} declined your affiliation request`,
      link: `/orgs/${requesterSlug}`,
    })));
  }

  revalidatePath(`/orgs/${orgSlug}`);
  return { ok: true as const };
}

export async function approveOrg(orgId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  const { data: profile } = await supabase.from("users").select("is_site_admin").eq("id", user.id).single();
  if (!profile?.is_site_admin) return { ok: false as const, error: "Not authorized." };

  const svc = createServiceClient();
  const { data: org } = await svc.from("orgs").select("name, slug").eq("id", orgId).single();
  await svc.from("orgs").update({ status: "approved" }).eq("id", orgId);

  const { data: founder } = await svc.from("org_members")
    .select("user_id").eq("org_id", orgId).eq("role", "director").eq("status", "active").limit(1).single();
  if (founder && org) {
    await notify([{ userId: founder.user_id, type: "org_member_request", title: `Your org "${org.name}" has been approved!`, link: `/orgs/${org.slug}` }]);
    const { data: founderUser } = await svc.from("users").select("email, full_name").eq("id", founder.user_id).single();
    if (founderUser?.email) {
      const tmpl = orgCreationDecisionEmail({ recipientName: founderUser.full_name ?? founderUser.email.split("@")[0], orgName: org.name, approved: true, orgPath: `/orgs/${org.slug}` });
      await sendEmail({ to: founderUser.email, ...tmpl });
    }
  }

  revalidatePath("/bulletin/admin");
  revalidatePath("/orgs");
  return { ok: true as const };
}

export async function rejectOrg(orgId: string, reason: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  const { data: profile } = await supabase.from("users").select("is_site_admin").eq("id", user.id).single();
  if (!profile?.is_site_admin) return { ok: false as const, error: "Not authorized." };

  const svc = createServiceClient();
  const { data: org } = await svc.from("orgs").select("name").eq("id", orgId).single();
  await svc.from("orgs").update({ status: "rejected", rejection_reason: reason || null }).eq("id", orgId);

  const { data: founder } = await svc.from("org_members")
    .select("user_id").eq("org_id", orgId).eq("role", "director").eq("status", "active").limit(1).single();
  if (founder && org) {
    await notify([{ userId: founder.user_id, type: "org_member_request", title: `Org request for "${org.name}" was declined`, body: reason || undefined }]);
    const { data: founderUser } = await svc.from("users").select("email, full_name").eq("id", founder.user_id).single();
    if (founderUser?.email) {
      const tmpl = orgCreationDecisionEmail({ recipientName: founderUser.full_name ?? founderUser.email.split("@")[0], orgName: org.name, approved: false, reason: reason || null });
      await sendEmail({ to: founderUser.email, ...tmpl });
    }
  }

  revalidatePath("/bulletin/admin");
  revalidatePath("/orgs");
  return { ok: true as const };
}

export async function deleteOrg(orgId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  const [{ data: myMem }, { data: profile }] = await Promise.all([
    supabase.from("org_members").select("role")
      .eq("org_id", orgId).eq("user_id", user.id).eq("status", "active").maybeSingle(),
    supabase.from("users").select("is_site_admin").eq("id", user.id).single(),
  ]);

  if (myMem?.role !== "director" && !profile?.is_site_admin) {
    return { ok: false as const, error: "Only STAFF or site admins can delete an org." };
  }

  const svc = createServiceClient();

  // Get all meetings so we can delete their children first
  const { data: meetings } = await svc.from("meetings").select("id").eq("org_id", orgId);
  const meetingIds = (meetings ?? []).map((m) => m.id as string);

  // Delete in FK dependency order
  if (meetingIds.length > 0) {
    await svc.from("chat_messages").delete().in("meeting_id", meetingIds);
    await svc.from("speak_requests").delete().in("meeting_id", meetingIds);
  }
  await svc.from("speak_requests").delete().eq("requester_org_id", orgId);
  await svc.from("chat_messages").delete().eq("org_id", orgId);
  await svc.from("meetings").delete().eq("org_id", orgId);
  await svc.from("org_invites").delete().eq("org_id", orgId);
  await svc.from("org_members").delete().eq("org_id", orgId);
  await svc.from("bulletin_posts").delete().eq("org_id", orgId);

  const { error } = await svc.from("orgs").delete().eq("id", orgId);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/orgs");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function acceptInvite(code: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  const svc = createServiceClient();
  const { data: invite } = await svc.from("org_invites")
    .select("id, org_id, use_count, orgs(slug)")
    .eq("code", code).single();
  if (!invite) return { ok: false as const, error: "Invalid or expired invite link." };

  const orgSlug = (invite.orgs as unknown as { slug: string } | null)?.slug ?? "";

  const { data: existing } = await supabase.from("org_members")
    .select("status").eq("org_id", invite.org_id).eq("user_id", user.id).maybeSingle();

  if (existing?.status === "active") return { ok: false as const, error: "You're already a member of this org." };

  if (existing?.status === "pending") {
    await svc.from("org_members").update({ status: "active" }).eq("org_id", invite.org_id).eq("user_id", user.id);
  } else {
    const { error } = await svc.from("org_members").insert({ org_id: invite.org_id, user_id: user.id, role: "member", status: "active" });
    if (error) return { ok: false as const, error: error.message };
  }

  await svc.from("org_invites").update({ use_count: (invite.use_count ?? 0) + 1 }).eq("id", invite.id);

  revalidatePath(`/orgs/${orgSlug}`);
  revalidatePath("/dashboard");
  return { ok: true as const, orgSlug };
}

export async function stepDownFromRole(orgId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  const { data: mem } = await supabase.from("org_members")
    .select("role").eq("org_id", orgId).eq("user_id", user.id).eq("status", "active").maybeSingle();
  if (!mem || !["director", "officer"].includes(mem.role)) {
    return { ok: false as const, error: "You don't have a staff role to step down from." };
  }

  const svc = createServiceClient();
  const { error } = await svc.from("org_members")
    .update({ role: "member" })
    .eq("org_id", orgId).eq("user_id", user.id).eq("status", "active");

  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/orgs");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function setFeaturedOrg(orgId: string | null) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  const { data: profile } = await supabase.from("users").select("is_site_admin").eq("id", user.id).single();
  if (!profile?.is_site_admin) return { ok: false as const, error: "Not authorized." };

  const svc = createServiceClient();
  await svc.from("orgs").update({ is_featured: false }).eq("is_featured", true);
  if (orgId) {
    await svc.from("orgs").update({ is_featured: true }).eq("id", orgId);
  }

  revalidatePath("/dashboard");
  revalidatePath("/bulletin/admin");
  return { ok: true as const };
}
