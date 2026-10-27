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
import type { Snapshot } from "../lib/model";
import { loadPannellum } from "../lib/pannellum-loader";
import { tourMotion, TOUR_ROTATION_SPEED } from "../lib/tour-motion";
export default function TourViewer({
  snapshot,
  urls,
  embed = false,
}: {
  snapshot: Snapshot;
  urls: Record<string, string>;
  embed?: boolean;
}) {
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
  useEffect(() => {
    let alive = true;
    let observer: ResizeObserver | undefined;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    playingRef.current = snapshot.settings.autoRotate && !preference.matches;
    setPlaying(playingRef.current);
    setLoading(true);
    setFailed(false);
    history.current = [];
    currentRef.current = snapshot.firstSceneId;
    setCurrent(snapshot.firstSceneId);
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
            panorama: urls[s.panoramaAssetId || ""],
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
            firstScene: snapshot.firstSceneId,
            sceneFadeDuration: preference.matches ? 0 : 600,
            autoLoad: true,
            showControls: false,
            compass: false,
            ...tourMotion(preference.matches || !snapshot.settings.autoRotate),
            mouseZoom: true,
            strings: { loadingLabel: "Carregando…" },
          },
          scenes,
        });
        viewer.current = v;
        v.on("load", () => {
          if (alive) {
            setLoading(false);
            if (!playingRef.current) v.stopAutoRotate();
          }
        });
        v.on("scenechange", (id: string) => {
          if (!alive) return;
          setLoading(true);
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
  }, [snapshot, urls, attempt]);
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
          <button onClick={() => setAttempt((n) => n + 1)}>
            Tentar novamente
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
        <aside className="viewer-drawer" aria-label="Menu de ambientes">
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
                    src={urls[s.thumbnailAssetId || ""]}
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
