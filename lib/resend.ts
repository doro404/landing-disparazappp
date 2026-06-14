import "server-only";
import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY!);

function buildEmailHtml(licenseKey: string, planLabel: string, downloadUrl: string, year: number): string {
  const steps: [string, string][] = [
    ["Baixe e instale o DisparaZapp", "Clique no botão acima para baixar o instalador"],
    ["Abra o aplicativo", "Execute o DisparaZapp no seu Windows"],
    ['Clique em "Ativar Licença"', "Encontre a opção na tela inicial do app"],
    ["Cole sua chave e pronto", "Copie a chave acima e ative com um clique"],
  ];

  const stepsHtml = steps.map(([title, desc], i) => `
    <tr>
      <td style="padding-bottom:14px;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
          <td style="width:32px;vertical-align:top;padding-top:1px;">
            <span style="display:inline-block;width:24px;height:24px;background-color:rgba(37,211,102,0.15);border:1px solid rgba(37,211,102,0.3);border-radius:50%;text-align:center;line-height:24px;font-size:11px;font-weight:800;color:#25D366;">${i + 1}</span>
          </td>
          <td style="padding-left:10px;vertical-align:top;">
            <p style="margin:0 0 2px;font-size:13px;font-weight:700;color:#ffffff;">${title}</p>
            <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.35);line-height:1.4;">${desc}</p>
          </td>
        </tr></table>
      </td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>Sua licenca DisparaZapp</title></head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0a0a;padding:40px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:500px;">

  <!-- HEADER -->
  <tr><td align="center" style="padding-bottom:32px;">
    <table cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="background-color:#25D366;border-radius:14px;width:44px;height:44px;text-align:center;vertical-align:middle;">
        <span style="font-size:22px;font-weight:900;color:#000;line-height:44px;">Z</span>
      </td>
      <td style="padding-left:10px;vertical-align:middle;">
        <span style="font-size:22px;font-weight:900;color:#ffffff;">Dispara</span><span style="font-size:22px;font-weight:900;color:#25D366;">Zapp</span>
      </td>
    </tr></table>
  </td></tr>

  <!-- MAIN CARD -->
  <tr><td style="background-color:#111111;border-radius:20px;border:1px solid rgba(255,255,255,0.07);padding:40px 36px;box-shadow:0 24px 64px rgba(0,0,0,0.6);">

    <!-- Badge -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
    <tr><td align="center">
      <span style="display:inline-block;background-color:rgba(37,211,102,0.12);border:1px solid rgba(37,211,102,0.3);border-radius:100px;padding:6px 16px;font-size:12px;font-weight:700;color:#25D366;letter-spacing:0.05em;text-transform:uppercase;">
        Pagamento Confirmado
      </span>
    </td></tr></table>

    <!-- Title -->
    <h1 style="margin:0 0 8px;font-size:28px;font-weight:900;color:#ffffff;text-align:center;letter-spacing:-0.5px;line-height:1.2;">Compra Confirmada!</h1>
    <p style="margin:0 0 32px;font-size:15px;color:rgba(255,255,255,0.45);text-align:center;line-height:1.5;">
      Seu plano <strong style="color:rgba(255,255,255,0.7);">${planLabel}</strong> foi ativado com sucesso.<br/>
      Guarde sua chave &mdash; ela e unica e intransferivel.
    </p>

    <!-- License key -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
    <tr><td>
      <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:rgba(255,255,255,0.35);text-transform:uppercase;letter-spacing:0.1em;">Sua chave de licenca</p>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0d0d0d;border:1.5px solid rgba(37,211,102,0.4);border-radius:12px;box-shadow:0 0 24px rgba(37,211,102,0.08);">
        <tr><td style="padding:18px 20px;">
          <p style="margin:0;font-family:'Courier New',Courier,monospace;font-size:15px;font-weight:700;color:#25D366;word-break:break-all;letter-spacing:0.04em;line-height:1.5;">${licenseKey}</p>
        </td></tr>
        <tr><td style="border-top:1px solid rgba(255,255,255,0.05);padding:10px 20px;background-color:rgba(37,211,102,0.04);border-radius:0 0 10px 10px;">
          <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.25);">Copie e guarde em local seguro</p>
        </td></tr>
      </table>
    </td></tr></table>

    <!-- CTA -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:36px;">
    <tr><td align="center">
      <a href="${downloadUrl}" style="display:block;background-color:#25D366;color:#000000;font-size:15px;font-weight:800;text-decoration:none;text-align:center;padding:16px 32px;border-radius:12px;box-shadow:0 4px 24px rgba(37,211,102,0.35);">
        Baixar DisparaZapp
      </a>
    </td></tr></table>

    <!-- Divider -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
    <tr><td style="border-top:1px solid rgba(255,255,255,0.06);font-size:0;">&nbsp;</td></tr></table>

    <!-- Steps -->
    <p style="margin:0 0 16px;font-size:13px;font-weight:700;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:0.06em;">Como ativar em 4 passos</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0">${stepsHtml}</table>

    <!-- Divider -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0;">
    <tr><td style="border-top:1px solid rgba(255,255,255,0.06);font-size:0;">&nbsp;</td></tr></table>

    <!-- Support -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td align="center">
      <p style="margin:0 0 14px;font-size:13px;color:rgba(255,255,255,0.4);text-align:center;">Precisa de ajuda? Nossa equipe esta pronta para te atender.</p>
      <a href="https://wa.me/5500000000000" style="display:inline-block;background-color:transparent;border:1.5px solid rgba(37,211,102,0.35);color:#25D366;font-size:13px;font-weight:700;text-decoration:none;padding:11px 28px;border-radius:10px;">
        Falar no WhatsApp
      </a>
    </td></tr></table>

  </td></tr>

  <!-- FOOTER -->
  <tr><td align="center" style="padding-top:28px;">
    <p style="margin:0 0 6px;font-size:11px;color:rgba(255,255,255,0.18);text-align:center;">
      &copy; ${year} DisparaZapp. Todos os direitos reservados.
    </p>
    <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.12);text-align:center;">
      Voce recebeu este e-mail porque realizou uma compra em nosso site.
    </p>
  </td></tr>

</table>
</td></tr></table>
</body>
</html>`;
}

export async function sendLicenseEmail({
  to,
  licenseKey,
  plan,
}: {
  to: string;
  licenseKey: string;
  plan: string;
}) {
  const appUrl      = process.env.NEXT_PUBLIC_APP_URL ?? "https://yourdomain.com";
  const downloadUrl = `${appUrl}/api/download?license=${licenseKey}`;
  const planLabel   = plan === "lifetime" ? "Vitalicio" : "Anual";
  const year        = new Date().getFullYear();

  await resend.emails.send({
    from: process.env.RESEND_FROM ?? "DisparaZapp <noreply@yourdomain.com>",
    to,
    subject: "Sua licenca DisparaZapp esta pronta - ative agora",
    html: buildEmailHtml(licenseKey, planLabel, downloadUrl, year),
  });
}
