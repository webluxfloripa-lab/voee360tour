import { fileURLToPath } from "node:url";
import { test, expect, type Page } from "@playwright/test";
import { mockPlatform } from "./mock-platform";

async function tapPanorama(page: Page, x = 0.62, y = 0.55) {
  await expect(page.locator(".panorama-loading")).toHaveCount(0, {
    timeout: 30000,
  });
  const canvas = page.locator(".panorama-canvas");
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  if (test.info().project.name === "mobile")
    await canvas.tap({ position: { x: box!.width * x, y: box!.height * y } });
  else
    await canvas.click({ position: { x: box!.width * x, y: box!.height * y } });
}
async function setup(page: Page) {
  const state = await mockPlatform(page);
  await page.goto(`/admin/projetos/${state.projectId}/editor`);
  await page
    .locator("input[type=file][multiple]")
    .setInputFiles([
      fileURLToPath(new URL("../assets/seven-1-image.jpg", import.meta.url)),
      fileURLToPath(new URL("../assets/seven-2-image.jpg", import.meta.url)),
    ]);
  await expect(page.locator(".editor-status")).toContainText(
    "Fotografias enviadas",
    { timeout: 30000 },
  );
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.locator(".editor-status")).toContainText(
    "Rascunho salvo no servidor",
  );
  return state;
}
test("guided connection: cancellation, physical return, persistence, independent edit, undo redo and real navigation", async ({
  page,
}) => {
  const state = await setup(page);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page
    .getByRole("button", { name: "Adicionar seta", exact: true })
    .click();
  await tapPanorama(page);
  const panel = page.locator(".connection-panel");
  await expect(
    panel.getByRole("heading", { name: "Conectar ambiente", exact: true }),
  ).toBeVisible();
  await panel.getByRole("button", { name: "Cancelar", exact: true }).click();
  expect(state.readSnapshot().scenes.flatMap((s) => s.links)).toHaveLength(0);
  await expect(page.getByText("Rascunho salvo", { exact: true })).toBeVisible();

  await page
    .getByRole("button", { name: "Adicionar seta", exact: true })
    .click();
  await tapPanorama(page);
  const [a, b] = state.readSnapshot().scenes;
  await expect(
    panel.getByLabel("Próximo ambiente").locator(`option[value="${a!.id}"]`),
  ).toHaveCount(0);
  await panel.getByLabel("Próximo ambiente").selectOption(b!.id);
  const sheetBox = await panel.boundingBox();
  expect(sheetBox!.x).toBeGreaterThanOrEqual(0);
  expect(sheetBox!.x + sheetBox!.width).toBeLessThanOrEqual(
    page.viewportSize()!.width + 1,
  );
  if (test.info().project.name === "mobile")
    expect(sheetBox!.height).toBeLessThanOrEqual(
      page.viewportSize()!.height * 0.46 + 1,
    );
  await page.screenshot({
    path: `test-results/connection-panel-${test.info().project.name}.png`,
  });
  await expect(
    panel.getByRole("img", { name: "Prévia de seven-2-image" }),
  ).toBeVisible();
  await panel
    .getByRole("button", { name: "Continuar e posicionar volta", exact: true })
    .click();
  await expect(panel).toContainText("Agora posicione a seta que retorna para");
  await expect(page.locator(".scene-caption > span")).toHaveText(
    "seven-2-image",
  );
  await expect(page.locator(".panorama-loading")).toHaveCount(0, {
    timeout: 30000,
  });
  // Rotate through pointer movements: the gesture must not place a return.
  const canvas = page.locator(".panorama-canvas"),
    box = await canvas.boundingBox();
  await page.mouse.move(
    box!.x + box!.width * 0.55,
    box!.y + box!.height * 0.35,
  );
  await page.mouse.down();
  await page.mouse.move(
    box!.x + box!.width * 0.45,
    box!.y + box!.height * 0.35,
    { steps: 8 },
  );
  await page.mouse.up();
  await expect(
    panel.getByRole("button", { name: "Concluir conexão", exact: true }),
  ).toHaveCount(0);
  await tapPanorama(page, 0.35, 0.4);
  await expect(
    panel.getByRole("heading", { name: "Confira a ida e a volta" }),
  ).toBeVisible();
  await panel
    .getByRole("button", { name: "Corrigir posição da volta", exact: true })
    .click();
  await tapPanorama(page, 0.4, 0.4);
  await panel
    .getByRole("button", { name: "Concluir conexão", exact: true })
    .click();
  await expect(
    panel.getByRole("heading", { name: "Conexão concluída!" }),
  ).toBeVisible();
  await expect(
    page.getByText("Alterações pendentes", { exact: true }),
  ).toBeVisible();
  await panel
    .getByRole("button", { name: "Salvar rascunho", exact: true })
    .click();
  await expect(panel).toHaveCount(0);
  const pair = structuredClone(state.readSnapshot());
  const out = pair.scenes[0]!.links[0]!,
    back = pair.scenes[1]!.links[0]!;
  expect(out.pairId).toBe(back.pairId);
  expect(out.id).not.toBe(back.id);
  expect(out.yaw).not.toBe(back.yaw);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Tour QA", exact: true }),
  ).toBeVisible();
  await page.locator(".connections-section summary").click();
  const list = page.locator(".connections-list");
  await expect(list.locator("article")).toHaveCount(1);
  await expect(list).toContainText("Ida e volta concluídas");
  await list.getByRole("button", { name: "Editar ida", exact: true }).click();
  const yaw = page.getByLabel("Posição horizontal valor", { exact: true });
  await yaw.fill("30");
  await page.getByRole("button", { name: "Desfazer", exact: true }).click();
  await expect(yaw).toHaveValue(String(out.yaw));
  await page.getByRole("button", { name: "Refazer", exact: true }).click();
  await expect(yaw).toHaveValue("30");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.locator(".editor-status")).toContainText("Rascunho salvo");
  expect(state.readSnapshot().scenes[1]!.links[0]).toEqual(back);
  await list
    .getByRole("button", { name: "Testar navegação", exact: true })
    .click();
  await expect(page.locator(".preview-modal .panorama-loading")).toHaveCount(
    0,
    { timeout: 30000 },
  );
  await expect(page.locator(".viewer-scene")).toContainText("seven-1-image");
  await page.locator(".published-arrow").click();
  await expect(page.locator(".viewer-scene")).toContainText("seven-2-image");
  await expect(page.locator(".preview-modal .panorama-loading")).toHaveCount(
    0,
    { timeout: 30000 },
  );
  await page.locator(".published-arrow").click();
  await expect(page.locator(".viewer-scene")).toContainText("seven-1-image");
  await page
    .getByRole("button", { name: "Fechar prévia", exact: true })
    .click();
  const width = await page.evaluate(() => [
    document.documentElement.clientWidth,
    document.documentElement.scrollWidth,
  ]);
  expect(width[0]).toBe(width[1]);
  expect(errors).toEqual([]);
  expect(state.versions).toHaveLength(0); // Guided editing never publishes.
  await page.screenshot({
    path: `test-results/guided-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test("one-way pending survives refresh and completing or reopening it never duplicates arrows", async ({
  page,
}) => {
  const state = await setup(page);
  const [a, b] = state.readSnapshot().scenes;
  await page
    .getByRole("button", { name: "Adicionar seta", exact: true })
    .click();
  await tapPanorama(page);
  const panel = page.locator(".connection-panel");
  await panel.getByLabel("Próximo ambiente").selectOption(b!.id);
  await panel
    .getByRole("button", { name: "Confirmar destino", exact: true })
    .click();
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.locator(".editor-status")).toContainText("Rascunho salvo");
  const outgoing = structuredClone(state.readSnapshot().scenes[0]!.links[0]!);
  await page.reload();
  await page.locator(".connections-section summary").click();
  await expect(page.locator(".connections-list")).toContainText(
    "Retorno pendente",
  );
  await page
    .locator(".connections-list")
    .getByRole("button", { name: "Posicionar retorno", exact: true })
    .click();
  await panel
    .getByRole("button", { name: "Deixar retorno para depois", exact: true })
    .click();
  await expect(page.locator(".editor-modebar button.active")).toHaveText(
    "Explorar",
  );
  await page
    .locator(".connections-list")
    .getByRole("button", { name: "Posicionar retorno", exact: true })
    .click();
  await tapPanorama(page, 0.38, 0.4);
  await panel
    .getByRole("button", { name: "Concluir conexão", exact: true })
    .click();
  await panel
    .getByRole("button", { name: "Voltar ao ambiente anterior", exact: true })
    .click();
  await expect(page.locator(".scene-caption > span")).toHaveText(a!.name);
  await page
    .getByRole("button", { name: "Adicionar seta", exact: true })
    .click();
  await tapPanorama(page, 0.7, 0.4);
  await panel.getByLabel("Próximo ambiente").selectOption(b!.id);
  await expect(panel).toContainText("Esta ida já existe");
  await panel
    .getByRole("button", { name: "Confirmar destino", exact: true })
    .click();
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.locator(".editor-status")).toContainText("Rascunho salvo");
  const arrows = state.readSnapshot().scenes.flatMap((s) => s.links);
  expect(arrows).toHaveLength(2);
  expect(arrows[0]).toEqual(outgoing);
  expect(arrows[0]!.pairId).toBe(arrows[1]!.pairId);
});
