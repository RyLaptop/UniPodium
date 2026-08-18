import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { signOut } from "@/app/auth/actions";
import { NotificationBell, type Notification } from "./_notification-bell";
import { UserAvatar } from "@/components/user-avatar";
import { MobileNav } from "./_mobile-nav";
import { NavLink } from "./_nav-link";
import { AuthGateProvider } from "./_auth-gate";
import { getUniversity, UNIVERSITIES } from "@/lib/university";
import { AdBanner } from "@/components/ad-banner";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const uni = await getUniversity();
  const uniInfo = UNIVERSITIES[uni];
  const supabase = await createClient();
  const svc = createServiceClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [profile, unreadOwn, unreadIncoming, notifRows] = user
    ? await Promise.all([
        supabase
          .from("users")
          .select("full_name, email, avatar_url, is_site_admin, is_verified")
          .eq("id", user.id)
          .single()
          .then((r) => r.data),
        supabase
          .from("speak_requests")
          .select("*", { count: "exact", head: true })
          .eq("requester_user_id", user.id)
          .in("status", ["approved", "denied"])
          .is("requester_read_at", null)
          .then((r) => r.count ?? 0),
        supabase
          .from("speak_requests")
          .select("*", { count: "exact", head: true })
          .neq("requester_user_id", user.id)
          .eq("status", "pending")
          .then((r) => r.count ?? 0),
        supabase
          .from("notifications")
          .select("id, type, title, body, link, created_at")
          .is("dismissed_at", null)
          .order("created_at", { ascending: false })
          .limit(30)
          .then((r) => r.data ?? []),
      ])
    : [null, 0, 0, []];

  const displayName = profile?.full_name ?? user?.email ?? "Guest";
  const requestBadge = (unreadOwn as number) + (unreadIncoming as number);
  const notifications = notifRows as Notification[];
  const isAdmin = (profile as { is_site_admin?: boolean } | null)?.is_site_admin ?? false;

  const { data: ohSettings } = await svc.from("open_house_settings")
    .select("is_active, is_test_mode")
    .eq("university", uni)
    .maybeSingle();
  const showOpenHouse = ohSettings?.is_active || (isAdmin && !!ohSettings?.is_test_mode);

  const navLinks = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/orgs", label: "Orgs" },
    { href: "/bulletin", label: "Bulletin", excludePrefixes: ["/bulletin/admin"] },
    { href: "/requests", label: "Requests", requiresAuth: true },
    { href: "/messages", label: "Messages", requiresAuth: true },
    { href: "/map", label: "Map" },
    { href: "/calendar", label: "Calendar" },
    ...(showOpenHouse ? [{ href: "/open-house", label: "Open House" }] : []),
  ];

  return (
    <AuthGateProvider isAuthed={!!user}>
      <div className="min-h-screen flex flex-col">
        <header className="border-b border-gray-100 bg-white/85 backdrop-blur-md sticky top-0 z-40">
          <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between overflow-hidden">
            <Link href="/dashboard" className="flex items-center gap-2.5 shrink-0 group">
              <svg width="28" height="28" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" style={{ color: "rgb(var(--color-brand))" }} className="transition-transform duration-200 group-hover:-rotate-6">
                <circle cx="40" cy="10" r="4.5" fill="currentColor"/>
                <line x1="40" y1="14.5" x2="40" y2="22" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                <path d="M14 22 L66 22 L60 36 L20 36 Z" fill="#0F172A"/>
                <line x1="26" y1="30" x2="54" y2="30" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M30 36 L50 36 L47 62 L33 62 Z" fill="#0F172A"/>
                <path d="M22 62 L58 62 L60 70 L20 70 Z" fill="#0F172A"/>
              </svg>
              <div className="flex flex-col leading-none">
                <span className="font-display font-bold text-[18px]" style={{ letterSpacing: "-0.025em" }}>
                  <span className="text-slate-900">Uni</span><span className="text-brand">Podium</span>
                </span>
                <span className="text-[10px] text-gray-400 font-medium">{uniInfo.label}</span>
              </div>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-1 text-sm">
              {navLinks.map((l) => (
                <NavLink key={l.href} href={l.href} badge={l.href === "/requests" ? requestBadge : undefined} requiresAuth={l.requiresAuth} excludePrefixes={(l as { excludePrefixes?: string[] }).excludePrefixes}>
                  {l.label}
                </NavLink>
              ))}
              {isAdmin && <NavLink href="/bulletin/admin">Admin</NavLink>}
            </nav>

            <div className="flex items-center gap-2">
              {user ? (
                <>
                  <NotificationBell initialNotifs={notifications} />
                  <Link
                    href={`/profile/${user.id}`}
                    className="hidden md:flex items-center gap-1.5 text-sm text-gray-600 hover:text-brand"
                  >
                    <UserAvatar
                      avatarUrl={(profile as { avatar_url?: string } | null)?.avatar_url}
                      name={displayName}
                      size="sm"
                    />
                    <span className="hidden lg:inline">{displayName}</span>
                  </Link>
                  <form action={signOut} className="hidden md:block">
                    <button type="submit" className="up-btn-secondary !px-3 !py-1.5 text-xs">
                      Sign out
                    </button>
                  </form>
                </>
              ) : (
                <div className="hidden md:flex items-center gap-2">
                  <Link href="/login" className="up-btn-ghost !px-3 !py-1.5 text-xs">
                    Sign in
                  </Link>
                  <Link href="/login?mode=signup" className="up-btn-primary !px-3 !py-1.5 text-xs">
                    Sign up
                  </Link>
                </div>
              )}
              <MobileNav
                links={navLinks}
                requestBadge={requestBadge}
                isAdmin={isAdmin}
                userId={user?.id ?? null}
                displayName={displayName}
                uniLabel={uniInfo.label}
              />
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 md:py-8">
          {children}
        </main>

        <footer className="border-t border-gray-100 bg-white">
          <div className="max-w-6xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400">
            <span>© 2026 UniPodium. All rights reserved.</span>
            <div className="flex gap-5">
              <Link href="/contact" className="hover:text-brand transition-colors">Contact</Link>
              <Link href="/help" className="hover:text-brand transition-colors">Help &amp; Resources</Link>
            </div>
          </div>
        </footer>

        <AdBanner variant="footer" />
      </div>
    </AuthGateProvider>
  );
}
