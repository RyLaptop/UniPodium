export const metadata = { title: "Privacy Policy — UniPodium" };

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-16">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-3xl font-extrabold text-gray-900 mb-1">Privacy Policy</h1>
        <p className="text-sm text-gray-400 mb-10">Last updated August 22, 2026 — drafted, not yet reviewed by a lawyer.</p>

        <div className="space-y-8 text-gray-700 leading-relaxed">
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">1. What we collect</h2>
            <p>Your university email (for sign-in and identity verification), profile info you add (name, bio, major, social links, avatar), org membership and role, meeting/speak-request activity, chat and direct messages you send, and images you upload (avatars, org logos, bulletin/gallery/booth images).</p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-2">2. How we use it</h2>
            <p>To run the platform: authenticating you, showing your org memberships, matching speak requests to meeting slots, sending transactional email (meeting reminders, request status) via Resend, and displaying content you or your org posted. We don&apos;t sell your data.</p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-2">3. Who can see what</h2>
            <p>Org profiles, bulletin posts, and gallery/booth content are public to signed-in users. Direct messages and chat are visible only to participants. Row-level security policies enforce these boundaries at the database level.</p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-2">4. Where it&apos;s stored</h2>
            <p>Data lives in Supabase (Postgres, Auth, file storage), hosted on infrastructure in the United States. Site is deployed on Vercel. We use Resend to send email; message content and delivery metadata pass through their systems for that purpose.</p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-2">5. Advertising</h2>
            <p>UniPodium shows ads to support the platform. Ad partners may use standard tracking (cookies, device identifiers) subject to their own privacy policies — we don&apos;t share your account data (email, messages, org membership) with ad partners.</p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-2">6. Your controls</h2>
            <p>You can edit or remove your profile info at any time, and delete your account from your profile page — this removes your public profile and personal data from active use. Deleting your account doesn&apos;t retroactively delete messages you sent to others, since that would delete the other participant&apos;s conversation too.</p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-2">7. Data retention</h2>
            <p>We keep account and activity data for as long as your account is active, plus a reasonable period after deletion for backups and abuse prevention.</p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-2">8. Changes</h2>
            <p>We may update this policy as the platform changes. Material changes will be reflected by an updated date on this page.</p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-2">9. Contact</h2>
            <p>Questions about your data: reach out through the contact info on your campus&apos;s UniPodium page.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
