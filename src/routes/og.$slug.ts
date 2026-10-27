import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "../lib/supabase";
import { snapshotSchema } from "../lib/model";

/**
 * Stable Open Graph image URL. A public *published* tour may be shared without
 * distributing short-lived Supabase signed URLs to social media crawlers.
 * RLS policies remain authoritative for publication and Storage access.
 */
export const Route = createFileRoute("/og/$slug")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const slug = params.slug;
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 100) {
          return new Response("Tour inválido", { status: 404 });
        }

        const { data: published, error: publicationError } = await supabase
          .from("published_tours")
          .select("project_id,snapshot")
          .eq("slug", slug)
          .maybeSingle();

        if (publicationError) {
          return new Response("Imagem indisponível", { status: 503 });
        }
        if (!published) return new Response("Não encontrado", { status: 404 });

        const parsed = snapshotSchema.safeParse(published.snapshot);
        if (!parsed.success) {
          return new Response("Imagem indisponível", { status: 503 });
        }
        const snapshot = parsed.data;
        const id =
          snapshot.branding.ogAssetId ??
          snapshot.scenes.find((scene) => scene.id === snapshot.firstSceneId)
            ?.thumbnailAssetId;
        if (!id) return new Response("Sem imagem", { status: 404 });

        const { data: asset, error: assetError } = await supabase
          .from("media_assets")
          .select("path,content_type,status")
          .eq("project_id", published.project_id)
          .eq("id", id)
          .maybeSingle();

        if (assetError) return new Response("Imagem indisponível", { status: 503 });
        if (!asset || asset.status !== "ready")
          return new Response("Sem imagem", { status: 404 });
        if (!["image/jpeg", "image/png", "image/webp"].includes(asset.content_type))
          return new Response("Formato indisponível", { status: 415 });

        // Uses the publishable key and the existing public-published RLS
        // policies. This does not bypass security or reveal draft assets.
        const { data: blob, error: storageError } = await supabase.storage
          .from("tour-media")
          .download(asset.path);

        if (storageError || !blob)
          return new Response("Imagem indisponível", { status: 503 });
        if (blob.size > 8 * 1024 * 1024)
          return new Response("Imagem muito grande", { status: 413 });

        return new Response(blob, {
          status: 200,
          headers: {
            "Content-Type": asset.content_type,
            "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
            "X-Content-Type-Options": "nosniff",
          },
        });
      },
    },
  },
});
