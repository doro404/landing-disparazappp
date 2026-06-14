import { NextRequest, NextResponse } from "next/server";

const BASE_URL = process.env.NEXT_PUBLIC_LICENSE_API_URL ?? "https://license-manager.discloud.app";
const API_KEY  = process.env.ADMIN_API_KEY ?? "";

// Proxy all admin API calls server-side so ADMIN_API_KEY is never exposed to the browser
export async function POST(req: NextRequest) {
  const { path, method = "GET", body } = await req.json() as {
    path: string;
    method?: string;
    body?: unknown;
  };

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  return NextResponse.json(data, { status: res.status });
}
