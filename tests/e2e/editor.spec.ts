import { test, expect } from "@playwright/test";
import { mockPlatform } from "./mock-platform";
test("admin UI: upload real panoramas, independent return, save publish restore refresh", async ({
  page,
}) => {
  const state = await mockPlatform(page);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Uma visão de tudo." }),
  ).toBeVisible();
  const size = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(size.scroll).toBe(size.client);
  await page.screenshot({
    path: `test-results/dashboard-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.goto(`/admin/projetos/${state.projectId}/editor`);
  await expect(
    page.getByRole("heading", { name: "Tour QA", exact: true }),
  ).toBeVisible();
  await page
    .locator("input[type=file][multiple]")
    .setInputFiles([
      new URL("../assets/seven-1-image.jpg", import.meta.url).pathname,
      new URL("../assets/seven-2-image.jpg", import.meta.url).pathname,
    ]);
  await expect(page.locator(".editor-status")).toContainText(
    "Fotografias enviadas",
    { timeout: 30000 },
  );
  await expect(page.locator(".panorama-loading")).toHaveCount(0, {
    timeout: 30000,
  });
  await page
    .getByLabel("Destino da nova seta")
    .selectOption({ label: "seven-2-image" });
  await page
    .getByRole("button", { name: "Posicionar no panorama", exact: true })
    .click();
  const canvas = page.locator(".panorama-canvas");
  const box = await canvas.boundingBox();
  if (test.info().project.name === "mobile")
    await canvas.tap({
      position: { x: box!.width * 0.6, y: box!.height * 0.65 },
    });
  else
    await canvas.click({
      position: { x: box!.width * 0.6, y: box!.height * 0.65 },
    });
  await expect(
    page.getByRole("button", { name: "Posicionar retorno", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Posicionar retorno", exact: true })
    .click();
  await expect(page.locator(".panorama-loading")).toHaveCount(0, {
    timeout: 30000,
  });
  const backbox = await canvas.boundingBox();
  if (test.info().project.name === "mobile")
    await canvas.tap({
      position: { x: backbox!.width * 0.3, y: backbox!.height * 0.6 },
    });
  else
    await canvas.click({
      position: { x: backbox!.width * 0.3, y: backbox!.height * 0.6 },
    });
  await expect(page.getByLabel("Rótulo", { exact: true })).toBeVisible();
  await page
    .getByLabel("Rótulo", { exact: true })
    .fill("Voltar ao ambiente inicial");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Publicar", exact: true }).click();
  await expect(page.locator(".editor-status")).toContainText("Tour publicado");
  expect(state.versions.filter((v) => v.kind === "published")).toHaveLength(1);
  const original = structuredClone(state.readSnapshot());
  await page.getByLabel("Rótulo", { exact: true }).fill("Volta V2");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Publicar", exact: true }).click();
  await expect(page.locator(".editor-status")).toContainText("Tour publicado");
  await page.getByRole("button", { name: /Histórico/ }).click();
  const v1 = page
    .locator(".version-list article")
    .filter({ hasText: "V1 · Publicação" });
  page.once("dialog", (d) => d.accept());
  await v1
    .getByRole("button", { name: "Restaurar rascunho", exact: true })
    .click();
  await expect(page.locator(".editor-status")).toContainText(
    "Versão restaurada e salva",
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Tour QA", exact: true }),
  ).toBeVisible();
  expect(state.readSnapshot()).toEqual(original);
  expect(state.versions.filter((v) => v.kind === "published")).toHaveLength(2);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Publicar", exact: true }).click();
  await expect(page.locator(".editor-status")).toContainText("Tour publicado");
  expect(state.versions).toHaveLength(4);
  const arrows = state.readSnapshot().scenes.flatMap((s) => s.links);
  expect(arrows).toHaveLength(2);
  expect(arrows[0]!.yaw).not.toBe(arrows[1]!.yaw);
  await page.getByRole("button", { name: "Prévia", exact: true }).click();
  await expect(page.locator(".preview-modal .panorama-loading")).toHaveCount(
    0,
    { timeout: 30000 },
  );
  await expect(page.locator(".viewer-scene")).toContainText("seven-1-image");
  await page.getByRole("button", { name: "Ambientes", exact: true }).click();
  await page
    .locator(".viewer-drawer")
    .getByRole("button", { name: "seven-2-image", exact: false })
    .click();
  await expect(page.locator(".viewer-scene")).toContainText("seven-2-image");
  await page
    .getByRole("button", { name: "Voltar ao ponto anterior", exact: true })
    .click();
  await expect(page.locator(".viewer-scene")).toContainText("seven-1-image");
  await page
    .getByRole("button", { name: "Fechar prévia", exact: true })
    .click();
  const dimensions = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scroll).toBe(dimensions.client);
  expect(errors).toEqual([]);
  await page.screenshot({
    path: `test-results/editor-${test.info().project.name}.png`,
    fullPage: true,
  });
});
test("create client and project through UI", async ({ page }) => {
  test.setTimeout(20000);
  const state = await mockPlatform(page);
  await page.goto("/admin/clientes");
  await page.getByRole("button", { name: "Novo cliente", exact: true }).click();
  await page
    .getByLabel("Nome do cliente", { exact: true })
    .fill("Cliente novo de QA");
  await page
    .getByLabel("Identificador", { exact: true })
    .fill("cliente-novo-qa");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Cliente novo de QA", exact: true }),
  ).toBeVisible();
  await page.goto("/admin/projetos");
  await page.getByRole("button", { name: "Novo projeto", exact: true }).click();
  await page
    .getByLabel("Título do tour", { exact: true })
    .fill("Projeto criado pelo painel");
  await page.getByLabel("Endereço", { exact: true }).fill("projeto-novo-qa");
  await page
    .getByLabel("Cliente", { exact: true })
    .selectOption({ label: "Cliente novo de QA" });
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Projeto criado pelo painel",
      exact: true,
    }),
  ).toBeVisible();
  expect(state.projects).toHaveLength(2);
});
