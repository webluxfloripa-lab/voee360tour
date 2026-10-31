import { createFileRoute, ClientOnly, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { lazy, Suspense } from "react";
import { getPublicTour } from "../lib/api";
import { usePublishedTour } from "../lib/usePublishedTour";
import { TourUnavailable } from "../components/TourUnavailable";
const load = createServerFn({ method: "GET" })
  .validator(
    z.object({
      slug: z
        .string()
        .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
        .max(100),
    }),
  )
  .handler(async ({ data }) => getPublicTour(data.slug));
const Viewer = lazy(() => import("../components/TourViewer"));
export const Route = createFileRoute("/embed/$slug")({
  staleTime: 0,
  gcTime: 0,
  loader: async ({ params }) => {
    if (
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(params.slug) ||
      params.slug.length > 100
    )
      throw notFound();
    const t = await load({ data: { slug: params.slug } });
    if (!t) throw notFound();
    return t;
  },
  head: () => ({ meta: [{ name: "robots", content: "noindex,nofollow" }] }),
  component: EmbedRoute,
});

function EmbedRoute() {
  const t = usePublishedTour(Route.useLoaderData());
  if (!t) return <TourUnavailable />;
  return (
    <main>
      <ClientOnly>
        <Suspense fallback={<div className="viewer-placeholder" />}>
          <Viewer snapshot={t.snapshot} urls={t.urls} media={t.media} embed />
        </Suspense>
      </ClientOnly>
    </main>
  );
}
