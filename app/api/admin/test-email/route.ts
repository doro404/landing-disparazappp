import { NextRequest, NextResponse } from "next/server";
import { sendLicenseEmail } from "@/lib/resend";

export async function POST(req: NextRequest) {
  const adminKey = req.headers.get("x-admin-key");
  if (adminKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { to } = await req.json() as { to: string };
    if (!to || !to.includes("@")) {
      return NextResponse.json({ error: "E-mail inválido" }, { status: 400 });
    }

    await sendLicenseEmail({
      to,
      licenseKey: "DZAPP-TEST-0000-0000-0000",
      plan: "lifetime",
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao enviar";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
