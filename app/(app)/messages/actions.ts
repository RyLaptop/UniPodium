"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { notify } from "@/lib/notifications";
import { sendEmail } from "@/lib/email/send";
import { dmRequestEmail } from "@/lib/email/templates";
import { isUuid } from "@/lib/utils";

export async function requestDm(targetUserId: string, initialMessage: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };
  if (!isUuid(targetUserId)) return { ok: false as const, error: "Invalid user." };
  if (user.id === targetUserId) return { ok: false as const, error: "Can't message yourself." };
  if (!initialMessage.trim()) return { ok: false as const, error: "Message required." };

  const svc = createServiceClient();

  // Check for existing thread between these two users
  const { data: existing } = await svc.from("dm_threads")
    .select("id, status")
    .or(`and(user_a.eq.${user.id},user_b.eq.${targetUserId}),and(user_a.eq.${targetUserId},user_b.eq.${user.id})`)
    .maybeSingle();

  let threadId: string;

  if (existing) {
    if (existing.status === "accepted") {
      await svc.from("dm_messages").insert({ thread_id: existing.id, sender_id: user.id, body: initialMessage.trim() });
      revalidatePath(`/messages/${existing.id}`);
      return { ok: true as const, threadId: existing.id, isNew: false };
    }
    threadId = existing.id;
  } else {
    const { data: thread, error } = await svc.from("dm_threads").insert({
      user_a: user.id, user_b: targetUserId, initiated_by: user.id, status: "pending",
    }).select("id").single();
    if (error) return { ok: false as const, error: error.message };
    threadId = thread.id;

    await svc.from("dm_messages").insert({ thread_id: threadId, sender_id: user.id, body: initialMessage.trim() });

    const { data: me } = await supabase.from("users").select("full_name, email").eq("id", user.id).single();
    const myName = me?.full_name ?? user.email ?? "Someone";
    await notify([{
      userId: targetUserId,
      type: "request_update" as const,
      title: `${myName} wants to chat`,
      body: initialMessage.trim().slice(0, 80),
      link: `/messages/${threadId}`,
    }]);
    const { data: targetUser } = await svc.from("users").select("email, full_name").eq("id", targetUserId).single();
    if (targetUser?.email) {
      const tmpl = dmRequestEmail({ senderName: myName, preview: initialMessage.trim().slice(0, 100), threadPath: `/messages/${threadId}` });
      await sendEmail({ to: targetUser.email, ...tmpl });
    }
  }

  revalidatePath("/messages");
  return { ok: true as const, threadId, isNew: true };
}

export async function respondDm(threadId: string, accept: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  const svc = createServiceClient();
  const { data: thread } = await svc.from("dm_threads").select("user_a, user_b, initiated_by").eq("id", threadId).single();
  if (!thread) return { ok: false as const, error: "Thread not found." };
  if (thread.user_a !== user.id && thread.user_b !== user.id) return { ok: false as const, error: "Not authorized." };
  if (thread.initiated_by === user.id) return { ok: false as const, error: "You initiated this thread." };

  await svc.from("dm_threads").update({ status: accept ? "accepted" : "declined" }).eq("id", threadId);

  if (accept) {
    const initiator = thread.initiated_by;
    const { data: me } = await supabase.from("users").select("full_name, email").eq("id", user.id).single();
    await notify([{
      userId: initiator,
      type: "request_update" as const,
      title: `${me?.full_name ?? "Someone"} accepted your message request`,
      link: `/messages/${threadId}`,
    }]);
  }

  revalidatePath(`/messages/${threadId}`);
  revalidatePath("/messages");
  return { ok: true as const };
}

export async function sendDm(threadId: string, body: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };
  if (!body.trim()) return { ok: false as const, error: "Message required." };

  const svc = createServiceClient();
  const { data: thread } = await svc.from("dm_threads").select("user_a, user_b, status").eq("id", threadId).single();
  if (!thread || thread.status !== "accepted") return { ok: false as const, error: "Thread not active." };
  if (thread.user_a !== user.id && thread.user_b !== user.id) return { ok: false as const, error: "Not authorized." };

  const { error } = await svc.from("dm_messages").insert({ thread_id: threadId, sender_id: user.id, body: body.trim() });
  if (error) return { ok: false as const, error: error.message };

  revalidatePath(`/messages/${threadId}`);
  return { ok: true as const };
}
