// Adapted from the authorized Seven AdminPanorama: load guard, pointer capture,
// live spherical positioning and teardown. Scene data is now project-scoped.
import { useEffect, useRef, useState } from "react";
import type { Arrow, Scene } from "../lib/model";
import { loadPannellum } from "../lib/pannellum-loader";
const clampPitch = (p: number) => Math.max(-62, Math.min(80, p));
const wrapYaw = (y: number) => ((y + 540) % 360) - 180;
export default function AdminPanorama({
  scene,
  scenes,
  image,
  arrows,
  selected,
  mode,
  onSelect,
  onPlace,
  onMove,
  onNavigate,
  onView,
}: {
  scene: Scene;
  scenes: Scene[];
  image: string | undefined;
  arrows: Arrow[];
  selected: string;
  mode: "pan" | "place" | "drag" | "preview";
  onSelect: (id: string) => void;
  onPlace: (pitch: number, yaw: number) => void;
  onMove: (id: string, pitch: number, yaw: number) => boolean | void;
  onNavigate: (id: string) => void;
  onView: (pitch: number, yaw: number, hfov: number) => void;
}) {
  const el = useRef<HTMLDivElement>(null),
    viewer = useRef<any>(null),
    ready = useRef(false);
  const [loading, setLoading] = useState(true),
    [failed, setFailed] = useState(false),
    [attempt, setAttempt] = useState(0);
  const props = useRef({
    arrows,
    selected,
    mode,
    onSelect,
    onPlace,
    onMove,
    onNavigate,
    onView,
    scenes,
  });
  props.current = {
    arrows,
    selected,
    mode,
    onSelect,
    onPlace,
    onMove,
    onNavigate,
    onView,
    scenes,
  };
  const drag = useRef<{
    id: string;
    pitch: number;
    yaw: number;
    x: number;
    y: number;
    moved: boolean;
    armed: boolean;
  } | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function clearHold() {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
  }
  function refresh() {
    const v = viewer.current;
    if (!v || !ready.current) return;
    for (const id of (v.getConfig().hotSpots ?? []).map((h: any) => h.id))
      v.removeHotSpot(id);
    for (const a of props.current.arrows) {
      if (props.current.mode === "preview" && !a.visible) continue;
      v.addHotSpot({
        id: a.id,
        yaw: a.yaw,
        pitch: a.pitch,
        cssClass: "tour-arrow admin-arrow",
        createTooltipFunc: (div: HTMLElement) => decorate(v, div, a),
      });
    }
  }
  function decorate(v: any, div: HTMLElement, a: Arrow) {
    div.dataset.arrowId = a.id;
    div.classList.toggle("selected", props.current.selected === a.id);
    div.classList.toggle("plain", a.style === "plain");
    div.classList.toggle("hidden-arrow", !a.visible);
    div.classList.toggle("chevron", a.icon === "chevron");
    div.setAttribute("role", "button");
    div.tabIndex = 0;
    div.title =
      a.label ||
      props.current.scenes.find((s) => s.id === a.to)?.name ||
      "Seta";
    div.setAttribute("aria-label", div.title);
    div.style.setProperty("--arrow-rotation", a.rotation + "deg");
    div.style.setProperty("--arrow-size", a.size + "px");
    div.style.setProperty("--arrow-opacity", String(a.opacity));
    div.style.setProperty(
      "--arrow-color",
      a.tone === "foreground" ? "#ffffff" : a.color,
    );
    const activate = () => {
      if (props.current.mode === "preview") props.current.onNavigate(a.to);
      else props.current.onSelect(a.id);
    };
    div.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        activate();
      }
    });
    let suppressClick = false;
    // Keep Pannellum's mouse/touch handlers from rotating behind an arrow.
    for (const event of ["mousedown", "touchstart"] as const)
      div.addEventListener(
        event,
        (e) => {
          if (props.current.mode !== "preview") {
            e.preventDefault();
            e.stopPropagation();
          }
        },
        { passive: false },
      );
    div.addEventListener("contextmenu", (e) => e.preventDefault());
    div.addEventListener("pointerdown", (e) => {
      if (props.current.mode === "preview" || !e.isPrimary || e.button !== 0)
        return;
      e.preventDefault();
      e.stopPropagation();
      clearHold();
      suppressClick = false;
      div.setPointerCapture(e.pointerId);
      const d = {
        id: a.id,
        pitch: a.pitch,
        yaw: a.yaw,
        x: e.clientX,
        y: e.clientY,
        moved: false,
        armed: props.current.mode === "drag",
      };
      drag.current = d;
      if (d.armed) div.classList.add("is-dragging");
      else
        holdTimer.current = setTimeout(() => {
          if (drag.current !== d) return;
          d.armed = true;
          div.classList.add("is-dragging");
        }, 350);
    });
    div.addEventListener("pointermove", (e) => {
      const d = drag.current;
      if (!d || d.id !== a.id) return;
      e.preventDefault();
      e.stopPropagation();
      if (!d.armed) {
        if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 7) {
          clearHold();
          suppressClick = true;
        }
        return;
      }
      const [p, y] = v.mouseEventToCoords(e);
      d.pitch = clampPitch(p);
      d.yaw = wrapYaw(y);
      d.moved ||= Math.hypot(e.clientX - d.x, e.clientY - d.y) > 3;
      const hot = (v.getConfig().hotSpots ?? []).find(
        (h: any) => h.id === d.id,
      );
      if (hot) {
        hot.pitch = d.pitch;
        hot.yaw = d.yaw;
        v.setYaw(v.getYaw());
      }
    });
    const finish = (e: PointerEvent) => {
      const d = drag.current;
      if (!d || d.id !== a.id) return;
      e.stopPropagation();
      clearHold();
      drag.current = null;
      div.classList.remove("is-dragging");
      if (div.hasPointerCapture(e.pointerId))
        div.releasePointerCapture(e.pointerId);
      suppressClick ||= d.moved || e.type !== "pointerup";
      if (d.armed && d.moved && e.type === "pointerup") {
        if (props.current.onMove(d.id, d.pitch, d.yaw) === false) refresh();
      } else if (e.type === "pointerup" && !suppressClick) {
        suppressClick = true;
        activate();
      } else if (e.type !== "pointerup") refresh();
    };
    div.addEventListener("pointerup", finish);
    div.addEventListener("pointercancel", finish);
    div.addEventListener("lostpointercapture", finish);
    div.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!suppressClick) activate();
      suppressClick = false;
    });
  }
  useEffect(() => {
    let alive = true;
    let observer: ResizeObserver | undefined;
    const container = el.current;
    ready.current = false;
    clearHold();
    drag.current = null;
    setLoading(true);
    setFailed(false);
    if (!image) {
      setLoading(false);
      return;
    }
    // Pannellum can emit a click after dragging on both mouse and touch.
    // A placement must be a short tap, never the end of a camera gesture.
    let gesture: { x: number; y: number; moved: boolean } | null = null;
    function startGesture(e: PointerEvent) {
      gesture = {
        x: e.clientX,
        y: e.clientY,
        moved: !!(e.target as HTMLElement).closest(
          ".admin-arrow,.pnlm-controls",
        ),
      };
    }
    function moveGesture(e: PointerEvent) {
      if (
        gesture &&
        Math.hypot(e.clientX - gesture.x, e.clientY - gesture.y) > 7
      )
        gesture.moved = true;
    }
    function cancelGesture() {
      if (gesture) gesture.moved = true;
    }
    container?.addEventListener("pointerdown", startGesture, true);
    container?.addEventListener("pointermove", moveGesture, true);
    container?.addEventListener("pointercancel", cancelGesture, true);
    function place(e: MouseEvent) {
      const v = viewer.current;
      if (
        props.current.mode !== "place" ||
        !v ||
        !ready.current ||
        gesture?.moved ||
        (e.target as HTMLElement).closest(".admin-arrow,.pnlm-controls")
      )
        return;
      const [p, y] = v.mouseEventToCoords(e);
      props.current.onPlace(clampPitch(p), wrapYaw(y));
    }
    loadPannellum()
      .then((p) => {
        if (!alive || !container) return;
        const v = p.viewer(container, {
          type: "equirectangular",
          panorama: image,
          yaw: scene.yaw,
          pitch: scene.pitch,
          hfov: scene.hfov,
          minHfov: 50,
          maxHfov: 120,
          minPitch: -62,
          maxPitch: 80,
          autoLoad: true,
          showControls: true,
          autoRotate: 0,
          mouseZoom: true,
          hotSpots: [],
          strings: {
            loadingLabel: "Carregando…",
            loadButtonLabel: "Abrir ambiente",
            genericWebGLError:
              "Não foi possível iniciar o panorama neste dispositivo.",
          },
        });
        viewer.current = v;
        v.on("load", () => {
          if (!alive) return;
          ready.current = true;
          setLoading(false);
          props.current.onView(v.getPitch(), v.getYaw(), v.getHfov());
          refresh();
        });
        v.on("error", () => {
          if (alive) {
            setLoading(false);
            setFailed(true);
          }
        });
        v.on("mouseup", () =>
          props.current.onView(v.getPitch(), v.getYaw(), v.getHfov()),
        );
        v.on("touchend", () =>
          props.current.onView(v.getPitch(), v.getYaw(), v.getHfov()),
        );
        observer = new ResizeObserver(() => {
          if (ready.current) v.resize();
        });
        observer.observe(container);
        container.addEventListener("click", place);
      })
      .catch(() => {
        if (alive) {
          setLoading(false);
          setFailed(true);
        }
      });
    return () => {
      alive = false;
      ready.current = false;
      clearHold();
      drag.current = null;
      observer?.disconnect();
      container?.removeEventListener("click", place);
      container?.removeEventListener("pointerdown", startGesture, true);
      container?.removeEventListener("pointermove", moveGesture, true);
      container?.removeEventListener("pointercancel", cancelGesture, true);
      try {
        viewer.current?.destroy();
      } catch {
        /* already destroyed */
      }
      viewer.current = null;
    };
  }, [scene.id, image, attempt]);
  useEffect(() => {
    if (!drag.current) refresh();
  }, [arrows, selected, mode]);
  return (
    <div className={"panorama-stage mode-" + mode}>
      <div
        ref={el}
        className="panorama-canvas"
        aria-label="Editor panorâmico"
      />
      {!image ? (
        <div className="panorama-empty">
          <span>360°</span>
          <h3>Este ambiente aguarda uma fotografia.</h3>
          <p>Envie um panorama real para visualizar e posicionar as setas.</p>
        </div>
      ) : loading && !failed ? (
        <div className="panorama-loading" role="status">
          <span className="spinner" />
          Carregando ambiente…
        </div>
      ) : null}
      {failed && (
        <div className="panorama-empty" role="alert">
          <h3>Não foi possível exibir este ambiente.</h3>
          <button onClick={() => setAttempt((n) => n + 1)}>
            Tentar novamente
          </button>
        </div>
      )}
    </div>
  );
}
