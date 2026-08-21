"use server";

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isEmailAllowed } from "@/lib/auth/allowed-domains";
import { UNIVERSITIES } from "@/lib/university-data";
import type { University } from "@/lib/university";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const VALID_UNI_KEYS = Object.keys(UNIVERSITIES) as University[];

export type SignInResult =
  | { ok: true; email: string; pendingApproval?: boolean }
  | { ok: false; error: string };

export async function signInWithPassword(
  _prev: SignInResult | null,
  formData: FormData
): Promise<SignInResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { ok: false, error: "Enter your email and password." };
  }
  if (!isEmailAllowed(email)) {
    return { ok: false, error: "That email domain isn't allowed on this platform." };
  }
  const ip = clientIp(await headers());
  if (!rateLimit(`signin:${ip}`, 10, 900_000)) {
    return { ok: false, error: "Too many attempts, please wait and try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { ok: false, error: error.message };
  }
  redirect("/dashboard");
}

export async function signUpWithPassword(
  _prev: SignInResult | null,
  formData: FormData
): Promise<SignInResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const university = String(formData.get("university") ?? "") as University;

  if (!email || !password) {
    return { ok: false, error: "Enter your email and password." };
  }
  if (!name) {
    return { ok: false, error: "Enter a display name." };
  }
  if (!VALID_UNI_KEYS.includes(university)) {
    return { ok: false, error: "Select your university." };
  }
  if (!isEmailAllowed(email)) {
    return { ok: false, error: "That email domain isn't allowed on this platform." };
  }
  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }
  const confirmPassword = String(formData.get("confirm_password") ?? "");
  if (password !== confirmPassword) {
    return { ok: false, error: "Passwords do not match." };
  }
  const ip = clientIp(await headers());
  if (!rateLimit(`signup:${ip}`, 5, 3_600_000)) {
    return { ok: false, error: "Too many attempts, please wait and try again." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name } },
  });

  if (error) {
    const msg = error.message && error.message.trim() && !error.message.startsWith("{")
      ? error.message
      : "Account creation failed. If you recently had an account deleted, wait a few minutes and try again.";
    return { ok: false, error: msg };
  }
  if (!data.user) {
    return { ok: false, error: "Signup failed." };
  }

  // Auto-confirm the email and mark the account as verified so no extra
  // steps are needed before the user can access the app.
  const svc = createServiceClient();
  await svc.auth.admin.updateUserById(data.user.id, { email_confirm: true });
  await svc.from("users").update({ is_verified: true, university }).eq("id", data.user.id);

  const jar = await cookies();
  jar.set("uni", university, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });

  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
