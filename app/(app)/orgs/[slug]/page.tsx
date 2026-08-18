import Link from "next/link";
import { Clock, Lock } from "lucide-react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { tagPill, tagLabel } from "../_tag-colors";
import { InviteLink } from "./_invite-link";
import { JoinLeaveButton } from "./_join-leave";
import { PendingMembers } from "./_pending-members";
import { ActiveMembers } from "./_active-members";
import { EditOrgForm } from "./_edit-org";
import { DeleteOrgButton } from "./_delete-org";
import { Affiliations } from "./_affiliations";
import { CohostInvites } from "./_cohost-invites";
import { AuthGatedLink } from "@/app/(app)/_auth-gate";

export const dynamic = "force-dynamic";

export default async function OrgProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const svc = createServiceClient();
  const { data: org } = await svc
    .from("orgs")
    .select("id, slug, name, description, created_at, tags, logo_url, status, contact_email, website_url, tiktok_url, instagram_url, groupme_url, flare_url, social_links_locked")
    .eq("slug", slug)
    .single();

  if (!org) notFound();

  // Pending orgs only visible to the founder (director) or admins
  const { data: myMembership } = user
    ? await supabase.from("org_members").select("role, status").eq("org_id", org.id).eq("user_id", user.id).maybeSingle()
    : { data: null };

  const { data: profile } = user
    ? await supabase.from("users").select("is_site_admin").eq("id", user.id).single()
    : { data: null };

  if (org.status === "pending" && myMembership?.role !== "director" && !profile?.is_site_admin) {
    notFound();
  }

  const [{ data: members }, { data: meetings }, { data: existingInvite }, { data: affiliatedRows }, { data: allOrgs }, { data: cohostInviteRows }] =
    await Promise.all([
      svc.from("org_members").select("role, status, title, users(id, full_name, email)").eq("org_id", org.id),
      svc.from("meetings")
        .select("id, title, starts_at, location, slots_open, cancelled_at")
        .eq("org_id", org.id)
        .gte("starts_at", new Date().toISOString())
        .is("cancelled_at", null)
        .order("starts_at", { ascending: true })
        .limit(52),
      svc.from("org_invites").select("id, code").eq("org_id", org.id).maybeSingle(),
      svc.from("org_affiliations")
        .select("id, org_id, affiliate_org_id, status, requester_org:orgs!org_affiliations_org_id_fkey(id, slug, name), target_org:orgs!org_affiliations_affiliate_org_id_fkey(id, slug, name)")
        .or(`org_id.eq.${org.id},affiliate_org_id.eq.${org.id}`)
        .neq("status", "declined"),
      svc.from("orgs").select("id, slug, name").eq("status", "approved").order("name"),
      svc.from("meeting_cohosts")
        .select("id, meeting_id, meetings(id, title, starts_at, orgs(name, slug))")
        .eq("org_id", org.id)
        .eq("status", "pending"),
    ]);

  const meetingIds = (meetings ?? []).map((m) => m.id);
  const { data: approvedRows } = meetingIds.length > 0
    ? await svc.from("speak_requests").select("meeting_id")
        .in("meeting_id", meetingIds).in("status", ["approved", "completed"])
    : { data: [] };

  const approvedByMeeting = new Map<string, number>();
  for (const row of approvedRows ?? []) {
    approvedByMeeting.set(row.meeting_id, (approvedByMeeting.get(row.meeting_id) ?? 0) + 1);
  }

  const activeMembers = (members ?? []).filter((m) => m.status === "active");
  const pendingMembers = (members ?? []).filter((m) => m.status === "pending");
  const memberCount = activeMembers.length;
  const isAdmin = profile?.is_site_admin ?? false;
  const myRole = myMembership?.role as "member" | "officer" | "director" | undefined;
  const myStatus = myMembership?.status as "active" | "pending" | undefined;
  const isPending = myStatus === "pending";
  const isMember = !!myRole && myStatus === "active";
  const isDirector = (isMember && myRole === "director") || isAdmin;
  const canManage = (isMember && (myRole === "director" || myRole === "officer")) || isAdmin;

  const pendingForDirector = isDirector
    ? pendingMembers.map((m) => {
        const u = m.users as unknown as { id: string; full_name: string | null; email: string };
        return { user_id: u.id, full_name: u.full_name, email: u.email };
      })
    : [];

  const activeMembersForDirector = isDirector
    ? activeMembers.map((m) => {
        const u = m.users as unknown as { id: string; full_name: string | null; email: string };
        return { user_id: u.id, full_name: u.full_name, email: u.email, role: m.role, title: (m as unknown as { title: string | null }).title ?? null };
      })
    : [];

  const tags = (org.tags as unknown as string[]) ?? [];

  type AffiliationRow = {
    id: string;
    status: "pending" | "accepted" | "declined";
    isOutgoing: boolean;
    org: { id: string; slug: string; name: string };
  };

  const affiliationRows: AffiliationRow[] = (affiliatedRows ?? []).map((r) => {
    const row = r as unknown as {
      id: string; org_id: string; affiliate_org_id: string; status: string;
      requester_org: { id: string; slug: string; name: string };
      target_org: { id: string; slug: string; name: string };
    };
    const isOutgoing = row.org_id === org.id;
    return {
      id: row.id,
      status: row.status as "pending" | "accepted" | "declined",
      isOutgoing,
      org: isOutgoing ? row.target_org : row.requester_org,
    };
  });

  const allOrgsList = (allOrgs ?? []).filter((o) => o.id !== org.id).map((o) => ({ id: o.id, slug: o.slug, name: o.name }));

  type CohostInvite = {
    id: string;
    meetingId: string;
    meetingTitle: string;
    startsAt: string;
    hostOrg: { name: string; slug: string };
  };

  const cohostInvites: CohostInvite[] = (cohostInviteRows ?? []).map((r) => {
    const row = r as unknown as {
      id: string;
      meeting_id: string;
      meetings: { id: string; title: string; starts_at: string; orgs: { name: string; slug: string } };
    };
    return {
      id: row.id,
      meetingId: row.meeting_id,
      meetingTitle: row.meetings.title,
      startsAt: row.meetings.starts_at,
      hostOrg: row.meetings.orgs,
    };
  });

  return (
    <div className="space-y-8">
      <div>
        <Link href="/orgs" className="text-sm text-gray-500 hover:text-brand">← Orgs</Link>

        {org.status === "pending" && (
          <div className="mt-3 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800 flex items-center gap-1.5">
            <Clock className="w-4 h-4 shrink-0" strokeWidth={2.5} />
            This org is pending admin approval.
          </div>
        )}

        <div className="mt-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            {org.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={org.logo_url}
                alt={org.name}
                className="w-16 h-16 rounded-full object-cover border border-gray-200 shrink-0"
              />
            )}
            <div className="min-w-0">
              <h1 className="font-display text-3xl font-extrabold tracking-tight text-gray-900">{org.name}</h1>
              {org.description && (
                <p className="text-gray-600 mt-2 max-w-2xl leading-relaxed">{org.description}</p>
              )}
              <p className="text-sm text-gray-500 mt-2">
                <strong>Members:</strong> {memberCount}
              </p>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {tags.map((tag) => (
                    <span key={tag} className={`text-xs px-2 py-0.5 rounded-full ${tagPill(tag)}`}>
                      {tagLabel(tag)}
                    </span>
                  ))}
                </div>
              )}
              {(() => {
                const o = org as unknown as { website_url?: string | null; tiktok_url?: string | null; instagram_url?: string | null; groupme_url?: string | null; flare_url?: string | null; social_links_locked?: boolean };
                const ensureProtocol = (url: string) =>
                  /^https?:\/\//i.test(url) ? url : `https://${url}`;
                const publicLinks = [
                  o.website_url ? { href: ensureProtocol(o.website_url), label: "Website" } : null,
                  o.tiktok_url ? { href: ensureProtocol(o.tiktok_url), label: "TikTok" } : null,
                  o.instagram_url ? { href: ensureProtocol(o.instagram_url), label: "Instagram" } : null,
                ].filter(Boolean) as { href: string; label: string }[];
                const canSeeCommunity = !o.social_links_locked || isMember || isAdmin;
                const communityLinks = canSeeCommunity ? [
                  o.groupme_url ? { href: ensureProtocol(o.groupme_url), label: "GroupMe" } : null,
                  o.flare_url ? { href: ensureProtocol(o.flare_url), label: "Flare" } : null,
                ].filter(Boolean) as { href: string; label: string }[] : [];
                const allLinks = [...publicLinks, ...communityLinks];
                const showLockedHint = o.social_links_locked && !isMember && !isAdmin && (o.groupme_url || o.flare_url);
                return (
                  <>
                    {allLinks.length > 0 && (
                      <div className="flex flex-wrap gap-3 mt-2">
                        {allLinks.map((l) => (
                          <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-brand hover:underline">
                            {l.label} ↗
                          </a>
                        ))}
                      </div>
                    )}
                    {showLockedHint && (
                      <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                        <Lock className="w-3 h-3" strokeWidth={2.5} />
                        Join to see community chat links
                      </p>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          <div className="flex flex-row sm:flex-col gap-2 shrink-0">
            <JoinLeaveButton orgId={org.id} isMember={isMember} isPending={isPending} isDirector={isDirector} myRole={myRole ?? null} />
            {canManage && (
              <AuthGatedLink
                href={`/orgs/${org.slug}/meetings/new`}
                className="up-btn-secondary text-center"
              >
                + New meeting
              </AuthGatedLink>
            )}
          </div>
        </div>

        {isDirector && (
          <div className="mt-4 space-y-3">
            <EditOrgForm
              orgId={org.id}
              orgSlug={org.slug}
              currentName={org.name}
              currentDescription={org.description}
              currentTags={tags}
              currentLogoUrl={org.logo_url}
              currentContactEmail={(org as unknown as { contact_email?: string | null }).contact_email ?? null}
              currentWebsiteUrl={(org as unknown as { website_url?: string | null }).website_url ?? null}
              currentTiktokUrl={(org as unknown as { tiktok_url?: string | null }).tiktok_url ?? null}
              currentInstagramUrl={(org as unknown as { instagram_url?: string | null }).instagram_url ?? null}
              currentGroupmeUrl={(org as unknown as { groupme_url?: string | null }).groupme_url ?? null}
              currentFlareUrl={(org as unknown as { flare_url?: string | null }).flare_url ?? null}
              currentSocialLinksLocked={(org as unknown as { social_links_locked?: boolean }).social_links_locked ?? false}
            />
            <InviteLink orgId={org.id} orgSlug={org.slug} existingCode={existingInvite?.code ?? null} />
            <DeleteOrgButton orgId={org.id} orgName={org.name} />
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href={`/orgs/${org.slug}/gallery`}
          className="up-btn-invert">
          Gallery
        </Link>
        {canManage && (
          <Link href={`/orgs/${org.slug}/booth`}
            className="up-btn-invert">
            Edit Booth
          </Link>
        )}
        <Link href={`/orgs/${org.slug}/surveys`}
          className="up-btn-invert">
          Surveys
        </Link>
        {isMember && (
          <>
            <Link href={`/orgs/${org.slug}/checklist`}
              className="up-btn-invert">
              New Member Checklist
            </Link>
            <Link href={`/orgs/${org.slug}/awards`}
              className="up-btn-invert">
              Awards
            </Link>
          </>
        )}
        <a href="https://stuactonline.tamu.edu/online/forms/incident_reporting/index"
          target="_blank" rel="noopener noreferrer"
          className="up-btn-invert">
          Anonymous Report
        </a>
      </div>

      <Affiliations
        orgId={org.id}
        orgSlug={org.slug}
        affiliations={affiliationRows}
        allOrgs={allOrgsList}
        isDirector={isDirector || (myMembership?.role === "officer" && myMembership?.status === "active")}
      />

      {canManage && cohostInvites.length > 0 && (
        <CohostInvites invites={cohostInvites} orgSlug={org.slug} />
      )}

      {pendingForDirector.length > 0 && (
        <PendingMembers orgId={org.id} members={pendingForDirector} />
      )}

      {activeMembersForDirector.length > 0 && (
        <ActiveMembers orgId={org.id} members={activeMembersForDirector} currentUserId={user?.id} />
      )}

      <section>
        <h2 className="font-display text-xl font-bold text-gray-900 mb-3">Upcoming meetings</h2>
        {!meetings || meetings.length === 0 ? (
          <div className="border border-dashed border-gray-300 rounded-2xl p-6 text-center text-gray-500 text-sm">
            No meetings scheduled.{canManage && " Officers or STAFF can add one."}
          </div>
        ) : (
          <ul className="space-y-2.5">
            {meetings.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/orgs/${org.slug}/meetings/${m.id}`}
                  className="up-card-hover block p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{m.title}</h3>
                      <p className="text-sm text-gray-500">
                        {new Date(m.starts_at).toLocaleString()}
                        {m.location && ` · ${m.location}`}
                      </p>
                    </div>
                    <div className="text-sm">
                      {(() => {
                        const remaining = Math.max(0, m.slots_open - (approvedByMeeting.get(m.id) ?? 0));
                        return remaining === 0
                          ? <span className="text-red-500 font-medium">Full</span>
                          : <span className="text-gray-500">{remaining} slot{remaining === 1 ? "" : "s"} open</span>;
                      })()}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
