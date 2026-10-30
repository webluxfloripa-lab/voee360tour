import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.route("**/*", (route) => {
    const host = new URL(route.request().url()).hostname;
    return host === "127.0.0.1" || host === "localhost"
      ? route.continue()
      : route.abort("blockedbyclient");
  });
});
test("passwordless access presents email and no password field without overflow", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Acessar painel/ })).toBeVisible();
  await page.getByRole("link", { name: /Acessar painel/ }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Seu universo 360°." })).toBeVisible();
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await expect(page.getByLabel("E-mail autorizado")).toHaveAttribute("type", "email");
  await expect(page.getByRole("button", { name: "Acessar painel" })).toBeVisible();
  const size = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(size.scroll).toBe(size.client);
  expect(errors).toEqual([]);
  await page.screenshot({
    path: `test-results/passwordless-${test.info().project.name}.png`,
    fullPage: true,
  });
});
test("admin cannot be accessed anonymously on direct refresh", async ({
  page,
}) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("button", { name: "Acessar painel", exact: true }),
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

test("malformed public tour and iframe links return 404 instead of server errors", async ({
  page,
}) => {
  for (const path of ["/t/Bad_Link", "/embed/Bad_Link", "/og/Bad_Link"]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
  }
});
