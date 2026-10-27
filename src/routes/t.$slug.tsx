import { createFileRoute, ClientOnly, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { lazy, Suspense } from "react";
import { getPublicTour } from "../lib/api";
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
const Viewer = lazy(() => import("../components/TourViewer"));
export const Route = createFileRoute("/t/$slug")({
  loader: async ({ params }) => {
    const tour = await loadTour({ data: { slug: params.slug } });
    if (!tour) throw notFound();
    return tour;
  },
  head: ({ loaderData: t }) => {
    if (!t) return {};
    const s = t.snapshot;
    const image =
      t.urls[
        s.branding.ogAssetId ||
          s.scenes.find((x) => x.id === s.firstSceneId)?.thumbnailAssetId ||
          ""
      ];
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
  const t = Route.useLoaderData();
  return (
    <main
      className="public-page"
      style={{ "--accent": t.snapshot.branding.accent } as React.CSSProperties}
    >
      <header className="public-header">
        {t.snapshot.branding.logoAssetId && (
          <img
            src={t.urls[t.snapshot.branding.logoAssetId]}
            alt={"Logo " + t.snapshot.title}
          />
        )}
        <div>
          <h1>{t.snapshot.title}</h1>
          <span>UMA EXPERIÊNCIA EM 360°</span>
        </div>
        <span className="public-powered">voee360tour</span>
      </header>
      <ClientOnly fallback={<div className="viewer-placeholder" />}>
        <Suspense fallback={<div className="viewer-placeholder" />}>
          <Viewer snapshot={t.snapshot} urls={t.urls} />
        </Suspense>
      </ClientOnly>
      <section className="public-description">
        <span>ENTRE. EXPLORE. DESCUBRA.</span>
        <h2>Uma nova perspectiva de {t.snapshot.title}.</h2>
        <p>
          {t.snapshot.description ||
            "Arraste para olhar ao redor. Toque nas setas para descobrir cada ambiente."}
        </p>
      </section>
      <footer className="public-footer">
        Experiência criada com <strong>voee360tour</strong>
      </footer>
    </main>
  );
}
