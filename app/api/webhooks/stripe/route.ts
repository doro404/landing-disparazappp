import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { sendLicenseEmail } from "@/lib/resend";
import Stripe from "stripe";

// Raw body required for Stripe signature verification
export const dynamic = "force-dynamic";

async function createLicense(
  plan: string,
  customerEmail?: string,
  customerName?: string,
  orderId?: string
): Promise<string> {
  const apiUrl = process.env.NEXT_PUBLIC_LICENSE_API_URL ?? "https://license-manager.discloud.app";
  const res = await fetch(`${apiUrl}/api/v1/licenses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ADMIN_API_KEY!,
    },
    body: JSON.stringify({
      productSlug: "dispara-zapp",
      maxMachines: 1,
      entitlements: [plan === "lifetime" ? "lifetime" : "annual"],
      customerEmail,
      customerName,
      orderId,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`License creation failed: ${text}`);
  }

  const data = await res.json() as { data: { key: string } };
  return data.data.key;
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Webhook error";
    console.error("[webhook] signature verification failed:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const email = session.customer_details?.email ?? session.customer_email ?? undefined;
    const name = session.customer_details?.name ?? undefined;
    const plan = (session.metadata?.plan ?? "lifetime") as string;
    const orderId = session.id; // Stripe session ID como orderId

    console.log(`[webhook] checkout.session.completed — email: ${email}, plan: ${plan}, order: ${orderId}`);

    try {
      const licenseKey = await createLicense(plan, email, name, orderId);
      console.log(`[webhook] license created: ${licenseKey}`);

      if (email) {
        await sendLicenseEmail({ to: email, licenseKey, plan });
        console.log(`[webhook] email sent to ${email}`);
      }
    } catch (err) {
      console.error("[webhook] post-payment processing error:", err);
    }
  }

  return NextResponse.json({ received: true });
}
