import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { createClient } from "@supabase/supabase-js";

export const PAYMENT_KEYS = ["stripe_secret_key", "stripe_publishable_key", "stripe_webhook_secret"] as const;
export type PaymentKey = (typeof PAYMENT_KEYS)[number];
type PaymentConfiguration = Partial<Record<PaymentKey, string>>;

function encryptionKey() {
  const encoded = process.env.PAYMENT_CONFIG_ENCRYPTION_KEY;
  if (!encoded) throw new Error("PAYMENT_CONFIG_ENCRYPTION_KEY is not configured");
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) throw new Error("PAYMENT_CONFIG_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
  return key;
}

function encrypt(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv.toString("base64"), cipher.getAuthTag().toString("base64"), ciphertext.toString("base64")].join(".");
}

function decrypt(value: string) {
  const [ivValue, tagValue, ciphertextValue] = value.split(".");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextValue, "base64")), decipher.final()]).toString("utf8");
}

function adminClient() {
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRole) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function getPaymentConfigurationStatus() {
  const { data, error } = await adminClient().from("platform_settings").select("key").in("key", PAYMENT_KEYS);
  if (error) throw error;
  return Object.fromEntries(PAYMENT_KEYS.map((key) => [key, Boolean(data?.some((row) => row.key === key))]));
}

export async function savePaymentConfiguration(values: PaymentConfiguration, adminId: string) {
  const rows = PAYMENT_KEYS.flatMap((key) => values[key]?.trim() ? [{ key, encrypted_value: encrypt(values[key]!.trim()), updated_by: adminId }] : []);
  if (!rows.length) return;
  const { error } = await adminClient().from("platform_settings").upsert(rows, { onConflict: "key" });
  if (error) throw error;
}

// Checkout/webhook server routes call this at request time. Credentials never come from NEXT_PUBLIC_* variables.
export async function getStripeRuntimeConfiguration() {
  const { data, error } = await adminClient().from("platform_settings").select("key, encrypted_value").in("key", PAYMENT_KEYS);
  if (error) throw error;
  const values = Object.fromEntries((data ?? []).map((row) => [row.key, decrypt(row.encrypted_value)]));
  if (!values.stripe_secret_key || !values.stripe_webhook_secret) throw new Error("Stripe payment configuration is incomplete");
  return values as Required<PaymentConfiguration>;
}
