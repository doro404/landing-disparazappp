import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { stripe } from "@/lib/stripe";

const checkoutSchema = z.object({
  plan: z.enum(["lifetime", "annual", "monthly"]),
});

const PRICE_IDS: Record<string, string | undefined> = {
  lifetime: process.env.STRIPE_PRICE_ID_LIFETIME,
  annual: process.env.STRIPE_PRICE_ID_ANNUAL,
  monthly: process.env.STRIPE_PRICE_ID_MONTHLY,
};

const PLAN_MODE: Record<string, "payment" | "subscription"> = {
  lifetime: "payment",
  annual: "subscription",
  monthly: "subscription",
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = checkoutSchema.safeParse(body);

    if (!parsed.success) {
      console.warn("[checkout] invalid input:", parsed.error.flatten());
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const { plan } = parsed.data;
    const priceId = PRICE_IDS[plan];

    if (!priceId) {
      console.error(`[checkout] missing price ID for plan: ${plan}`);
      return NextResponse.json({ error: "Plan not configured" }, { status: 500 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: PLAN_MODE[plan],
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { plan },
      success_url: `${appUrl}/obrigado?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/#pricing`,
      locale: "pt-BR",
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("[checkout] error:", message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
