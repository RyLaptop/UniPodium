import { notFound } from "next/navigation";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/service";
import { PostActions } from "../_post-actions";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function BulletinPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const svc = createServiceClient();
  const supabase = await createClient();

  const [{ data: post }, { data: { user } }] = await Promise.all([
    svc
      .from("bulletin_posts")
      .select("id, submitter_id, org_id, event_title, event_description, event_at, event_location, thumbnail_url, banner_url, website_url, instagram_url, orgs(name, slug), status")
      .eq("id", id)
      .eq("status", "approved")
      .single(),
    supabase.auth.getUser(),
  ]);

  if (!post) notFound();

  const org = post.orgs as unknown as { name: string; slug: string } | null;

  let isAdmin = false;
  let isOrgStaff = false;

  if (user) {
    const { data: profile } = await supabase.from("users").select("is_site_admin").eq("id", user.id).single();
    isAdmin = profile?.is_site_admin ?? false;

    if (!isAdmin && post.org_id) {
      const { data: mem } = await supabase.from("org_members").select("role")
        .eq("org_id", post.org_id).eq("user_id", user.id).eq("status", "active").maybeSingle();
      isOrgStaff = mem?.role === "director";
    }
  }

  const canManage = isAdmin || post.submitter_id === user?.id || isOrgStaff;
  const bannerUrl = (post as unknown as { banner_url: string | null }).banner_url;
  const thumbnailUrl = (post as unknown as { thumbnail_url: string | null }).thumbnail_url;
  const websiteUrl = (post as unknown as { website_url: string | null }).website_url;
  const instagramUrl = (post as unknown as { instagram_url: string | null }).instagram_url;

  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/bulletin" className="text-sm text-brand hover:underline">
        ← Bulletin board
      </Link>

      {bannerUrl ? (
        <div className="w-full rounded-xl overflow-hidden">
          <img
            src={bannerUrl}
            alt={post.event_title}
            className="w-full max-h-72 object-cover"
          />
        </div>
      ) : thumbnailUrl ? (
        <div className="w-full rounded-xl overflow-hidden">
          <img
            src={thumbnailUrl}
            alt={post.event_title}
            className="w-full max-h-48 object-cover"
          />
        </div>
      ) : null}

      <div>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-3xl font-bold">{post.event_title}</h1>
          {canManage && (
            <div className="shrink-0 mt-1">
              <PostActions
                postId={post.id}
                title={post.event_title}
                description={post.event_description}
                eventAt={post.event_at}
                location={post.event_location}
                redirectAfterDelete="/bulletin"
              />
            </div>
          )}
        </div>

        <div className="mt-3 space-y-1 text-sm text-gray-500">
          <p>
            {new Date(post.event_at).toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}{" "}
            at{" "}
            {new Date(post.event_at).toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
          {post.event_location && (
            <p className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-gray-400 shrink-0" strokeWidth={2.25} />
              {post.event_location}
            </p>
          )}
          {org && (
            <p>
              Hosted by{" "}
              <Link href={`/orgs/${org.slug}`} className="text-brand hover:underline">
                {org.name}
              </Link>
            </p>
          )}
        </div>

        {post.event_description && (
          <p className="mt-5 text-gray-700 whitespace-pre-line leading-relaxed">
            {post.event_description}
          </p>
        )}

        {(websiteUrl || instagramUrl) && (
          <div className="mt-6 flex flex-wrap gap-3">
            {websiteUrl && (
              <a
                href={websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-brand text-white rounded-lg text-sm hover:bg-brand-dark transition"
              >
                Visit website
              </a>
            )}
            {instagramUrl && (
              <a
                href={instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition flex items-center gap-1.5"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
                Instagram
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
