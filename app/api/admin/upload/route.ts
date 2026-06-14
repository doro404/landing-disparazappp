import { NextRequest, NextResponse } from "next/server";

const BASE_URL = process.env.NEXT_PUBLIC_LICENSE_API_URL ?? "https://license-manager.discloud.app";
const API_KEY = process.env.ADMIN_API_KEY ?? "";

export async function POST(req: NextRequest) {
  const formData = await req.formData();

  const res = await fetch(`${BASE_URL}/api/v1/updates/upload`, {
    method: "POST",
    headers: { "x-api-key": API_KEY },
    body: formData as unknown as BodyInit,
  });

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
