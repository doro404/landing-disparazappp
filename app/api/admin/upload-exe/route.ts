import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import fs from "fs";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
  }

  if (!file.name.endsWith(".exe")) {
    return NextResponse.json({ error: "Apenas arquivos .exe são permitidos" }, { status: 400 });
  }

  const MAX_SIZE = 500 * 1024 * 1024; // 500 MB
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Arquivo muito grande. Máximo 500 MB." }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const dir = path.join(process.cwd(), "public", "downloads");
  await mkdir(dir, { recursive: true });

  const filename = "DisparaZapp-Setup.exe";
  const filepath = path.join(dir, filename);
  await writeFile(filepath, buffer);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const fileUrl = `${appUrl}/downloads/${filename}`;

  // Update DOWNLOAD_FILE_URL in .env.local
  try {
    const envPath = path.join(process.cwd(), ".env.local");
    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";
    const line = `DOWNLOAD_FILE_URL=${fileUrl}`;
    if (envContent.includes("DOWNLOAD_FILE_URL=")) {
      envContent = envContent.replace(/DOWNLOAD_FILE_URL=.*/g, line);
    } else {
      envContent = envContent.trimEnd() + "\n" + line + "\n";
    }
    fs.writeFileSync(envPath, envContent, "utf-8");
  } catch {
    // non-fatal
  }

  return NextResponse.json({ success: true, url: fileUrl, name: filename, size: file.size });
}
