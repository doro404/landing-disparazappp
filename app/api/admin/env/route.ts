import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// Keys that should never be returned in plaintext
const SECRET_KEYS = new Set([
  "ADMIN_PASSWORD",
  "ADMIN_API_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "RESEND_API_KEY",
  "DOWNLOAD_SECRET",
]);

function maskValue(key: string, val: string): string {
  if (!SECRET_KEYS.has(key) || !val) return val;
  if (val.length <= 8) return "••••••••";
  return val.slice(0, 4) + "••••••••" + val.slice(-4);
}

// GET — return current .env.local as key/value map (masks secret values)
export async function GET() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return NextResponse.json({ values: {} });

  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  const values: Record<string, string> = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    values[key] = maskValue(key, val);
  }

  return NextResponse.json({ values });
}

// POST — update specific keys in .env.local
export async function POST(req: NextRequest) {
  const { updates } = await req.json() as { updates: Record<string, string> };

  const envPath = path.resolve(process.cwd(), ".env.local");
  let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";

  for (const [key, value] of Object.entries(updates)) {
    // Skip masked placeholder values — don't overwrite real secrets with masks
    if (SECRET_KEYS.has(key) && value.includes("••••")) continue;

    const regex = new RegExp(`^${key}=.*$`, "m");
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${value}`);
    } else {
      content = content.trimEnd() + `\n${key}=${value}\n`;
    }
  }

  fs.writeFileSync(envPath, content, "utf-8");
  return NextResponse.json({ ok: true });
}
