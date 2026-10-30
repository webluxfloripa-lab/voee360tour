import { lazy, Suspense, type CSSProperties } from "react";
import { ClientOnly } from "@tanstack/react-router";
import type { Asset, Snapshot } from "../lib/model";
import { getPresentation } from "../lib/presentation";
const Viewer = lazy(() => import("./TourViewer"));
export type TourPageData = {
  snapshot: Snapshot;
  urls: Record<string, string>;
  media?: Pick<Asset, "id" | "path">[];
};
export function TourPage({
  tour,
  onSelect,
  selected,
}: {
  tour: TourPageData;
  onSelect?: (path: string) => void;
  selected?: string;
}) {
  const { snapshot: s, urls } = tour;
  const p = getPresentation(s),
    l = p.layout,
    c = p.copy;
  const text = (path: string, value: string) =>
    onSelect ? (
      <button
        type="button"
        className={"editable-copy " + (selected === path ? "selected" : "")}
        onClick={() => onSelect(path)}
        title="Clique para editar"
      >
        {value || "Texto vazio — clique para editar"}
      </button>
    ) : (
      value
    );
  const style = {
    "--accent": s.branding.accent,
    "--site-bg": l.background,
    "--site-text": l.text,
    "--site-heading": l.heading,
    "--site-muted": l.muted,
    "--subtitle-size": `${l.subtitleSize}px`,
    "--eyebrow-size": `${l.eyebrowSize}px`,
    "--footer-size": `${l.footerSize}px`,
    "--viewer-text-size": `${l.viewerTextSize}px`,
    "--viewer-button-size": `${l.buttonSize}px`,
    "--title-size": `${l.titleSize}px`,
    "--heading-size": `${l.headingSize}px`,
    "--body-size": `${l.bodySize}px`,
    "--logo-width": `${l.logoWidth}px`,
    "--viewer-height": `${l.viewerHeight}dvh`,
    "--content-width": `${l.contentWidth}px`,
    "--section-spacing": `${l.spacing}px`,
    textAlign: l.align,
  } as CSSProperties;
  const sections = {
    tour: (
      <section key="tour" className="site-panorama-section">
        {onSelect ? (
          <div
            className="layout-panorama-preview"
            style={{
              backgroundImage: `linear-gradient(#10191b66,#10191bbb), url("${urls[s.scenes.find((x) => x.id === s.firstSceneId)?.thumbnailAssetId || ""] || ""}")`,
            }}
          >
            <span>PRÉVIA DO LAYOUT · PANORAMA 360°</span>
            <strong>
              {s.scenes.find((x) => x.id === s.firstSceneId)?.name ||
                "Seu ambiente inicial"}
            </strong>
            <button type="button" onClick={() => onSelect("copy.menu")}>
              {c.menu}
            </button>
            <small>
              A navegação e as setas são editadas no editor de ambientes.
            </small>
          </div>
        ) : (
          <ClientOnly fallback={<div className="viewer-placeholder" />}>
            <Suspense fallback={<div className="viewer-placeholder" />}>
              <Viewer snapshot={s} urls={urls} media={tour.media} />
            </Suspense>
          </ClientOnly>
        )}
      </section>
    ),
    description: l.description ? (
      <section className="public-description" key="description">
        <span>{text("copy.eyebrow", c.eyebrow)}</span>
        <h2>
          {text("copy.introTitle", c.introTitle.replaceAll("{tour}", s.title))}
        </h2>
        <p>{text("description", s.description || c.descriptionFallback)}</p>
      </section>
    ) : null,
    blocks: (
      <div key="blocks" className="site-extra-sections">
        {p.blocks
          .filter((b) => b.visible)
          .map((b) => (
            <section
              className="public-description custom-content-block"
              key={b.id}
              style={{ textAlign: b.align }}
            >
              <h2 style={{ fontSize: b.titleSize }}>
                {text(`block.${b.id}.title`, b.title)}
              </h2>
              <p style={{ fontSize: b.bodySize, whiteSpace: "pre-wrap" }}>
                {text(`block.${b.id}.body`, b.body)}
              </p>
              {b.cta &&
                (onSelect ? (
                  <button
                    className="site-cta"
                    type="button"
                    onClick={() => onSelect(`block.${b.id}.cta`)}
                  >
                    {b.cta}
                  </button>
                ) : b.url ? (
                  <a
                    className="site-cta"
                    href={b.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {b.cta}
                  </a>
                ) : null)}
            </section>
          ))}
      </div>
    ),
  };
  return (
    <main className="public-page customized-tour" style={style}>
      {l.header && (
        <header className="public-header">
          {l.showLogo && s.branding.logoAssetId && (
            <img src={urls[s.branding.logoAssetId]} alt={"Logo " + s.title} />
          )}
          <div>
            <h1>{text("title", s.title)}</h1>
            <span>{text("copy.subtitle", c.subtitle)}</span>
          </div>
          {l.showCredit && (
            <span className="public-powered">
              {text("copy.credit", c.credit)}
            </span>
          )}
        </header>
      )}
      {l.order.map((key) => sections[key])}
      {l.footer && (
        <footer className="public-footer">
          {text("copy.footer", c.footer)}{" "}
          <strong>{text("copy.footerBrand", c.footerBrand)}</strong>
        </footer>
      )}
    </main>
  );
}
