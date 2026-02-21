import { NextResponse } from "next/server";

const BOT_WEBHOOK_URL = process.env.BOT_WEBHOOK_URL;
const BOT_WEBHOOK_SECRET = process.env.BOT_WEBHOOK_SECRET;

export async function POST(req: Request) {
  if (!BOT_WEBHOOK_URL || !BOT_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const body = await req.json();

  try {
    const res = await fetch(`${BOT_WEBHOOK_URL}/notify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${BOT_WEBHOOK_SECRET}`,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json({ forwarded: true, status: res.status, data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ forwarded: false, error: msg }, { status: 502 });
  }
}
