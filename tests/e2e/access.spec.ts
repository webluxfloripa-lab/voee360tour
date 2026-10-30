import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.route("**/*", (route) => {
    const host = new URL(route.request().url()).hostname;
    return host === "127.0.0.1" || host === "localhost"
      ? route.continue()
      : route.abort("blockedbyclient");
  });
});
test("one administrative button without login or email form", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: /Acessar painel de tours/ }),
  ).toBeVisible();
  await expect(page.locator("input")).toHaveCount(0);
  await page.goto("/login");
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("button", { name: /Acessar painel de tours/ }),
  ).toBeVisible();
  const size = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(size.scroll).toBe(size.client);
  expect(errors).toEqual([]);
});
test("admin route cannot be accessed anonymously", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("button", { name: /Acessar painel de tours/ }),
  ).toBeVisible();
  await page.goto("/admin/projetos");
  await expect(page).toHaveURL(/\/$/);
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
