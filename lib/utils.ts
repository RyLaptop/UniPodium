import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Several server actions/pages interpolate an id straight into a Supabase
// `.or("user_a.eq.${id},...")` filter string. Postgrest parses that string
// as query syntax, so an unvalidated id (especially one from a URL param or
// a server-action argument, both directly attacker-suppliable) is a filter
// injection vector -- validate it's actually a UUID before it touches the
// string. Postgres uuid columns only ever hold this shape, so this can't
// reject a legitimate id.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}
