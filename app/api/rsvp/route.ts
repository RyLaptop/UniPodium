import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const { meetingId } = await request.json().catch(() => ({}));
  if (!meetingId) return NextResponse.json({ error: "Missing meetingId" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  if (!rateLimit(`rsvp:${user.id}`, 20, 60_000)) {
    return NextResponse.json({ error: "Too many requests, slow down." }, { status: 429 });
  }

  const svc = createServiceClient();
  const { error } = await svc.from("meeting_rsvps").insert({ meeting_id: meetingId, user_id: user.id });
  if (error && error.code !== "23505") return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const { meetingId } = await request.json().catch(() => ({}));
  if (!meetingId) return NextResponse.json({ error: "Missing meetingId" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  if (!rateLimit(`rsvp:${user.id}`, 20, 60_000)) {
    return NextResponse.json({ error: "Too many requests, slow down." }, { status: 429 });
  }

  const svc = createServiceClient();
  await svc.from("meeting_rsvps").delete().eq("meeting_id", meetingId).eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
