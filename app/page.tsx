import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UniSelector } from "./_uni-selector";
import { UNIVERSITIES, type University } from "@/lib/university-data";

const CAMPUS_COUNT = Object.keys(UNIVERSITIES).length;

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
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[720px] h-[720px] rounded-full opacity-[0.16] blur-3xl"
        style={{ backgroundColor: "#3B82F6" }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-52 -right-24 w-[420px] h-[420px] rounded-full opacity-[0.10] blur-3xl"
        style={{ backgroundColor: "#60A5FA" }}
      />
      {/* Slow vertical scanline — a quiet "instrument is live" cue behind the glass panel */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 h-px"
        style={{
          top: 0,
          background: "linear-gradient(90deg, transparent, rgba(59,130,246,0.35), transparent)",
          animation: "hud-scan 9s linear infinite",
        }}
      />

      <div className="relative w-full max-w-sm">
        {/* Status readout — a real number, not decoration: how many campuses
            this instance actually serves. Sets the "live system" tone before
            a single word of marketing copy. */}
        <div className="flex justify-center mb-4">
          <span
            className="up-badge inline-flex items-center gap-2 bg-white/70 text-gray-600 border"
            style={{ borderColor: "rgba(59,130,246,0.25)", backdropFilter: "blur(8px)" }}
          >
            <span className="hud-dot" style={{ background: "#3B82F6" }} />
            {CAMPUS_COUNT} campuses online
          </span>
        </div>

        {/* Materialized surface: the hero reads as a real floating panel —
            translucent + blurred + a deep shadow — rather than text sitting
            flat on the page. A bigger surface earns a heavier material, and
            a hairline gradient edge (rather than a flat border) is what
            sells "glass" instead of "white box with a border". */}
        <div
          className="relative rounded-3xl p-[1px]"
          style={{
            background: "linear-gradient(160deg, rgba(59,130,246,0.35), rgba(255,255,255,0.5) 30%, rgba(255,255,255,0.5) 70%, rgba(59,130,246,0.2))",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          <div
            className="rounded-[calc(1.5rem-1px)] px-8 py-10 space-y-10 text-center"
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.78)",
              backdropFilter: "blur(20px) saturate(180%)",
              WebkitBackdropFilter: "blur(20px) saturate(180%)",
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
                <p className="up-eyebrow mb-2 justify-center" style={{ color: "#3B82F6" }}>Cross-campus speaker platform</p>
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
    </div>
  );
}
