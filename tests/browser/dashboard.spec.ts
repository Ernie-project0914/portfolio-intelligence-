import { test, expect } from "@playwright/test";
test("dashboard navigation, chart, allocation, search and watchlist", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Portfolio overview" }),
  ).toBeVisible();
  await expect(page.getByText("DEMO DATA", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "1M", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "1M", exact: true }),
  ).toHaveClass("selected");
  await page.getByLabel("Chart metric").selectOption("Return %");
  await page.getByRole("button", { name: "Zoom", exact: true }).click();
  await expect(page.locator(".recharts-brush")).toBeVisible();
  await page.getByRole("button", { name: "Technology", exact: false }).click();
  await expect(
    page.getByRole("heading", { name: "Holdings", exact: true }),
  ).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(3);
  await page.getByLabel("Search holdings").fill("Apple");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByRole("button", { name: "Research AAPL" }).click();
  await expect(page.getByRole("heading", { name: "Apple Inc." })).toBeVisible();
  await page.getByRole("button", { name: "Remove from watchlist" }).click();
  await page
    .locator("nav")
    .getByRole("button", { name: "Watchlist", exact: true })
    .click();
  await expect(
    page.locator(".list-row").filter({ hasText: "AAPL" }),
  ).toHaveCount(0);
  await page.getByLabel("Watchlist ticker").fill("AAPL");
  await page.getByRole("button", { name: "Add stock", exact: true }).click();
  await expect(
    page.locator(".list-row").filter({ hasText: "AAPL" }),
  ).toHaveCount(1);
  await page.reload();
  await page
    .locator("nav")
    .getByRole("button", { name: "Watchlist", exact: true })
    .click();
  await expect(
    page.locator(".list-row").filter({ hasText: "AAPL" }),
  ).toHaveCount(1);
  for (const name of [
    "News",
    "Calendar",
    "Transactions",
    "Risk",
    "Alerts",
    "Markets",
    "Performance",
  ]) {
    await page
      .locator("nav")
      .getByRole("button", { name, exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
  }
  await page.getByLabel("Chart metric").selectOption("Value");
  await page
    .locator("nav")
    .getByRole("button", { name: "Overview", exact: true })
    .click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "/tmp/folio-desktop.png", fullPage: true });
  expect(errors).toEqual([]);
});
test("mobile layout and menu", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Portfolio overview" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.getByRole("button", { name: "Open menu" }).click();
  await page
    .locator("nav")
    .getByRole("button", { name: "Holdings", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Holdings", exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "/tmp/folio-mobile.png", fullPage: true });
});
test("reduced-motion, evaluated alerts, calculated assistant and archived briefing", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByLabel("$137,422.70", { exact: true })).toBeVisible();
  await expect(page.locator(".recharts-pie-sector")).toHaveCount(6);
  await page
    .locator("nav")
    .getByRole("button", { name: "Alerts", exact: true })
    .click();
  await page.getByLabel("Alert ticker").fill("AAPL");
  await page.getByLabel("Alert threshold").fill("200");
  await page.getByRole("button", { name: "Save rule" }).click();
  await expect(page.getByText("Triggered", { exact: true })).toBeVisible();
  await expect(
    page.getByText("DEMO: AAPL price above 200", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Evaluate now" }).click();
  await expect(
    page.getByText("DEMO: AAPL price above 200", { exact: true }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Remove alert" }).click();
  await expect(page.getByText("Triggered", { exact: true })).toHaveCount(0);
  await page
    .locator("nav")
    .getByRole("button", { name: "Research", exact: true })
    .click();
  await page
    .getByLabel("Research question")
    .fill("How concentrated am I in technology?");
  await page.getByRole("button", { name: "Ask assistant" }).click();
  await expect(page.getByText(/Technology exposure is 56.1%/)).toBeVisible();
  await expect(page.getByText(/CALCULATED EXPLANATION/)).toBeVisible();
  await page
    .locator("nav")
    .getByRole("button", { name: "Daily Briefing", exact: true })
    .click();
  await page.getByRole("button", { name: "Generate daily briefing" }).click();
  await expect(page.getByText(/DEMO • generated/)).toBeVisible();
  await page
    .locator(".sidebar-bottom")
    .getByRole("button", { name: "Connections", exact: true })
    .click();
  await expect(
    page.getByText("Manual transaction provider", { exact: true }),
  ).toBeVisible();
  await page
    .locator(".sidebar-bottom")
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  await expect(page.getByRole("button", { name: "Export JSON" })).toBeVisible();
});
test("manual private portfolio: register, deposit, buy, value, persist and reject oversell", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Portfolio overview" }),
  ).toBeVisible();
  await page
    .locator(".sidebar-bottom")
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  await page.getByRole("button", { name: "Create private account" }).click();
  await page.getByLabel("Account email").fill("owner@example.com");
  await page
    .getByLabel("Account password")
    .fill("a-long-browser-fixture-password");
  await page
    .getByLabel("Registration code")
    .fill("browser-fixture-registration-code");
  await page.getByRole("button", { name: "Create private workspace" }).click();
  await expect(
    page.getByText("Private workspace", { exact: true }),
  ).toBeVisible();
  await page
    .locator("nav")
    .getByRole("button", { name: "Transactions", exact: true })
    .click();
  await page.getByLabel("Transaction type").selectOption("DEPOSIT");
  await page.getByLabel("Transaction amount").fill("1000");
  await page.getByRole("button", { name: "Record transaction" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByLabel("Transaction type").selectOption("BUY");
  await page.getByLabel("Transaction ticker").fill("AAPL");
  await page.getByLabel("Transaction shares").fill("2");
  await page.getByLabel("Transaction price").fill("100");
  await page.getByRole("button", { name: "Record transaction" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await page
    .locator("nav")
    .getByRole("button", { name: "Overview", exact: true })
    .click();
  await expect(page.getByLabel("Unpriced", { exact: true })).toBeVisible();
  await page
    .locator(".sidebar-bottom")
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  await page.getByLabel("Quote ticker").fill("AAPL");
  await page.getByLabel("Manual price").fill("150");
  await page.getByLabel("Previous close").fill("145");
  await page.getByRole("button", { name: "Save manual quote" }).click();
  await expect(
    page.getByText("Manual quote saved", { exact: true }),
  ).toBeVisible();
  await page
    .locator("nav")
    .getByRole("button", { name: "Overview", exact: true })
    .click();
  await expect(page.getByLabel("$1,100.00", { exact: true })).toBeVisible();
  await expect(page.getByText("MANUAL", { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("$1,100.00", { exact: true })).toBeVisible();
  await page
    .locator("nav")
    .getByRole("button", { name: "Transactions", exact: true })
    .click();
  await page.getByLabel("Transaction type").selectOption("SELL");
  await page.getByLabel("Transaction ticker").fill("AAPL");
  await page.getByLabel("Transaction shares").fill("3");
  await page.getByLabel("Transaction price").fill("150");
  await page.getByRole("button", { name: "Record transaction" }).click();
  await expect(page.getByRole("alert")).toContainText("Sale exceeds AAPL");
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await page
    .locator(".sidebar-bottom")
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  await page.getByLabel("Quote ticker").fill("AAPL");
  await page.getByLabel("Manual price").fill("90");
  await page.getByLabel("Previous close").fill("");
  await page.getByRole("button", { name: "Save manual quote" }).click();
  await expect(
    page.getByText("Manual quote saved", { exact: true }),
  ).toBeVisible();
  await page
    .locator("nav")
    .getByRole("button", { name: "Overview", exact: true })
    .click();
  await expect(page.getByLabel("-$20.00", { exact: true })).toHaveText(
    "-$20.00",
  );
  await expect(page.getByLabel("Unavailable", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
test("CSV preview, atomic commit, duplicate prevention and manual calendar persistence", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Portfolio overview" }),
  ).toBeVisible();
  await page
    .locator("nav")
    .getByRole("button", { name: "Transactions", exact: true })
    .click();
  const csv =
    "date,ticker,type,quantity,price,amount,fees,external_id\n2025-03-01,,DEPOSIT,0,0,1000,0,test-deposit\n2025-03-02,AAPL,BUY,1,100,0,0,test-buy";
  await page.getByLabel("CSV content").fill(csv);
  await page.getByRole("button", { name: "Validate preview" }).click();
  await expect(page.getByText(/2 new • 0 duplicates/)).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(8);
  await page.getByRole("button", { name: "Commit import" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(10);
  await page.getByRole("button", { name: "Validate preview" }).click();
  await expect(page.getByText(/0 new • 2 duplicates/)).toBeVisible();
  await page
    .locator("nav")
    .getByRole("button", { name: "Calendar", exact: true })
    .click();
  await page.getByLabel("Event title").fill("Review company report");
  await page.getByLabel("Event date").fill("2026-12-01");
  await page.getByRole("button", { name: "Add event", exact: true }).click();
  await expect(
    page.getByText("Review company report", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .locator("nav")
    .getByRole("button", { name: "Calendar", exact: true })
    .click();
  await expect(
    page.getByText("Review company report", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("MANUAL", { exact: true }).last()).toBeVisible();
});
test("development server never serves private database or registration files", async ({
  request,
}) => {
  const { mkdirSync, writeFileSync, rmSync } = await import("node:fs");
  const { randomUUID } = await import("node:crypto");
  const folder = `.data/browser-security-${randomUUID()}`;
  mkdirSync(folder, { recursive: true, mode: 0o700 });
  try {
    for (const file of ["registration-code", "folio.sqlite", "backup.sqlite"]) {
      writeFileSync(`${folder}/${file}`, "PRIVATE TEST FIXTURE", {
        mode: 0o600,
        flag: "wx",
      });
      const response = await request.get(`/${folder}/${file}`);
      expect(response.status()).toBe(403);
    }
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});
