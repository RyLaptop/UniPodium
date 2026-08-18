import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return (
    <div className="flex flex-col items-center justify-center py-24 text-center text-gray-500 gap-3">
      <p className="text-lg font-medium text-gray-700">Sign in to view your messages</p>
      <p className="text-sm">To access this feature you must be signed in.</p>
      <div className="flex gap-3 mt-2">
        <Link href="/login" className="up-btn-primary">Sign in</Link>
        <Link href="/login?mode=signup" className="up-btn-secondary">Create account</Link>
      </div>
    </div>
  );

  const svc = createServiceClient();
  const { data: threads } = await svc.from("dm_threads")
    .select("id, status, initiated_by, created_at, user_a, user_b")
    .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
    .neq("status", "declined")
    .order("created_at", { ascending: false });

  // Fetch the other user's profile for each thread
  const otherIds = (threads ?? []).map((t) => t.user_a === user.id ? t.user_b : t.user_a);
  const { data: profiles } = otherIds.length > 0
    ? await svc.from("users").select("id, full_name, email").in("id", otherIds)
    : { data: [] };

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold">Messages</h1>

      {(!threads || threads.length === 0) ? (
        <p className="text-gray-500 text-sm">No messages yet. Visit someone&apos;s profile to start a conversation.</p>
      ) : (
        <ul className="space-y-2">
          {threads.map((t) => {
            const otherId = t.user_a === user.id ? t.user_b : t.user_a;
            const other = profileMap.get(otherId);
            const isPending = t.status === "pending";
            const isIncoming = isPending && t.initiated_by !== user.id;
            return (
              <li key={t.id}>
                <Link
                  href={`/messages/${t.id}`}
                  className="flex items-center justify-between border border-gray-200 rounded-lg px-4 py-3 hover:border-brand transition"
                >
                  <div>
                    <p className="font-medium">{other?.full_name ?? other?.email?.split("@")[0] ?? "Unknown"}</p>
                    {isPending && (
                      <p className="text-xs text-yellow-700 mt-0.5">
                        {isIncoming ? "Sent you a message request" : "Request pending"}
                      </p>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    t.status === "accepted" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                  }`}>
                    {t.status}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
