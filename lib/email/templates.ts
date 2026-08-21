const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://unipodium.com";

type EmailResult = { subject: string; html: string };

function link(path: string, label: string) {
  return `<a href="${APP_URL}${path}" style="color:#2563eb">${label}</a>`;
}

export function reminderEmail({
  recipientName,
  orgName,
  meetingTitle,
  startsAt,
  location,
  hoursOut,
}: {
  recipientName: string;
  orgName: string;
  meetingTitle: string;
  startsAt: string;
  location: string | null;
  hoursOut: 24 | 1;
}): EmailResult {
  const when = new Date(startsAt).toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" });
  const label = hoursOut === 24 ? "tomorrow" : "in about an hour";
  const subject = `Reminder: you're speaking at ${orgName} ${label}`;
  const html = `
    <p>Hi ${recipientName},</p>
    <p>Reminder — you're approved to speak at <strong>${orgName}</strong>'s meeting
    "<strong>${meetingTitle}</strong>" ${label}.</p>
    <p><strong>When:</strong> ${when}<br/>
    <strong>Where:</strong> ${location ?? "TBD"}</p>
    <p>— UniPodium</p>
  `;
  return { subject, html };
}

export function dmRequestEmail({
  senderName,
  preview,
  threadPath,
}: {
  senderName: string;
  preview: string;
  threadPath: string;
}): EmailResult {
  const subject = `${senderName} wants to chat on UniPodium`;
  const html = `
    <p><strong>${senderName}</strong> sent you a message request on UniPodium.</p>
    <blockquote style="border-left:3px solid #e5e7eb;margin:12px 0;padding:8px 12px;color:#374151">${preview}</blockquote>
    <p>${link(threadPath, "View and respond →")}</p>
    <p>— UniPodium</p>
  `;
  return { subject, html };
}

export function speakDecisionEmail({
  recipientName,
  orgName,
  meetingTitle,
  approved,
  requestPath,
}: {
  recipientName: string;
  orgName: string;
  meetingTitle: string;
  approved: boolean;
  requestPath: string;
}): EmailResult {
  const subject = approved
    ? `Approved! You're speaking at ${orgName}`
    : `Your speak request for ${orgName} was declined`;
  const html = approved
    ? `<p>Hi ${recipientName},</p>
       <p>Great news — <strong>${orgName}</strong> approved your request to speak at "<strong>${meetingTitle}</strong>".</p>
       <p>${link(requestPath, "View your request →")}</p>
       <p>— UniPodium</p>`
    : `<p>Hi ${recipientName},</p>
       <p><strong>${orgName}</strong> was unable to approve your speak request for "<strong>${meetingTitle}</strong>".</p>
       <p>${link(requestPath, "View your request →")}</p>
       <p>— UniPodium</p>`;
  return { subject, html };
}

export function waitlistPromotedEmail({
  recipientName,
  orgName,
  meetingTitle,
  startsAt,
  location,
  requestPath,
}: {
  recipientName: string;
  orgName: string;
  meetingTitle: string;
  startsAt: string;
  location: string | null;
  requestPath: string;
}): EmailResult {
  const when = new Date(startsAt).toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" });
  const subject = `You're now approved to speak at ${orgName}!`;
  const html = `
    <p>Hi ${recipientName},</p>
    <p>A spot opened up — you've been moved off the waitlist and approved to speak at <strong>${orgName}</strong>'s meeting "<strong>${meetingTitle}</strong>".</p>
    <p><strong>When:</strong> ${when}<br/><strong>Where:</strong> ${location ?? "TBD"}</p>
    <p>${link(requestPath, "View your request →")}</p>
    <p>— UniPodium</p>
  `;
  return { subject, html };
}

export function orgJoinDecisionEmail({
  recipientName,
  orgName,
  approved,
  orgPath,
}: {
  recipientName: string;
  orgName: string;
  approved: boolean;
  orgPath: string;
}): EmailResult {
  const subject = approved
    ? `Welcome to ${orgName} on UniPodium!`
    : `Your request to join ${orgName} was declined`;
  const html = approved
    ? `<p>Hi ${recipientName},</p>
       <p>Your request to join <strong>${orgName}</strong> has been approved — welcome aboard!</p>
       <p>${link(orgPath, "View org →")}</p>
       <p>— UniPodium</p>`
    : `<p>Hi ${recipientName},</p>
       <p>Your request to join <strong>${orgName}</strong> was not approved at this time.</p>
       <p>— UniPodium</p>`;
  return { subject, html };
}

