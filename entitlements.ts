export type KnotProfile = { role: "admin" | "user"; subscription_tier: "free" | "weekly" | "paid_monthly"; subscription_expires_at: string | null };
export const isAdmin = (profile: KnotProfile | null) => profile?.role === "admin";
// Use in trusted server routes after loading the authenticated user's profile.
export const canBypassFreemiumLimits = (profile: KnotProfile | null) => isAdmin(profile);
export function canUsePaidFeatures(profile: KnotProfile | null) {
  if (isAdmin(profile)) return true;
  return Boolean(profile && profile.subscription_tier !== "free" && (!profile.subscription_expires_at || new Date(profile.subscription_expires_at) > new Date()));
}
