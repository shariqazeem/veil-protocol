import { describe, it, expect, vi, beforeEach } from "vitest";

describe("notify", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns 500 when webhook config is missing", async () => {
    vi.stubEnv("BOT_WEBHOOK_URL", "");
    vi.stubEnv("BOT_WEBHOOK_SECRET", "");
    const { POST } = await import("@/app/api/bot/notify/route");
    const req = new Request("http://test/api/bot/notify", {
      method: "POST",
      body: JSON.stringify({ event: "deposit", amount: 100 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Webhook not configured");
  });

  it("returns 200 with forwarded: true on successful forward", async () => {
    vi.stubEnv("BOT_WEBHOOK_URL", "https://bot.test");
    vi.stubEnv("BOT_WEBHOOK_SECRET", "secret123");

    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.resolve({ ok: true }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { POST } = await import("@/app/api/bot/notify/route");
    const payload = { event: "deposit", amount: 100 };
    const req = new Request("http://test/api/bot/notify", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.forwarded).toBe(true);
    expect(body.status).toBe(200);
    expect(body.data).toEqual({ ok: true });

    // Verify fetch was called with correct URL and auth header
    expect(mockFetch).toHaveBeenCalledWith("https://bot.test/notify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer secret123",
      },
      body: JSON.stringify(payload),
    });
  });

  it("returns 502 when fetch throws an error", async () => {
    vi.stubEnv("BOT_WEBHOOK_URL", "https://bot.test");
    vi.stubEnv("BOT_WEBHOOK_SECRET", "secret123");

    const mockFetch = vi.fn().mockRejectedValue(new Error("Connection refused"));
    vi.stubGlobal("fetch", mockFetch);

    const { POST } = await import("@/app/api/bot/notify/route");
    const req = new Request("http://test/api/bot/notify", {
      method: "POST",
      body: JSON.stringify({ event: "test" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.forwarded).toBe(false);
    expect(body.error).toBe("Connection refused");
  });
});
