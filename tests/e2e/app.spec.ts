import { test, expect, type BrowserContext, type Page } from "@playwright/test";

test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-forwarded-for": `198.51.100.${Math.floor(Math.random() * 200) + 1}` });
});

const stamp = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

async function signup(page: Page, email: string, name: string) {
  await page.goto("/signup");
  await page.fill("#name", name);
  await page.fill("#email", email);
  await page.fill("#password", "BloomTest123!");
  await page.fill("#confirm", "BloomTest123!");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/onboarding", { timeout: 20_000 });
}

async function createFamily(page: Page, family: string, baby: string) {
  await page.fill("#family", family);
  await page.getByRole("button", { name: "Next" }).click();
  await page.fill("#baby", baby);
  await page.fill("#dob", "2026-06-01");
  await page.getByRole("button", { name: "Start tracking" }).click();
  await page.waitForURL("**/dashboard", { timeout: 20_000 });
}

test("signs up, sets up a family, logs a feed and builds a PDF", async ({ page }) => {
  const email = `e2e-${stamp()}@bloom.test`;
  await signup(page, email, "E2E Parent");
  await createFamily(page, "E2E Family", "E2E Baby");
  await expect(page.getByRole("heading", { name: /E2E Baby|Good (morning|afternoon|evening)/ }).first()).toBeVisible();
  const viewportMeta = await page.locator('meta[name="viewport"]').getAttribute("content");
  expect(viewportMeta).toContain("user-scalable=no");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true);

  await page.goto("/feeding?add=1");
  await page.getByRole("button", { name: "Formula", exact: true }).click();
  await page.getByRole("button", { name: "120 ml" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Feeding saved")).toBeVisible({ timeout: 15_000 });

  await page.goto("/timeline");
  await expect(page.getByText("120 ml").first()).toBeVisible({ timeout: 15_000 });

  await page.goto("/reports");
  const responsePromise = page.waitForResponse(
    (response) => response.url().includes("/api/reports") && response.request().method() === "POST",
    { timeout: 45_000 },
  );
  await page.getByRole("button", { name: "Generate PDF" }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/pdf");
  await expect(page.locator('iframe[title="Preview"]')).toBeVisible({ timeout: 20_000 });
});

test("two parents see the same new record without refreshing", async ({ browser }) => {
  const emailA = `rt-a-${stamp()}@bloom.test`;
  const emailB = `rt-b-${stamp()}@bloom.test`;
  const contextA = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": "198.51.100.210" } });
  const contextB = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": "198.51.100.211" } });
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  try {
    await signup(pageA, emailA, "Realtime A");
    await createFamily(pageA, "Realtime Family", "Realtime Baby");

    const cookies = await contextA.cookies();
    const familyId = cookies.find((cookie) => cookie.name === "bloom_family")?.value;
    const babyId = cookies.find((cookie) => cookie.name === "bloom_baby")?.value;
    expect(familyId).toBeTruthy();
    expect(babyId).toBeTruthy();

    const invite = await pageA.evaluate(
      async ({ familyId, emailB }) => {
        const response = await fetch("/api/family/invitations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ familyId, email: emailB, role: "parent" }),
        });
        return response.json();
      },
      { familyId: familyId!, emailB },
    );
    expect(invite.link).toBeTruthy();

    await signup(pageB, emailB, "Realtime B");
    await pageB.goto(invite.link.replace(/^https?:\/\/[^/]+/, ""));
    await pageB.getByRole("button", { name: "Accept invitation" }).click();
    await pageB.waitForURL("**/dashboard", { timeout: 20_000 });

    await pageB.goto("/dashboard");
    await expect(pageB.getByText("Today's log")).toBeVisible();

    await pageA.evaluate(async (babyId) => {
      await fetch("/api/records/feedings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          babyId,
          type: "formula",
          startedAt: new Date().toISOString(),
          amountMl: 150,
          formulaBrand: "Realtime",
        }),
      });
    }, babyId!);

    await expect(pageB.getByText("150 ml").first()).toBeVisible({ timeout: 20_000 });
  } finally {
    await contextA.close();
    await contextB.close();
  }
});

test("queues a diaper offline and syncs when the connection returns", async ({ page, context }) => {
  const email = `offline-${stamp()}@bloom.test`;
  await signup(page, email, "Offline Parent");
  await createFamily(page, "Offline Family", "Offline Baby");

  await page.route("**/api/records/**", (route) => route.abort("internetdisconnected"));
  await page.getByRole("button", { name: /Wet · Quick add/ }).click();
  await expect(page.getByText("Waiting to sync")).toBeVisible({ timeout: 10_000 });

  await page.unroute("**/api/records/**");
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByText(/offline change.*synced/i)).toBeVisible({ timeout: 20_000 });
  await page.reload();
  await expect(page.getByText("1 Wet · 0 Dirty")).toBeVisible({ timeout: 15_000 });
});
