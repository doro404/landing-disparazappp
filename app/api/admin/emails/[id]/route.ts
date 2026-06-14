import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, AUTH_VALUE } from "@/lib/adminAuth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookie = req.cookies.get(AUTH_COOKIE)?.value;
  if (cookie !== AUTH_VALUE) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ error: "RESEND_API_KEY não configurada" }, { status: 500 });
  }

  const { id } = await params;

  try {
    const res = await fetch(`https://api.resend.com/emails/${id}`, {
      headers: { Authorization: `Bearer ${resendKey}` },
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: text }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
