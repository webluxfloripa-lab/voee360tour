import { test, expect } from "@playwright/test";
import { mockPlatform } from "./mock-platform";

test("route audit explains isolated rooms and guides a real bidirectional connection", async ({
  page,
}) => {
  const state = await mockPlatform(page);
  const failures: string[] = [];
  page.on("pageerror", (err) => failures.push(err.message));
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

  await page.getByRole("button", { name: /Auditoria/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Auditoria do trajeto" }),
  ).toBeVisible();
  await expect(
    dialog.getByText("Trajeto incompleto — não é uma falha nas fotografias."),
  ).toBeVisible();
  await expect(
    dialog.getByRole("heading", { name: "Ambientes ainda isolados (1)" }),
  ).toBeVisible();
  await dialog
    .getByLabel("Ambiente de destino")
    .selectOption({ label: "seven-2-image" });
  await dialog
    .getByRole("button", { name: "Posicionar seta no panorama" })
    .click();
  await expect(page.locator(".editor-status")).toContainText(
    "Conectando seven-1-image",
  );
  await expect(dialog).toHaveCount(0);

  const canvas = page.locator(".panorama-canvas");
  await expect(page.locator(".panorama-loading")).toHaveCount(0, {
    timeout: 30000,
  });
  const first = await canvas.boundingBox();
  expect(first).not.toBeNull();
  if (test.info().project.name === "mobile") {
    await canvas.tap({
      position: { x: first!.width * 0.6, y: first!.height * 0.6 },
    });
  } else {
    await canvas.click({
      position: { x: first!.width * 0.6, y: first!.height * 0.6 },
    });
  }

  await page
    .getByRole("button", { name: "Confirmar destino", exact: true })
    .click();
  await page.getByRole("button", { name: /Auditoria/ }).click();
  await expect(
    dialog.getByRole("heading", { name: "Setas que precisam de retorno (1)" }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Posicionar volta" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".panorama-loading")).toHaveCount(0, {
    timeout: 30000,
  });
  const second = await canvas.boundingBox();
  expect(second).not.toBeNull();
  if (test.info().project.name === "mobile") {
    await canvas.tap({
      position: { x: second!.width * 0.4, y: second!.height * 0.6 },
    });
  } else {
    await canvas.click({
      position: { x: second!.width * 0.4, y: second!.height * 0.6 },
    });
  }

  await page
    .getByRole("button", { name: "Concluir conexão", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Continuar editando este ambiente",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: /Auditoria/ }).click();
  await expect(
    dialog.getByText("As conexões passaram na validação lógica."),
  ).toBeVisible();
  const viewport = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(viewport.content).toBe(viewport.width);
  expect(failures).toEqual([]);
});
