import { test, expect } from "@playwright/test";
import { mockPlatform } from "./mock-platform";
test("manage tours, open visual text editor, personalize and save across reload", async ({
  page,
}) => {
  const state = await mockPlatform(page);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/admin/projetos");
  await page
    .getByRole("link", { name: "Personalizar Tour QA", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Conteúdo e layout",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("button", { name: "UMA EXPERIÊNCIA EM 360°", exact: true })
    .click();
  await dialog
    .getByLabel("Conteúdo do texto", { exact: true })
    .fill("Sua visita começa aqui");
  await expect(
    dialog.getByRole("button", { name: "Sua visita começa aqui", exact: true }),
  ).toBeVisible();
  await dialog.getByText("Tamanhos e proporções", { exact: true }).click();
  await dialog
    .getByRole("slider", { name: "Largura da logomarca", exact: true })
    .press("ArrowRight");
  await dialog
    .getByRole("button", { name: "Adicionar seção de conteúdo", exact: true })
    .click();
  await dialog
    .getByLabel("Conteúdo do texto", { exact: true })
    .fill("Sobre o espaço");
  await dialog
    .getByRole("button", { name: "Aplicar ao rascunho", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.locator(".editor-status")).toContainText("Rascunho salvo");
  expect(state.readSnapshot().presentation?.copy.subtitle).toBe(
    "Sua visita começa aqui",
  );
  expect(state.readSnapshot().presentation?.blocks[0]?.title).toBe(
    "Sobre o espaço",
  );
  expect(state.readSnapshot().presentation?.layout.logoWidth).toBe(49);
  await page.reload();
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Sua visita começa aqui", exact: true }),
  ).toBeVisible();
  const size = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(size.scroll).toBe(size.client);
  expect(errors).toEqual([]);
  await page.screenshot({
    path: `test-results/content-${test.info().project.name}.png`,
    fullPage: true,
  });
});
