import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, AUTH_VALUE } from "@/lib/adminAuth";

export async function GET(req: NextRequest) {
  // Validate admin session cookie
  const cookie = req.cookies.get(AUTH_COOKIE)?.value;
  if (cookie !== AUTH_VALUE) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ error: "RESEND_API_KEY não configurada" }, { status: 500 });
  }

  try {
    const res = await fetch("https://api.resend.com/emails?limit=50", {
      headers: { Authorization: `Bearer ${resendKey}` },
    });

    if (!res.ok) {
      const text = await res.text();
      let parsed: { name?: string } = {};
      try { parsed = JSON.parse(text); } catch { /* ignore */ }
      if (parsed.name === "restricted_api_key") {
        return NextResponse.json({
          error: "restricted_api_key",
        }, { status: 403 });
      }
      return NextResponse.json({ error: `Resend API: ${text}` }, { status: res.status });
    }

    const data = await res.json() as { data: unknown[] };
    return NextResponse.json({ success: true, data: data.data ?? [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
