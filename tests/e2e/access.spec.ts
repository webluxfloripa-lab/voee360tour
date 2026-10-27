import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.route("**/*", (route) => {
    const host = new URL(route.request().url()).hostname;
    return host === "127.0.0.1" || host === "localhost"
      ? route.continue()
      : route.abort("blockedbyclient");
  });
});
test("login renders, password is hidden, has no horizontal overflow", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Seu universo 360°." }),
  ).toBeVisible();
  expect(
    await page
      .locator('input[autocomplete="current-password"]')
      .getAttribute("type"),
  ).toBe("password");
  await page
    .getByRole("button", { name: "Mostrar senha", exact: true })
    .click();
  await expect(
    page.locator('input[autocomplete="current-password"]'),
  ).toHaveAttribute("type", "text");
  await page
    .getByRole("button", { name: "Ocultar senha", exact: true })
    .click();
  const size = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(size.scroll).toBe(size.client);
  expect(errors).toEqual([]);
  await page.screenshot({
    path: `test-results/login-${test.info().project.name}.png`,
    fullPage: true,
  });
});
test("admin cannot be accessed anonymously on direct refresh", async ({
  page,
}) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("button", { name: "Entrar no painel", exact: true }),
  ).toBeVisible();
  await page.goto("/admin/projetos");
  await expect(page).toHaveURL(/\/login$/);
});
test("recovery form never sets a password without a valid invitation", async ({
  page,
}) => {
  await page.goto("/definir-senha");
  await expect(
    page.getByRole("button", { name: "Salvar e entrar", exact: true }),
  ).toBeDisabled();
  await expect(page.getByLabel("Link do convite")).toBeVisible();
});
