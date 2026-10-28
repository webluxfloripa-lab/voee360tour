import { test, expect, type Page, type Locator } from "@playwright/test";
import { mockPlatform } from "./mock-platform";

async function openEditor(page: Page) {
  const state = await mockPlatform(page);
  await page.goto(`/admin/projetos/${state.projectId}/editor`);
  await page
    .locator("input[type=file][multiple]")
    .setInputFiles([
      new URL("../assets/seven-1-image.jpg", import.meta.url).pathname,
      new URL("../assets/seven-2-image.jpg", import.meta.url).pathname,
    ]);
  await expect(page.locator(".editor-status")).toContainText(
    "Fotografias enviadas",
  );
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.locator(".editor-status")).toContainText("Rascunho salvo");
  return state;
}
async function place(page: Page) {
  await expect(page.locator(".panorama-loading")).toHaveCount(0);
  const canvas = page.locator(".panorama-canvas");
  const box = await canvas.boundingBox();
  // Keep the point above the sheet on a short mobile screen.
  const position = { x: box!.width * 0.55, y: box!.height * 0.25 };
  if (test.info().project.name === "mobile") await canvas.tap({ position });
  else await canvas.click({ position });
}
async function holdDrag(page: Page, arrow: Locator, cancel = false) {
  const box = await arrow.boundingBox();
  const start = { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
  const end = { x: start.x - 44, y: start.y + 30 };
  if (test.info().project.name === "mobile") {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [start],
    });
    await expect(arrow).toHaveClass(/is-dragging/);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [end],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: cancel ? "touchCancel" : "touchEnd",
      touchPoints: [],
    });
    await cdp.detach();
  } else {
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await expect(arrow).toHaveClass(/is-dragging/);
    await page.mouse.move(end.x, end.y, { steps: 6 });
    if (cancel) await arrow.dispatchEvent("pointercancel", { pointerId: 1 });
    await page.mouse.up();
  }
}

