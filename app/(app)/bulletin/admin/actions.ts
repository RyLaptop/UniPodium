"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getResend, FROM_EMAIL } from "@/lib/email/resend";
import { isUuid } from "@/lib/utils";

type Result = { ok: true } | { ok: false; error: string };

async function requireAdmin(): Promise<{ userId: string } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };
  const { data: profile } = await supabase.from("users").select("is_site_admin").eq("id", user.id).single();
  if (!profile?.is_site_admin) return { error: "Not authorized." };
  return { userId: user.id };
}

export async function adminUpdateUser(
  targetUserId: string,
  formData: FormData
): Promise<Result> {
  const auth = await requireAdmin();
  if ("error" in auth) return { ok: false, error: auth.error };

  const fullName = (formData.get("full_name") as string | null)?.trim() || null;
  const email = (formData.get("email") as string | null)?.trim() || null;
  const isSiteAdmin = formData.get("is_site_admin") === "true";

  const svc = createServiceClient();

  if (email) {
    const { error } = await svc.auth.admin.updateUserById(targetUserId, { email });
    if (error) return { ok: false, error: error.message };
  }

  const { error: profileErr } = await svc
    .from("users")
    .update({ full_name: fullName, ...(email ? { email } : {}), is_site_admin: isSiteAdmin })
    .eq("id", targetUserId);

  if (profileErr) return { ok: false, error: profileErr.message };
  return { ok: true };
}

async function deleteAuthAndProfile(targetUserId: string): Promise<Result> {
  if (!isUuid(targetUserId)) return { ok: false, error: "Invalid user." };
  const svc = createServiceClient();

  // Null out nullable back-references first
  await Promise.all([
    svc.from("speak_requests").update({ decided_by: null }).eq("decided_by", targetUserId),
    svc.from("bulletin_posts").update({ reviewed_by: null }).eq("reviewed_by", targetUserId),
  ]);

  // Delete records with non-cascading FK references to this user
  const meetingRows = await svc.from("meetings").select("id").eq("created_by", targetUserId);
  const meetingIds = (meetingRows.data ?? []).map((m) => m.id);
  if (meetingIds.length > 0) {
    await svc.from("speak_requests").delete().in("meeting_id", meetingIds);
    await svc.from("meetings").delete().in("id", meetingIds);
  }
  // DM threads — user_a, user_b, and initiated_by all reference users without cascade
  const { data: dmThreadRows } = await svc
    .from("dm_threads")
    .select("id")
    .or(`user_a.eq.${targetUserId},user_b.eq.${targetUserId},initiated_by.eq.${targetUserId}`);
  const dmThreadIds = (dmThreadRows ?? []).map((t) => t.id);
  if (dmThreadIds.length > 0) {
    await svc.from("dm_messages").delete().in("thread_id", dmThreadIds);
    await svc.from("dm_threads").delete().in("id", dmThreadIds);
  }
  // dm_messages where sender_id = user (in threads they didn't own)
  await svc.from("dm_messages").delete().eq("sender_id", targetUserId);

  await Promise.all([
    svc.from("speak_requests").delete().eq("requester_user_id", targetUserId),
    svc.from("chat_messages").delete().eq("user_id", targetUserId),
    svc.from("org_members").delete().eq("user_id", targetUserId),
    svc.from("org_invites").delete().eq("created_by", targetUserId),
    svc.from("bulletin_posts").delete().eq("submitter_id", targetUserId),
    svc.from("notifications").delete().eq("user_id", targetUserId),
  ]);

  // Check for orgs the user created — can't delete user while they're the created_by
  const { data: ownedOrgs } = await svc.from("orgs").select("id").eq("created_by", targetUserId);
  if (ownedOrgs && ownedOrgs.length > 0) {
    return { ok: false, error: "This user owns org(s). Delete those orgs first or transfer ownership." };
  }

  // Attempt auth deletion (cascades to public.users)
  const { error: authErr } = await svc.auth.admin.deleteUser(targetUserId);
  if (authErr) {
    // Fallback: delete the profile row directly
    const { error: profileErr } = await svc.from("users").delete().eq("id", targetUserId);
    if (profileErr) return { ok: false, error: profileErr.message || "Failed to delete user." };
  }

  return { ok: true };
}

export async function adminDeleteUser(targetUserId: string): Promise<Result> {
  const auth = await requireAdmin();
  if ("error" in auth) return { ok: false, error: auth.error };
  if (auth.userId === targetUserId) return { ok: false, error: "Cannot delete your own account." };
  return deleteAuthAndProfile(targetUserId);
}

export async function approveUser(targetUserId: string): Promise<Result> {
  const auth = await requireAdmin();
  if ("error" in auth) return { ok: false, error: auth.error };

  const svc = createServiceClient();
  const { error } = await svc.from("users").update({ is_verified: true }).eq("id", targetUserId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function denyUser(targetUserId: string): Promise<Result> {
  const auth = await requireAdmin();
  if ("error" in auth) return { ok: false, error: auth.error };
  return deleteAuthAndProfile(targetUserId);
}

export async function sendTestEmail(): Promise<{ ok: boolean; message: string }> {
  const auth = await requireAdmin();
  if ("error" in auth) return { ok: false, message: auth.error };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, message: "No email on your account." };

  if (!process.env.RESEND_API_KEY) {
    return { ok: false, message: "RESEND_API_KEY is not set in Vercel environment variables." };
  }
  if (!process.env.RESEND_FROM_EMAIL) {
    return { ok: false, message: "RESEND_FROM_EMAIL is not set — add it in Vercel env vars (e.g. noreply@unipodium.com)." };
  }

  try {
    const resend = getResend();
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: user.email,
      subject: "UniPodium email test ✓",
      html: `<p>Test email from UniPodium.</p><p><b>From:</b> ${FROM_EMAIL}</p><p><b>To:</b> ${user.email}</p>`,
    });
    if ("error" in result && result.error) {
      return { ok: false, message: `Resend API error: ${JSON.stringify(result.error)}` };
    }
    return { ok: true, message: `Sent to ${user.email} from ${FROM_EMAIL}. Check your inbox and spam folder.` };
  } catch (err) {
    return { ok: false, message: `Exception: ${String(err)}` };
  }
}
