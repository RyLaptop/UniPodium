import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UniSelector } from "./_uni-selector";
import type { University } from "@/lib/university-data";

export default async function HomePage() {
  const jar = await cookies();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Signed-in users skip the selector and go straight to the app
  if (user && jar.get("uni")?.value) redirect("/dashboard");

  const currentUni = (jar.get("uni")?.value ?? null) as University | null;

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center bg-gray-50 px-4 py-16 overflow-hidden">
      {/* Ambient texture — a quiet dot-grid + soft brand-tinted glow behind the hero */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, rgba(15,23,42,0.06) 1px, transparent 0)",
          backgroundSize: "24px 24px",
          maskImage: "radial-gradient(ellipse 70% 60% at 50% 30%, black 40%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 30%, black 40%, transparent 100%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[640px] h-[640px] rounded-full opacity-[0.14] blur-3xl"
        style={{ backgroundColor: "#3B82F6" }}
      />

      <div className="relative w-full max-w-sm">
        {/* Materialized surface: the hero reads as a real floating panel —
            translucent + blurred + a deep shadow — rather than text sitting
            flat on the page. A bigger surface earns a heavier material. */}
        <div
          className="rounded-3xl px-8 py-10 space-y-10 text-center border border-white/60"
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.72)",
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          {/* Logo */}
          <div className="flex flex-col items-center gap-5">
            <svg width="52" height="52" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-sm">
              <circle cx="40" cy="10" r="4.5" fill="#3B82F6"/>
              <line x1="40" y1="14.5" x2="40" y2="22" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round"/>
              <path d="M14 22 L66 22 L60 36 L20 36 Z" fill="#0F172A"/>
              <line x1="26" y1="30" x2="54" y2="30" stroke="#3B82F6" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M30 36 L50 36 L47 62 L33 62 Z" fill="#0F172A"/>
              <path d="M22 62 L58 62 L60 70 L20 70 Z" fill="#0F172A"/>
            </svg>
            <div>
              <p className="up-eyebrow mb-2" style={{ color: "#3B82F6" }}>Cross-campus speaker platform</p>
              <h1 className="font-display text-5xl font-extrabold text-gray-900" style={{ letterSpacing: "-0.03em" }}>
                Uni<span style={{ color: "#3B82F6" }}>Podium</span>
              </h1>
              <p className="text-gray-500 text-sm mt-2.5 max-w-xs mx-auto leading-relaxed">
                Every org, every meeting, one place to find your slot.
              </p>
            </div>
          </div>

          <UniSelector currentUni={currentUni} />
        </div>
      </div>
    </div>
  );
}
