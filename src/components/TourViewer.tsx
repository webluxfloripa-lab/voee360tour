// Adapted from Seven TourViewer: Pannellum scene config, menu, zoom,
// rotation preferences and navigation history, without any client fallback.
import { useEffect, useRef, useState } from "react";
import {
  Pause,
  Play,
  ArrowLeft,
  Home,
  Minus,
  Plus,
  Maximize,
  Menu,
  X,
} from "lucide-react";
import type { Asset, Snapshot } from "../lib/model";
import { signedAssets } from "../lib/api";
import { useDialogFocus } from "../lib/useDialogFocus";
import { loadPannellum } from "../lib/pannellum-loader";
import { tourMotion, TOUR_ROTATION_SPEED } from "../lib/tour-motion";
export default function TourViewer({
  snapshot,
  urls,
  embed = false,
  media,
}: {
  snapshot: Snapshot;
  urls: Record<string, string>;
  embed?: boolean;
  media?: Pick<Asset, "id" | "path">[];
}) {
  const [activeUrls, setActiveUrls] = useState(urls);
  const [renewing, setRenewing] = useState(false);
  const mediaRef = useRef(media);
  mediaRef.current = media;
  const previousSnapshot = useRef<Snapshot | null>(null);
  const lastRenewed = useRef(Date.now());
  const renewal = useRef<Promise<void> | null>(null);
  async function refreshMedia() {
    if (!mediaRef.current?.length) return;
    if (renewal.current) return renewal.current;
    renewal.current = signedAssets(mediaRef.current)
      .then((next) => {
        lastRenewed.current = Date.now();
        setActiveUrls(next);
      })
      .finally(() => { renewal.current = null; });
    return renewal.current;
  }
  useEffect(() => { setActiveUrls(urls); lastRenewed.current = Date.now(); }, [urls]);
  useEffect(() => {
    let alive = true;
    const refreshIfDue = () => {
      if (alive && Date.now() - lastRenewed.current >= 45 * 60 * 1000)
        void refreshMedia().catch(() => { /* Keep usable links; retry on return or button. */ });
    };
    const interval = window.setInterval(refreshIfDue, 60 * 1000);
    document.addEventListener("visibilitychange", refreshIfDue);
    return () => {
      alive = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshIfDue);
    };
  }, []);
  const el = useRef<HTMLDivElement>(null),
    viewer = useRef<any>(null),
    history = useRef<string[]>([]),
    currentRef = useRef(snapshot.firstSceneId),
    backing = useRef(false),
    playingRef = useRef(snapshot.settings.autoRotate);
  const [current, setCurrent] = useState(snapshot.firstSceneId),
    [menu, setMenu] = useState(false),
    [playing, setPlaying] = useState(false),
    [loading, setLoading] = useState(true),
    [failed, setFailed] = useState(false),
    [attempt, setAttempt] = useState(0),
    [query, setQuery] = useState("");
  useDialogFocus(menu, () => setMenu(false));
  useEffect(() => {
    let alive = true;
    let observer: ResizeObserver | undefined;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sameTour = previousSnapshot.current === snapshot;
    if (!sameTour) playingRef.current = snapshot.settings.autoRotate && !preference.matches;
    setPlaying(playingRef.current);
    setLoading(true);
    setFailed(false);
    const firstScene = sameTour && snapshot.scenes.some((s) => s.id === currentRef.current)
      ? currentRef.current : snapshot.firstSceneId;
    if (!sameTour) history.current = [];
    previousSnapshot.current = snapshot;
    currentRef.current = firstScene;
    setCurrent(firstScene);
    function applyPreference() {
      if (preference.matches) {
        playingRef.current = false;
        setPlaying(false);
        viewer.current?.stopAutoRotate();
      }
    }
    preference.addEventListener("change", applyPreference);
    loadPannellum()
      .then((p) => {
        if (!alive || !el.current) return;
        const scenes: Record<string, any> = {};
        for (const s of snapshot.scenes)
          scenes[s.id] = {
            type: "equirectangular",
            panorama: activeUrls[s.panoramaAssetId || ""],
            yaw: s.yaw,
            pitch: s.pitch,
            hfov: s.hfov,
            minHfov: snapshot.settings.minHfov,
            maxHfov: snapshot.settings.maxHfov,
            minPitch: -62,
            maxPitch: 80,
            hotSpots: s.links
              .filter((a) => a.visible)
              .map((a) => ({
                type: "scene",
                sceneId: a.to,
                yaw: a.yaw,
                pitch: a.pitch,
                cssClass: "tour-arrow published-arrow",
                createTooltipFunc: (div: HTMLElement) => {
                  const name =
                    a.label ||
                    snapshot.scenes.find((s) => s.id === a.to)?.name ||
                    "Próximo ambiente";
                  div.title = name;
                  div.setAttribute("aria-label", "Ir para " + name);
                  div.setAttribute("role", "button");
                  div.tabIndex = 0;
                  div.addEventListener("keydown", (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      viewer.current?.loadScene(a.to);
                    }
                  });
                  div.style.setProperty("--arrow-rotation", a.rotation + "deg");
                  div.style.setProperty("--arrow-size", a.size + "px");
                  div.style.setProperty("--arrow-opacity", String(a.opacity));
                  div.style.setProperty(
                    "--arrow-color",
                    a.tone === "foreground" ? "#ffffff" : a.color,
                  );
                  div.classList.toggle("plain", a.style === "plain");
                  div.classList.toggle("chevron", a.icon === "chevron");
                },
              })),
          };
        const v = p.viewer(el.current, {
          default: {
            firstScene,
            sceneFadeDuration: preference.matches ? 0 : 600,
            autoLoad: true,
            showControls: false,
            compass: false,
            ...tourMotion(preference.matches || !playingRef.current),
            mouseZoom: true,
            strings: { loadingLabel: "Carregando…" },
          },
          scenes,
        });
        viewer.current = v;
        v.on("load", () => {
          if (alive) {
            setLoading(false);
            setFailed(false);
            if (!playingRef.current) v.stopAutoRotate();
          }
        });
        v.on("scenechange", (id: string) => {
          if (!alive) return;
          setLoading(true);
          setFailed(false);
          if (!backing.current && currentRef.current)
            history.current.push(currentRef.current);
          backing.current = false;
          currentRef.current = id;
          setCurrent(id);
        });
        v.on("error", () => {
          if (alive) {
            setLoading(false);
            setFailed(true);
          }
        });
        observer = new ResizeObserver(() => v.resize());
        observer.observe(el.current);
      })
      .catch(() => {
        if (alive) {
          setLoading(false);
          setFailed(true);
        }
      });
    return () => {
      alive = false;
      observer?.disconnect();
      preference.removeEventListener("change", applyPreference);
      try {
        viewer.current?.destroy();
      } catch {
        /* already destroyed */
      }
      viewer.current = null;
    };
  }, [snapshot, activeUrls, attempt]);
  const go = (id: string | null) => {
    if (id && id !== current) viewer.current?.loadScene(id);
    setMenu(false);
  };
  const back = () => {
    const previous = history.current.pop();
    if (previous) {
      backing.current = true;
      viewer.current?.loadScene(previous);
    }
  };
  return (
    <section
      className={"public-viewer " + (embed ? "embedded" : "")}
      aria-label="Passeio virtual panorâmico"
      style={{ "--accent": snapshot.branding.accent } as React.CSSProperties}
    >
      <div className="panorama-canvas" ref={el} />
      {loading && !failed && (
        <div className="panorama-loading" role="status">
          <span className="spinner" />
          Carregando ambiente…
        </div>
      )}
      {failed && (
        <div className="panorama-empty" role="alert">
          <h2>Não foi possível abrir o panorama.</h2>
          <button disabled={renewing} onClick={async () => {
            setRenewing(true);
            try {
              await refreshMedia();
              setAttempt((n) => n + 1);
            } catch {
              setFailed(true);
            } finally { setRenewing(false); }
          }}>
            {renewing ? "Carregando…" : "Tentar novamente"}
          </button>
        </div>
      )}
      <div className="viewer-scene">
        <small>VOCÊ ESTÁ EM</small>
        <strong>{snapshot.scenes.find((s) => s.id === current)?.name}</strong>
      </div>
      <button
        className="viewer-menu-button"
        onClick={() => setMenu(true)}
        aria-expanded={menu}
      >
        <Menu size={18} />
        Ambientes
      </button>
      <div className="viewer-controls">
        <button
          aria-label={
            playing
              ? "Pausar movimento automático"
              : "Iniciar movimento automático"
          }
          onClick={() => {
            playingRef.current = !playingRef.current;
            setPlaying(playingRef.current);
            if (playingRef.current)
              viewer.current?.startAutoRotate(
                TOUR_ROTATION_SPEED,
                viewer.current.getPitch(),
              );
            else viewer.current?.stopAutoRotate();
          }}
        >
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button aria-label="Voltar ao ponto anterior" onClick={back}>
          <ArrowLeft size={18} />
        </button>
        <button
          aria-label="Voltar ao início"
          onClick={() => go(snapshot.firstSceneId)}
        >
          <Home size={18} />
        </button>
        <button
          aria-label="Diminuir zoom"
          onClick={() =>
            viewer.current?.setHfov(viewer.current.getHfov() + 10, 350)
          }
        >
          <Minus size={18} />
        </button>
        <button
          aria-label="Aumentar zoom"
          onClick={() =>
            viewer.current?.setHfov(viewer.current.getHfov() - 10, 350)
          }
        >
          <Plus size={18} />
        </button>
        <button
          aria-label="Tela cheia"
          onClick={() => viewer.current?.toggleFullscreen()}
        >
          <Maximize size={18} />
        </button>
      </div>
      {menu && (
        <aside className="viewer-drawer" role="dialog" aria-modal="true" aria-label="Menu de ambientes">
          <div className="section-heading">
            <h2>Explore os ambientes</h2>
            <button
              className="icon-button"
              aria-label="Fechar ambientes"
              onClick={() => setMenu(false)}
            >
              <X />
            </button>
          </div>
          <input
            type="search"
            aria-label="Buscar ambiente"
            placeholder="Buscar ambiente…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="viewer-thumbs">
            {snapshot.scenes
              .filter((s) =>
                (s.name + s.group).toLowerCase().includes(query.toLowerCase()),
              )
              .map((s) => (
                <button
                  key={s.id}
                  onClick={() => go(s.id)}
                  aria-current={s.id === current}
                >
                  <img
                    src={activeUrls[s.thumbnailAssetId || ""]}
                    alt={s.name}
                    loading="lazy"
                  />
                  <small>{s.group}</small>
                  <strong>{s.name}</strong>
                </button>
              ))}
          </div>
        </aside>
      )}
    </section>
  );
}