export function orgRoleChangedEmail({
  recipientName,
  orgName,
  promoted,
  orgPath,
}: {
  recipientName: string;
  orgName: string;
  promoted: boolean;
  orgPath: string;
}): EmailResult {
  const subject = promoted
    ? `You're now STAFF of ${orgName} on UniPodium`
    : `You've been removed from ${orgName} on UniPodium`;
  const html = promoted
    ? `<p>Hi ${recipientName},</p>
       <p>You've been promoted to <strong>STAFF</strong> of <strong>${orgName}</strong> on UniPodium.</p>
       <p>${link(orgPath, "View org →")}</p>
       <p>— UniPodium</p>`
    : `<p>Hi ${recipientName},</p>
       <p>You have been removed from <strong>${orgName}</strong> on UniPodium.</p>
       <p>— UniPodium</p>`;
  return { subject, html };
}

export function bulletinDecisionEmail({
  recipientName,
  eventTitle,
  approved,
}: {
  recipientName: string;
  eventTitle: string;
  approved: boolean;
}): EmailResult {
  const subject = approved
    ? `Your bulletin event "${eventTitle}" was approved`
    : `Your bulletin event "${eventTitle}" was declined`;
  const html = approved
    ? `<p>Hi ${recipientName},</p>
       <p>Your bulletin post "<strong>${eventTitle}</strong>" has been approved and is now live on UniPodium.</p>
       <p>${link("/bulletin", "View bulletin →")}</p>
       <p>— UniPodium</p>`
    : `<p>Hi ${recipientName},</p>
       <p>Your bulletin post "<strong>${eventTitle}</strong>" was not approved.</p>
       <p>— UniPodium</p>`;
  return { subject, html };
}

export function orgCreationDecisionEmail({
  recipientName,
  orgName,
  approved,
  orgPath,
  reason,
}: {
  recipientName: string;
  orgName: string;
  approved: boolean;
  orgPath?: string;
  reason?: string | null;
}): EmailResult {
  const subject = approved
    ? `Your org "${orgName}" has been approved on UniPodium!`
    : `Your org request for "${orgName}" was declined`;
  const html = approved
    ? `<p>Hi ${recipientName},</p>
       <p>Great news — your org <strong>${orgName}</strong> has been approved on UniPodium!</p>
       ${orgPath ? `<p>${link(orgPath, "Visit your org →")}</p>` : ""}
       <p>— UniPodium</p>`
    : `<p>Hi ${recipientName},</p>
       <p>Your request to create <strong>${orgName}</strong> was not approved.${reason ? ` Reason: ${reason}` : ""}</p>
       <p>— UniPodium</p>`;
  return { subject, html };
}

export function orgIncomingSpeakRequestEmail({
  orgName,
  requesterName,
  requesterOrgName,
  meetingTitle,
  pitch,
  meetingPath,
}: {
  orgName: string;
  requesterName: string;
  requesterOrgName: string | null;
  meetingTitle: string;
  pitch: string;
  meetingPath: string;
}): EmailResult {
  const from = requesterOrgName ? `${requesterName} (${requesterOrgName})` : requesterName;
  const subject = `New speak request for ${orgName}: ${meetingTitle}`;
  const html = `
    <p><strong>${from}</strong> submitted a speak request for your meeting "<strong>${meetingTitle}</strong>".</p>
    <blockquote style="border-left:3px solid #e5e7eb;margin:12px 0;padding:8px 12px;color:#374151">${pitch}</blockquote>
    <p>${link(meetingPath, "Review the request →")}</p>
    <p>— UniPodium</p>
  `;
  return { subject, html };
}

export function orgIncomingJoinRequestEmail({
  orgName,
  requesterName,
  requesterEmail,
  orgPath,
}: {
  orgName: string;
  requesterName: string;
  requesterEmail: string;
  orgPath: string;
}): EmailResult {
  const subject = `New join request for ${orgName} on UniPodium`;
  const html = `
    <p><strong>${requesterName}</strong> (${requesterEmail}) wants to join <strong>${orgName}</strong>.</p>
    <p>${link(orgPath, "Review on your org page →")}</p>
    <p>— UniPodium</p>
  `;
  return { subject, html };
}
