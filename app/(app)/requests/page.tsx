import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { FeedbackForm } from "./_feedback";
import { MakeRequest } from "./_make-request";
import { JoinRequestActions } from "./_join-request-actions";
import { DmRequestActions } from "./_dm-request-actions";

export const dynamic = "force-dynamic";

export default async function RequestsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return (
    <div className="flex flex-col items-center justify-center py-24 text-center text-gray-500 gap-3">
      <p className="text-lg font-medium text-gray-700">Sign in to view your requests</p>
      <p className="text-sm">To access this feature you must be signed in.</p>
      <div className="flex gap-3 mt-2">
        <Link href="/login" className="up-btn-primary">Sign in</Link>
        <Link href="/login?mode=signup" className="up-btn-secondary">Create account</Link>
      </div>
    </div>
  );

  const svc = createServiceClient();

  const [{ data: allOrgs }, { data: myOrgMemberships }, { data: currentUserProfile }] = await Promise.all([
    svc.from("orgs").select("id, name, slug").eq("status", "approved").order("name"),
    supabase.from("org_members").select("org_id, orgs(id, name)")
      .eq("user_id", user.id).eq("status", "active").in("role", ["officer", "director"]),
    supabase.from("users").select("is_site_admin").eq("id", user.id).single(),
  ]);
  const isAdmin = currentUserProfile?.is_site_admin ?? false;

  const myOrgs = (myOrgMemberships ?? []).map((m) => {
    const o = m.orgs as unknown as { id: string; name: string } | null;
    return o ? { id: o.id, name: o.name } : null;
  }).filter(Boolean) as { id: string; name: string }[];

  const myOrgIds = myOrgs.map((o) => o.id);

  // Count total (non-cancelled) meetings per org to enforce the 3-meeting minimum
  const { data: orgMeetingRows } = myOrgIds.length > 0
    ? await svc.from("meetings").select("org_id").in("org_id", myOrgIds).is("cancelled_at", null)
    : { data: [] as { org_id: string }[] };
  const orgMeetingCountMap = new Map<string, number>();
  for (const row of orgMeetingRows ?? []) {
    orgMeetingCountMap.set(row.org_id, (orgMeetingCountMap.get(row.org_id) ?? 0) + 1);
  }
  const myOrgsWithCounts = myOrgs.map((o) => ({ ...o, meetingCount: orgMeetingCountMap.get(o.id) ?? 0 }));

  const [
    { data: mySpeakReqs },
    { data: incomingSpeakReqs },
    { data: myJoinRows },
    { data: incomingJoinRows },
    { data: sentDmReqs },
    { data: receivedDmReqs },
  ] = await Promise.all([
    supabase
      .from("speak_requests")
      .select("id, pitch, status, requested_minutes, created_at, speaker_feedback_at, meetings(id, title, starts_at, orgs(name, slug))")
      .eq("requester_user_id", user.id)
      .in("status", ["pending", "waitlisted", "approved", "denied", "disputed", "completed"])
      .order("created_at", { ascending: false }),

    (isAdmin ? svc : supabase)
      .from("speak_requests")
      .select("id, pitch, status, requested_minutes, created_at, users!speak_requests_requester_user_id_fkey(full_name, email), orgs!speak_requests_requester_org_id_fkey(name), meetings(id, title, starts_at, org_id, orgs(name, slug))")
      .neq("requester_user_id", user.id)
      .in("status", ["pending", "approved", "disputed"])
      .order("created_at", { ascending: false }),

    // No nested joins — fetch org/user details separately below
    svc
      .from("org_members")
      .select("org_id, joined_at")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .order("joined_at", { ascending: false }),

    isAdmin
      ? svc
          .from("org_members")
          .select("user_id, org_id, joined_at")
          .eq("status", "pending")
          .order("joined_at", { ascending: false })
      : myOrgIds.length > 0
        ? svc
            .from("org_members")
            .select("user_id, org_id, joined_at")
            .in("org_id", myOrgIds)
            .eq("status", "pending")
            .order("joined_at", { ascending: false })
        : Promise.resolve({ data: [] as { user_id: string; org_id: string; joined_at: string }[] }),

    svc
      .from("dm_threads")
      .select("id, created_at, user_a, user_b, initiated_by")
      .eq("initiated_by", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),

    svc
      .from("dm_threads")
      .select("id, created_at, user_a, user_b, initiated_by")
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
      .neq("initiated_by", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
  ]);

  // Collect IDs needed for join request lookups and DM thread user profiles
  const joinOrgIds = [...new Set([
    ...(myJoinRows ?? []).map((r) => r.org_id),
    ...(incomingJoinRows ?? []).map((r) => r.org_id),
  ])];
  const joinUserIds = [...new Set((incomingJoinRows ?? []).map((r) => r.user_id))];
  const dmOtherIds = [...new Set([
    ...(sentDmReqs ?? []).map((t) => (t.user_a === user.id ? t.user_b : t.user_a)),
    ...(receivedDmReqs ?? []).map((t) => (t.user_a === user.id ? t.user_b : t.user_a)),
  ])].filter(Boolean) as string[];

  const [{ data: joinOrgsData }, { data: joinUsersData }, { data: dmProfiles }] = await Promise.all([
    joinOrgIds.length > 0
      ? svc.from("orgs").select("id, name, slug").in("id", joinOrgIds)
      : Promise.resolve({ data: [] as { id: string; name: string; slug: string }[] }),
    joinUserIds.length > 0
      ? svc.from("users").select("id, full_name, email").in("id", joinUserIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null; email: string }[] }),
    dmOtherIds.length > 0
      ? svc.from("users").select("id, full_name, email").in("id", dmOtherIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null; email: string }[] }),
  ]);

  const joinOrgsMap = new Map((joinOrgsData ?? []).map((o) => [o.id, o]));
  const joinUsersMap = new Map((joinUsersData ?? []).map((u) => [u.id, u]));
  const dmProfileMap = new Map((dmProfiles ?? []).map((p) => [p.id, p]));

  const myJoinReqs = (myJoinRows ?? []).map((r) => ({
    org_id: r.org_id,
    joined_at: r.joined_at,
    org: joinOrgsMap.get(r.org_id) ?? null,
  }));

  const incomingJoinReqs = (incomingJoinRows ?? []).map((r) => ({
    user_id: r.user_id,
    org_id: r.org_id,
    joined_at: r.joined_at,
    org: joinOrgsMap.get(r.org_id) ?? null,
    member: joinUsersMap.get(r.user_id) ?? null,
  }));

  return (
    <div className="space-y-10">
      <h1 className="text-3xl font-bold">Requests</h1>

      {/* ── SPEAKING ────────────────────────────────────── */}
      <div className="space-y-6">
        <h2 className="text-lg font-semibold text-gray-400 uppercase tracking-wide text-sm">Speaking</h2>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xl font-semibold">My speaking requests</h3>
            <MakeRequest
              allOrgs={(allOrgs ?? []).map((o) => ({ id: o.id, name: o.name, slug: o.slug }))}
              myOrgs={myOrgsWithCounts}
            />
          </div>
          {(() => {
            const active = (mySpeakReqs ?? []).filter((r) => {
              if (r.status !== "completed") return true;
              if (r.speaker_feedback_at) return false;
              const meeting = r.meetings as unknown as { starts_at: string };
              return Date.now() < new Date(meeting.starts_at).getTime() + 24 * 60 * 60 * 1000;
            });
            if (active.length === 0) return (
              <p className="text-gray-500 text-sm">
                No active requests.{" "}
                <Link href="/orgs" className="text-brand hover:underline">Browse orgs →</Link>
              </p>
            );
            return (
              <ul className="space-y-2">
                {active.map((r) => {
                  const meeting = r.meetings as unknown as { id: string; title: string; starts_at: string; orgs: { name: string; slug: string } };
                  const needsFeedback = r.status === "completed" && !r.speaker_feedback_at;
                  return (
                    <li key={r.id}>
                      <div className="border border-gray-200 rounded-lg p-3 hover:border-brand">
                        <Link href={`/requests/${r.id}`} className="block">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium truncate">{meeting.orgs.name} · {meeting.title}</p>
                              <p className="text-sm text-gray-600 mt-1 line-clamp-1">{r.pitch}</p>
                              <p className="text-xs text-gray-500 mt-1">{new Date(meeting.starts_at).toLocaleString()}</p>
                            </div>
                            <StatusPill status={r.status} />
                          </div>
                        </Link>
                        {needsFeedback && <FeedbackForm requestId={r.id} />}
                      </div>
                    </li>
                  );
                })}
              </ul>
            );
          })()}
        </section>

        {incomingSpeakReqs && incomingSpeakReqs.length > 0 && (
          <section>
            <h3 className="text-xl font-semibold mb-3">Incoming speaking requests</h3>
            <ul className="space-y-2">
              {incomingSpeakReqs.map((r) => {
                const meeting = r.meetings as unknown as { id: string; title: string; starts_at: string; orgs: { name: string; slug: string } };
                const speaker = r.users as unknown as { full_name: string | null; email: string };
                const speakerOrg = r.orgs as unknown as { name: string } | null;
                const speakerLabel = speakerOrg?.name ?? speaker.full_name ?? speaker.email.split("@")[0];
                const speakerSub = speakerOrg ? (speaker.full_name ?? speaker.email.split("@")[0]) : null;
                return (
                  <li key={r.id}>
                    <Link href={`/requests/${r.id}`} className="block border border-gray-200 rounded-lg p-3 hover:border-brand">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{speakerLabel} → {meeting.orgs.name} · {meeting.title}</p>
                          {speakerSub && <p className="text-xs text-gray-500">{speakerSub}</p>}
                          <p className="text-sm text-gray-600 mt-1 line-clamp-1">{r.pitch}</p>
                        </div>
                        <StatusPill status={r.status} />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>

      {/* ── ORG MEMBERSHIP ──────────────────────────────── */}
      <div className="space-y-6">
        <h2 className="text-lg font-semibold text-gray-400 uppercase tracking-wide text-sm">Org membership</h2>

        <section>
          <h3 className="text-xl font-semibold mb-3">Join requests I sent</h3>
          {!myJoinReqs || myJoinReqs.length === 0 ? (
            <p className="text-gray-500 text-sm">No pending join requests.</p>
          ) : (
            <ul className="space-y-2">
              {myJoinReqs.map((r) => (
                <li key={r.org_id}>
                  <div className="border border-gray-200 rounded-lg p-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      {r.org ? (
                        <Link href={`/orgs/${r.org.slug}`} className="font-medium hover:text-brand truncate block">
                          {r.org.name}
                        </Link>
                      ) : (
                        <p className="font-medium text-gray-500 truncate">Unknown org</p>
                      )}
                      <p className="text-xs text-gray-500 mt-0.5">
                        Submitted {new Date(r.joined_at).toLocaleDateString()}
                      </p>
                    </div>
                    <StatusPill status="pending" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {(isAdmin || myOrgIds.length > 0) && (
          <section>
            <h3 className="text-xl font-semibold mb-3">Incoming join requests</h3>
            {!incomingJoinReqs || incomingJoinReqs.length === 0 ? (
              <p className="text-gray-500 text-sm">No pending join requests for your orgs.</p>
            ) : (
              <ul className="space-y-2">
                {incomingJoinReqs.map((r) => {
                  const personName = r.member?.full_name ?? r.member?.email.split("@")[0] ?? "Unknown";
                  return (
                    <li key={`${r.org_id}-${r.user_id}`}>
                      <div className="border border-gray-200 rounded-lg p-3 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium truncate">
                            <Link href={`/profile/${r.user_id}`} className="hover:text-brand">{personName}</Link>
                            {" → "}
                            {r.org
                              ? <Link href={`/orgs/${r.org.slug}`} className="hover:text-brand">{r.org.name}</Link>
                              : <span>Unknown org</span>
                            }
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">{new Date(r.joined_at).toLocaleDateString()}</p>
                        </div>
                        <JoinRequestActions orgId={r.org_id} userId={r.user_id} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
      </div>

      {/* ── MESSAGES ────────────────────────────────────── */}
      <div className="space-y-6">
        <h2 className="text-lg font-semibold text-gray-400 uppercase tracking-wide text-sm">Messages</h2>

        <section>
          <h3 className="text-xl font-semibold mb-3">Message requests I sent</h3>
          {!sentDmReqs || sentDmReqs.length === 0 ? (
            <p className="text-gray-500 text-sm">No pending message requests.</p>
          ) : (
            <ul className="space-y-2">
              {sentDmReqs.map((t) => {
                const otherId = t.user_a === user.id ? t.user_b : t.user_a;
                const other = dmProfileMap.get(otherId);
                const name = other?.full_name ?? other?.email?.split("@")[0] ?? "Unknown";
                return (
                  <li key={t.id}>
                    <Link href={`/messages/${t.id}`} className="block border border-gray-200 rounded-lg p-3 hover:border-brand">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{new Date(t.created_at).toLocaleDateString()}</p>
                        </div>
                        <StatusPill status="pending" />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section>
          <h3 className="text-xl font-semibold mb-3">Incoming message requests</h3>
          {!receivedDmReqs || receivedDmReqs.length === 0 ? (
            <p className="text-gray-500 text-sm">No pending message requests.</p>
          ) : (
            <ul className="space-y-2">
              {receivedDmReqs.map((t) => {
                const otherId = t.user_a === user.id ? t.user_b : t.user_a;
                const other = dmProfileMap.get(otherId);
                const name = other?.full_name ?? other?.email?.split("@")[0] ?? "Unknown";
                return (
                  <li key={t.id}>
                    <div className="border border-gray-200 rounded-lg p-3 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <Link href={`/messages/${t.id}`} className="font-medium hover:text-brand truncate block">{name}</Link>
                        <p className="text-xs text-gray-500 mt-0.5">{new Date(t.created_at).toLocaleDateString()}</p>
                      </div>
                      <DmRequestActions threadId={t.id} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    waitlisted: "bg-amber-100 text-amber-800",
    approved: "bg-green-100 text-green-800",
    denied: "bg-red-100 text-red-800",
    completed: "bg-blue-100 text-blue-800",
    no_show: "bg-gray-200 text-gray-700",
    cancelled: "bg-gray-100 text-gray-500",
    disputed: "bg-orange-100 text-orange-800",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded shrink-0 ${styles[status] ?? "bg-gray-100 text-gray-700"}`}>
      {status.replace("_", " ")}
    </span>
  );
}
