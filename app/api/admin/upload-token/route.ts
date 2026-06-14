import { NextResponse } from "next/server";

const BASE_URL = process.env.NEXT_PUBLIC_LICENSE_API_URL ?? "https://license-manager.discloud.app";
const API_KEY = process.env.ADMIN_API_KEY ?? "";

export async function POST() {
  try {
    const res = await fetch(`${BASE_URL}/api/v1/updates/upload-token`, {
      method: "POST",
      headers: { "x-api-key": API_KEY },
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha desconhecida";
    return NextResponse.json(
      { success: false, error: `Falha ao gerar token de upload: ${message}` },
      { status: 502 },
    );
  }
}
