import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";

/**
 * Build a valid Telegram-style initData string with correct HMAC hash.
 */
function buildTestInitData(
  params: Record<string, string>,
  botToken: string,
): string {
  const entries = Object.entries(params).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join("\n");
  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();
  const hash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");
  const sp = new URLSearchParams(params);
  sp.set("hash", hash);
  return sp.toString();
}

const TEST_BOT_TOKEN = "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11";

describe("validate-init", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("returns 500 when BOT_TOKEN is missing", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    const { POST } = await import("@/app/api/bot/validate-init/route");
    const req = new Request("http://test/api/bot/validate-init", {
      method: "POST",
      body: JSON.stringify({ initData: "foo=bar&hash=abc" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Bot token not configured");
  });

  it("returns 400 when initData is missing", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", TEST_BOT_TOKEN);
    const { POST } = await import("@/app/api/bot/validate-init/route");
    const req = new Request("http://test/api/bot/validate-init", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Missing initData");
  });

  it("returns 400 when hash is missing from initData", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", TEST_BOT_TOKEN);
    const { POST } = await import("@/app/api/bot/validate-init/route");
    const req = new Request("http://test/api/bot/validate-init", {
      method: "POST",
      body: JSON.stringify({ initData: "foo=bar&baz=qux" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.valid).toBe(false);
    expect(body.error).toBe("No hash in initData");
  });

  it("returns 403 with 'Hash mismatch' for invalid hash", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", TEST_BOT_TOKEN);
    const { POST } = await import("@/app/api/bot/validate-init/route");
    const req = new Request("http://test/api/bot/validate-init", {
      method: "POST",
      body: JSON.stringify({ initData: "foo=bar&hash=deadbeef" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.valid).toBe(false);
    expect(body.error).toBe("Hash mismatch");
  });

  it("returns 200 with valid: true for correct HMAC", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", TEST_BOT_TOKEN);
    const { POST } = await import("@/app/api/bot/validate-init/route");
    const now = Math.floor(Date.now() / 1000);
    const initData = buildTestInitData(
      { auth_date: String(now), query_id: "test123" },
      TEST_BOT_TOKEN,
    );
    const req = new Request("http://test/api/bot/validate-init", {
      method: "POST",
      body: JSON.stringify({ initData }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.valid).toBe(true);
  });

  it("returns 403 with 'initData expired' for old auth_date", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", TEST_BOT_TOKEN);
    const { POST } = await import("@/app/api/bot/validate-init/route");
    // auth_date 2 hours ago (7200 seconds) — exceeds 3600s limit
    const oldTimestamp = Math.floor(Date.now() / 1000) - 7200;
    const initData = buildTestInitData(
      { auth_date: String(oldTimestamp), query_id: "old_query" },
      TEST_BOT_TOKEN,
    );
    const req = new Request("http://test/api/bot/validate-init", {
      method: "POST",
      body: JSON.stringify({ initData }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.valid).toBe(false);
    expect(body.error).toBe("initData expired");
  });

  it("returns parsed user JSON when present in valid initData", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", TEST_BOT_TOKEN);
    const { POST } = await import("@/app/api/bot/validate-init/route");
    const now = Math.floor(Date.now() / 1000);
    const user = JSON.stringify({
      id: 12345,
      first_name: "Test",
      username: "testuser",
    });
    const initData = buildTestInitData(
      { auth_date: String(now), query_id: "q1", user },
      TEST_BOT_TOKEN,
    );
    const req = new Request("http://test/api/bot/validate-init", {
      method: "POST",
      body: JSON.stringify({ initData }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.valid).toBe(true);
    expect(body.user).toEqual({
      id: 12345,
      first_name: "Test",
      username: "testuser",
    });
  });
});
