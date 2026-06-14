import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// License key format: alphanumeric + hyphens, 20-64 chars
const licenseSchema = z.string().regex(/^[A-Za-z0-9\-]{20,64}$/);

export async function GET(req: NextRequest) {
  const licenseKey = req.nextUrl.searchParams.get("license");

  const parsed = licenseSchema.safeParse(licenseKey);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid license key format" }, { status: 400 });
  }

  const apiUrl = process.env.NEXT_PUBLIC_LICENSE_API_URL ?? "https://license-manager.discloud.app";

  try {
    const res = await fetch(
      `${apiUrl}/api/v1/licenses/validate?key=${encodeURIComponent(parsed.data)}`,
      { headers: { "x-api-key": process.env.ADMIN_API_KEY! } }
    );

    if (!res.ok) {
      return NextResponse.json({ error: "Invalid or expired license" }, { status: 403 });
    }

    const data = await res.json() as { valid?: boolean; status?: string };
    if (!data.valid && data.status !== "active") {
      return NextResponse.json({ error: "License is not active" }, { status: 403 });
    }
  } catch (err) {
    console.error("[download] license validation error:", err);
    return NextResponse.json({ error: "Could not validate license" }, { status: 500 });
  }

  const downloadUrl = process.env.DOWNLOAD_FILE_URL;
  if (!downloadUrl) {
    console.error("[download] DOWNLOAD_FILE_URL not set");
    return NextResponse.json({ error: "Download not configured" }, { status: 500 });
  }

  return NextResponse.redirect(downloadUrl);
}
