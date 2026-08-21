import { Resend } from "resend";

let client: Resend | null = null;

export function getResend(): Resend {
  if (!client) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY not set");
    }
    client = new Resend(process.env.RESEND_API_KEY);
  }
  return client;
}

// Falls back to Resend's shared sandbox sender until you verify a domain
// (Resend dashboard → Domains). Set RESEND_FROM_EMAIL once unipodium.app is verified.
export const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL || "UniPodium <onboarding@resend.dev>";
