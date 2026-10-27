declare global {
  interface Window {
    pannellum?: any;
  }
}

let pending: Promise<any> | null = null;

/** Loads the vendored Pannellum script once, in the browser only. */
export function loadPannellum(): Promise<any> {
  if (window.pannellum) return Promise.resolve(window.pannellum);
  if (pending) return pending;
  pending = new Promise((resolve, reject) => {
    if (!document.querySelector("link[data-pnlm]")) {
      const l = document.createElement("link");
      l.rel = "stylesheet";
      l.href = "/vendor/pannellum.css";
      l.setAttribute("data-pnlm", "1");
      document.head.appendChild(l);
    }
    const s = document.createElement("script");
    s.src = "/vendor/pannellum.js";
    s.onload = () =>
      window.pannellum
        ? resolve(window.pannellum)
        : reject(new Error("Visualizador indisponível."));
    s.onerror = () => {
      pending = null;
      s.remove();
      reject(new Error("Não foi possível carregar o visualizador."));
    };
    document.body.appendChild(s);
  });
  return pending;
}
