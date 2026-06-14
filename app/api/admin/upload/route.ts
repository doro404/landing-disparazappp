import { NextRequest, NextResponse } from "next/server";

const BASE_URL = process.env.NEXT_PUBLIC_LICENSE_API_URL ?? "https://license-manager.discloud.app";
const API_KEY = process.env.ADMIN_API_KEY ?? "";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const res = await fetch(`${BASE_URL}/api/v1/updates/upload`, {
      method: "POST",
      headers: { "x-api-key": API_KEY },
      body: formData as unknown as BodyInit,
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha desconhecida no upload";

    return NextResponse.json(
      {
        success: false,
        error: `Falha ao enviar para o License Manager (${BASE_URL}): ${message}`,
      },
      { status: 502 },
    );
  }
}
