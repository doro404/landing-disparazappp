import { NextRequest, NextResponse } from "next/server";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";

export async function POST(req: NextRequest) {
  const { password } = await req.json() as { password: string };

  if (!password || password !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Senha incorreta" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  // Cookie HttpOnly — não acessível via JS, validado pelo middleware
  res.cookies.set("admin_session", ADMIN_PASSWORD, {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 8, // 8h
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete("admin_session");
  return res;
}
