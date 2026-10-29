import { expect, test } from "@playwright/test";
import { mockPlatform } from "./mock-platform";

test("permanent tour deletion requires exact confirmation and removes only the chosen project", async ({ page }) => {
  const state = await mockPlatform(page);
  state.projects.push({ ...state.projects[0], id: "99999999-9999-4999-8999-999999999999", title: "Tour preservado", slug: "tour-preservado" });
  await page.goto("/admin/projetos");
  await page.getByRole("button", { name: "Opções de Tour QA", exact: true }).click();
  await page.getByRole("button", { name: "Excluir passeio virtual", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "Excluir passeio virtual?" });
  await expect(dialog.getByRole("button", { name: "Excluir definitivamente" })).toBeDisabled();
  await dialog.getByRole("textbox", { name: "Identificador para confirmar exclusão" }).fill("wrong-project");
  await expect(dialog.getByRole("button", { name: "Excluir definitivamente" })).toBeDisabled();
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tour QA", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Opções de Tour QA", exact: true }).click();
  await page.getByRole("button", { name: "Excluir passeio virtual", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Excluir passeio virtual?" });
  await dialog.getByRole("textbox", { name: "Identificador para confirmar exclusão" }).fill("tour-qa");
  await page.screenshot({ path: `test-results/delete-confirm-${test.info().project.name}.png`, fullPage: true });
  await dialog.getByRole("button", { name: "Excluir definitivamente" }).click();
  await expect(page.getByRole("heading", { name: "Tour QA", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Tour preservado", exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("excluídos definitivamente");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Tour preservado", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tour QA", exact: true })).toHaveCount(0);
});
