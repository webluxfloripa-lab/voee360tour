import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { TourPage } from "../components/TourPage";
import { TourUnavailable } from "../components/TourUnavailable";
import { getPublicTour } from "../lib/api";
import { usePublishedTour } from "../lib/usePublishedTour";
const loadTour = createServerFn({ method: "GET" })
  .validator(
    z.object({
      slug: z
        .string()
        .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
        .max(100),
    }),
  )
  .handler(async ({ data }) => getPublicTour(data.slug));

export const Route = createFileRoute("/t/$slug")({
  staleTime: 0,
  gcTime: 0,
  loader: async ({ params }) => {
    if (
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(params.slug) ||
      params.slug.length > 100
    )
      throw notFound();
    const tour = await loadTour({ data: { slug: params.slug } });
    if (!tour) throw notFound();
    return tour;
  },
  head: ({ loaderData: t }) => {
    if (!t) return {};
    const s = t.snapshot;
    // Public, stable URL: social crawlers must not cache a signed URL
    // which expires after one hour.
    const imageAssetId =
      s.branding.ogAssetId ||
      s.scenes.find((x) => x.id === s.firstSceneId)?.thumbnailAssetId;
    const canonicalOrigin = (
      import.meta.env.VITE_SITE_URL || "https://voee360tour.vercel.app"
    ).replace(/\/$/, "");
    const image = imageAssetId
      ? `${canonicalOrigin}/og/${encodeURIComponent(t.slug)}`
      : null;
    return {
      meta: [
        { title: s.title + " · Tour 360°" },
        {
          name: "description",
          content: s.description || "Explore os ambientes em 360°.",
        },
        { property: "og:title", content: s.title },
        {
          property: "og:description",
          content:
            s.description || "Explore cada ambiente em visão panorâmica.",
        },
        { property: "og:type", content: "website" },
        ...(image
          ? [
              { property: "og:image", content: image },
              { property: "og:image:secure_url", content: image },
              { property: "og:image:alt", content: "Explore " + s.title },
            ]
          : []),
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: PublicTour,
});
function PublicTour() {
  const t = usePublishedTour(Route.useLoaderData());
  return t ? <TourPage tour={t} /> : <TourUnavailable />;
}
