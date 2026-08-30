import type { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@supabase/ssr";
import { getPaymentConfigurationStatus, savePaymentConfiguration, type PaymentKey } from "../../../utils/payment-settings.server";

const allowedKeys: PaymentKey[] = ["stripe_secret_key", "stripe_publishable_key", "stripe_webhook_secret"];

function readCookies(request: NextApiRequest) {
  return Object.entries(request.cookies).map(([name, value]) => ({ name, value: value ?? "" }));
}

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: { getAll: () => readCookies(request), setAll: () => {} },
  });
  const { data: { claims } } = await supabase.auth.getClaims();
  if (!claims?.sub) return response.status(401).json({ error: "Sign in is required" });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", claims.sub).single();
  if (profile?.role !== "admin") return response.status(403).json({ error: "Admin access is required" });

  if (request.method === "GET") return response.status(200).json({ configured: await getPaymentConfigurationStatus() });
  if (request.method !== "PUT") return response.status(405).json({ error: "Method not allowed" });

  const values = Object.fromEntries(allowedKeys.map((key) => [key, typeof request.body?.[key] === "string" ? request.body[key] : ""]));
  await savePaymentConfiguration(values, claims.sub);
  return response.status(200).json({ configured: await getPaymentConfigurationStatus() });
}
