import { NextResponse } from "next/server";
import crypto from "crypto";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export async function POST(req: Request) {
  if (!BOT_TOKEN) {
    return NextResponse.json({ error: "Bot token not configured" }, { status: 500 });
  }

  const { initData } = (await req.json()) as { initData?: string };
  if (!initData) {
    return NextResponse.json({ error: "Missing initData" }, { status: 400 });
  }

  // 1. Parse initData as URLSearchParams
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) {
    return NextResponse.json({ valid: false, error: "No hash in initData" }, { status: 400 });
  }

  // 2. Build data_check_string: sort remaining params alphabetically, join as key=value\n
  params.delete("hash");
  const entries = Array.from(params.entries()).sort(([a], [b]) => a.localeCompare(b));
  const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join("\n");

  // 3. secret_key = HMAC-SHA256("WebAppData", BOT_TOKEN)
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();

  // 4. Compare HMAC-SHA256(data_check_string, secret_key) with hash
  const computedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (computedHash !== hash) {
    return NextResponse.json({ valid: false, error: "Hash mismatch" }, { status: 403 });
  }

  // 5. Verify auth_date is within 1 hour
  const authDate = params.get("auth_date");
  if (authDate) {
    const authTimestamp = parseInt(authDate, 10);
    const now = Math.floor(Date.now() / 1000);
    if (now - authTimestamp > 3600) {
      return NextResponse.json({ valid: false, error: "initData expired" }, { status: 403 });
    }
  }

  // Parse user data if present
  let user = null;
  const userStr = params.get("user");
  if (userStr) {
    try {
      user = JSON.parse(userStr);
    } catch { /* ignore */ }
  }

  return NextResponse.json({ valid: true, user });
}
