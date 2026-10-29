import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  document.querySelectorAll('script[src="/vendor/pannellum.js"],link[data-pnlm]').forEach((el) => el.remove());
  delete window.pannellum;
});

it("retries when a downloaded script fails to initialize the viewer", async () => {
  vi.resetModules();
  const { loadPannellum } = await import("../src/lib/pannellum-loader");
  const first = loadPannellum();
  const rejection = expect(first).rejects.toThrow("Visualizador indisponível");
  document.querySelector('script[src="/vendor/pannellum.js"]')!.dispatchEvent(new Event("load"));
  await rejection;
  const second = loadPannellum();
  expect(second).not.toBe(first);
  window.pannellum = { viewer: vi.fn() };
  document.querySelector('script[src="/vendor/pannellum.js"]')!.dispatchEvent(new Event("load"));
  await expect(second).resolves.toBe(window.pannellum);
});
