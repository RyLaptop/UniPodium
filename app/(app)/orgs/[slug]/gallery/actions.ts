"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isOrgStaff } from "@/lib/auth/org-access";
import { validateImageUpload } from "@/lib/utils";

export async function getUploadUrl(orgId: string, fileName: string, contentType: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false as const, error: "Not signed in." };
    if (!await isOrgStaff(supabase, orgId, user.id)) return { ok: false as const, error: "Only staff can post." };
    const uploadError = validateImageUpload({ type: contentType });
    if (uploadError) return { ok: false as const, error: uploadError };

    const ext = fileName.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${orgId}/${Date.now()}.${ext}`;

    const svc = createServiceClient();
    const { data, error } = await svc.storage.from("org-posts").createSignedUploadUrl(path);
    if (error) return { ok: false as const, error: error.message };

    return { ok: true as const, signedUrl: data.signedUrl, path };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Failed to prepare upload." };
  }
}

export async function createOrgPost(orgId: string, orgSlug: string, caption: string, imagePath: string | null) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false as const, error: "Not signed in." };
    if (!await isOrgStaff(supabase, orgId, user.id)) return { ok: false as const, error: "Only staff can post." };

    if (!caption.trim() && !imagePath) return { ok: false as const, error: "Add a caption or image." };

    const svc = createServiceClient();
    let imageUrl: string | null = null;
    if (imagePath) {
      const { data: { publicUrl } } = svc.storage.from("org-posts").getPublicUrl(imagePath);
      imageUrl = publicUrl;
    }

    const { error } = await svc.from("org_posts").insert({
      org_id: orgId,
      author_id: user.id,
      caption: caption.trim() || null,
      image_url: imageUrl,
    });
    if (error) return { ok: false as const, error: error.message };

    revalidatePath(`/orgs/${orgSlug}/gallery`);
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Something went wrong." };
  }
}

export async function deleteOrgPost(postId: string, orgId: string, orgSlug: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false as const, error: "Not signed in." };

    const svc = createServiceClient();
    const { data: post } = await svc.from("org_posts").select("author_id, image_url").eq("id", postId).single();
    if (!post) return { ok: false as const, error: "Post not found." };

    const isAuthor = post.author_id === user.id;
    const isStaff = await isOrgStaff(supabase, orgId, user.id);
    if (!isAuthor && !isStaff) return { ok: false as const, error: "Not authorized." };

    if (post.image_url) {
      const url = new URL(post.image_url);
      const parts = url.pathname.split("/org-posts/");
      if (parts[1]) await svc.storage.from("org-posts").remove([parts[1]]);
    }

    const { error } = await svc.from("org_posts").delete().eq("id", postId);
    if (error) return { ok: false as const, error: error.message };

    revalidatePath(`/orgs/${orgSlug}/gallery`);
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Something went wrong." };
  }
}
