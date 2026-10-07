import { test } from "node:test";
import assert from "node:assert/strict";
import { openDatabase } from "../server/db.mjs";
import { PortfolioService } from "../server/service.mjs";
import { createApp } from "../server/index.mjs";
test("HTTP authentication, cookie flags, CSRF rejection and account ownership", async () => {
  const db = openDatabase(":memory:");
  const service = new PortfolioService(db, {
    env: {},
    registrationCode: "test-only-registration-code",
  });
  const app = createApp(service);
  await new Promise((r) => app.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${app.address().port}`;
  const headers = { "Content-Type": "application/json", "X-Folio-Client": "1" };
  try {
    assert.equal((await fetch(base + "/api/state")).status, 401);
    assert.equal(
      (
        await fetch(base + "/api/auth/demo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(base + "/api/auth/demo", {
          method: "POST",
          headers: { ...headers, Origin: "https://evil.example" },
          body: "{}",
        })
      ).status,
      403,
    );
    const response = await fetch(base + "/api/auth/demo", {
      method: "POST",
      headers,
      body: "{}",
    });
    assert.equal(response.status, 200);
    const cookie = response.headers.get("set-cookie");
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Strict/);
    const auth = { ...headers, Cookie: cookie.split(";")[0] };
    const state = await (
      await fetch(base + "/api/state", { headers: auth })
    ).json();
    assert.equal(state.total, 137422.7);
    assert.equal(
      (
        await fetch(base + "/api/transactions", {
          method: "POST",
          headers: auth,
          body: JSON.stringify({
            accountId: "not-owned",
            type: "DEPOSIT",
            amount: 10,
            timestamp: "2025-01-01",
          }),
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await fetch(base + "/api/transactions", {
          method: "POST",
          headers: auth,
          body: "null",
        })
      ).status,
      400,
    );
    await fetch(base + "/api/auth/logout", {
      method: "POST",
      headers: auth,
      body: "{}",
    });
    assert.equal(
      (await fetch(base + "/api/state", { headers: auth })).status,
      401,
    );
  } finally {
    await new Promise((r) => app.close(r));
    db.close();
  }
});
