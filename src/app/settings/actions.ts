"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { publicAccountRoles, requireAccount } from "@/lib/account";
import { type FormState, formFields } from "@/lib/form-state";
import { countries, timezones } from "@/lib/regions";
import { createClient } from "@/lib/supabase/server";

const profileSchema = z.object({
  displayName: z.string().trim().min(2).max(80), avatarSeed: z.string().trim().min(2).max(30),
  avatarStyle: z.enum(["orbit", "arc", "spark"]), avatarColor: z.enum(["indigo", "periwinkle", "ocean", "plum"]),
  countryCode: z.string().refine((value) => countries.some(([code]) => code === value), "Choose a country"),
  city: z.string().trim().min(2).max(100), serviceRadius: z.coerce.number().int().min(1).max(2000),
  language: z.string().trim().min(2).max(50), timezone: z.string().refine((value) => timezones().includes(value), "Choose a named timezone"),
  currency: z.enum(["TUSD", "TGBP", "TAUD"]), headline: z.string().trim().max(120), bio: z.string().trim().max(1000),
  services: z.string().max(600), skills: z.string().max(600), pricingUnits: z.string().max(300), availability: z.string().max(300),
});

const list = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 20);

export async function saveSettings(_: FormState, formData: FormData): Promise<FormState> {
  const account = await requireAccount();
  const fields = formFields(formData);
  const parsed = profileSchema.safeParse(fields);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Review the highlighted settings.", fields };
  const supabase = await createClient();
  const selectedRoles = publicAccountRoles.filter((role) => formData.getAll("roles").includes(role));
  if (!selectedRoles.length) return { status: "error", message: "Keep at least one public account role.", fields };
  const { error: profileError } = await supabase.from("profiles").update({
    display_name: parsed.data.displayName, avatar_seed: parsed.data.avatarSeed, avatar_style: parsed.data.avatarStyle, avatar_color: parsed.data.avatarColor,
    country_code: parsed.data.countryCode, city: parsed.data.city, service_radius_km: parsed.data.serviceRadius,
    preferred_language: parsed.data.language, timezone: parsed.data.timezone, preferred_test_currency: parsed.data.currency,
  }).eq("id", account.userId);
  if (profileError) return { status: "error", message: "Profile changes could not be saved. Your previous values are still intact.", fields };
  for (const role of publicAccountRoles) {
    if (selectedRoles.includes(role)) {
      const { error } = await supabase.from("account_roles").insert({ user_id: account.userId, role });
      if (error && error.code !== "23505") return { status: "error", message: "Role settings could not be saved. Try again.", fields };
    } else {
      const { error } = await supabase.from("account_roles").delete().eq("user_id", account.userId).eq("role", role);
      if (error) return { status: "error", message: "Role settings could not be saved. Try again.", fields };
    }
  }
  if (selectedRoles.some((role) => role === "supplier" || role === "crew")) {
    const { error } = await supabase.from("provider_profiles").upsert({ user_id: account.userId, headline: parsed.data.headline, bio: parsed.data.bio, services: list(parsed.data.services), skills: list(parsed.data.skills), pricing_units: list(parsed.data.pricingUnits), availability_note: parsed.data.availability }, { onConflict: "user_id" });
    if (error) return { status: "error", message: "Your account settings saved, but the provider profile did not. Try again.", fields };
  }
  revalidatePath("/settings"); revalidatePath("/workspace", "layout");
  return { status: "success", message: "Profile and role settings saved.", fields };
}