test("visual destinations and hold-drag preserve independent return, undo, cancellation and persistence", async ({
  page,
}) => {
  const state = await openEditor(page);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const panel = page.locator(".connection-panel");
  await page
    .getByRole("button", { name: "Adicionar seta", exact: true })
    .click();
  await place(page);
  // The proposed arrow can be moved before any destination is committed.
  await holdDrag(page, page.locator(".admin-arrow.selected"));
  await panel.getByRole("button", { name: "Cancelar", exact: true }).click();
  expect(state.readSnapshot().scenes.flatMap((s) => s.links)).toHaveLength(0);
  await page
    .getByRole("button", { name: "Adicionar seta", exact: true })
    .click();
  await place(page);
  await expect(
    panel.getByRole("button", { name: "Conectar com seven-1-image" }),
  ).toHaveCount(0);
  await panel
    .getByRole("button", { name: "Buscar ambiente", exact: true })
    .click();
  await panel.getByRole("searchbox").fill("ausente");
  await expect(panel).toContainText("Nenhum ambiente encontrado");
  await panel.getByRole("searchbox").fill("seven-2");
  await panel
    .getByRole("button", { name: "Conectar com seven-2-image", exact: true })
    .click();
  await expect(
    panel.getByRole("button", {
      name: "Conectar com seven-2-image",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await panel
    .getByRole("button", { name: "Buscar ambiente", exact: true })
    .click();
  await page.screenshot({
    path: `test-results/mobile-${test.info().project.name}-02-destino.png`,
  });
  await panel
    .getByRole("button", { name: "Continuar e posicionar volta", exact: true })
    .click();
  await expect(page.locator(".panorama-loading")).toHaveCount(0);
  await page.screenshot({
    path: `test-results/mobile-${test.info().project.name}-03-volta.png`,
  });
  await place(page);
  await expect(panel).toContainText("Confira a ida e a volta");
  await holdDrag(page, page.locator(".admin-arrow.selected"));
  await panel
    .getByRole("button", { name: "Concluir conexão", exact: true })
    .click();
  await page.screenshot({
    path: `test-results/mobile-${test.info().project.name}-04-concluido.png`,
  });
  await panel
    .getByRole("button", { name: "Salvar rascunho", exact: true })
    .click();
  await expect(page.locator(".editor-status")).toContainText("Rascunho salvo");
  const before = structuredClone(state.readSnapshot());
  const original = before.scenes[1]!.links[0]!;
  // Simple tap still selects; long press in Explore moves without mode switching.
  const back = page.locator(`[data-arrow-id="${original.id}"]`);
  await holdDrag(page, back, true);
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.locator(".editor-status")).toContainText("Rascunho salvo");
  expect(state.readSnapshot()).toEqual(before);
  await holdDrag(page, back);
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.locator(".editor-status")).toContainText("Rascunho salvo");
  const moved = structuredClone(state.readSnapshot());
  expect(moved.scenes[0]!.links).toEqual(before.scenes[0]!.links);
  expect(moved.scenes[1]!.links[0]!.yaw).not.toBe(original.yaw);
  expect(moved.scenes[1]!.links[0]!.pairId).toBe(original.pairId);
  await page.getByRole("button", { name: "Desfazer", exact: true }).click();
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.locator(".editor-status")).toContainText("Rascunho salvo");
  expect(state.readSnapshot()).toEqual(before);
  await page.getByRole("button", { name: "Refazer", exact: true }).click();
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.locator(".editor-status")).toContainText("Rascunho salvo");
  expect(state.readSnapshot()).toEqual(moved);
  await page.reload();
  await expect(page.locator(".panorama-loading")).toHaveCount(0);
  const outgoing = page.locator(
    `[data-arrow-id="${moved.scenes[0]!.links[0]!.id}"]`,
  );
  await expect(outgoing).not.toHaveClass(/selected/);
  if (test.info().project.name === "mobile") await outgoing.tap();
  else await outgoing.click();
  await expect(outgoing).toHaveClass(/selected/);
  await page.locator(".connections-section summary").click();
  await expect(page.locator(".connections-list article")).toHaveCount(1);
  await expect(page.locator(".connections-list")).toContainText(
    "Ida e volta concluídas",
  );
  expect(state.readSnapshot().scenes.flatMap((s) => s.links)).toHaveLength(2);
  expect(state.versions).toHaveLength(0);
  expect(errors).toEqual([]);
});

test("compact connection actions remain reachable on small portrait and landscape screens", async ({
  page,
}) => {
  await openEditor(page);
  await page
    .getByRole("button", { name: "Adicionar seta", exact: true })
    .click();
  await place(page);
  const panel = page.locator(".connection-panel");
  await panel
    .getByRole("button", { name: "Conectar com seven-2-image", exact: true })
    .click();
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 640, height: 360 },
    { width: 800, height: 360 },
  ]) {
    await page.setViewportSize(viewport);
    const action = panel.getByRole("button", {
      name: "Continuar e posicionar volta",
      exact: true,
    });
    await expect(action).toBeVisible();
    const box = await action.boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    const widths = await page.evaluate(() => [
      document.documentElement.clientWidth,
      document.documentElement.scrollWidth,
    ]);
    expect(widths[0]).toBe(widths[1]);
    const top = await page.locator(".editor-panorama-wrap").boundingBox();
    const sheet = await panel.boundingBox();
    if (viewport.width > viewport.height) {
      expect(sheet!.x - Math.max(top!.x, 0)).toBeGreaterThan(280);
      expect(
        Math.min(top!.y + top!.height, viewport.height) - Math.max(top!.y, 0),
      ).toBeGreaterThan(180);
    } else {
      await expect
        .poll(async () => {
          const photo = await page
            .locator(".editor-panorama-wrap")
            .boundingBox();
          const currentSheet = await panel.boundingBox();
          return (
            Math.min(currentSheet!.y, viewport.height) - Math.max(photo!.y, 0)
          );
        })
        .toBeGreaterThan(140);
    }
    await page.screenshot({
      path: `test-results/mobile-${viewport.width}x${viewport.height}.png`,
    });
  }
  await panel
    .getByRole("button", { name: "Continuar e posicionar volta", exact: true })
    .click();
  await expect(panel).toContainText("Agora posicione a seta que retorna para");
});
