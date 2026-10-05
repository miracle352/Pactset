import Link from "next/link";
import { BrandMark } from "@/components/brand/brand-mark";
import { SettingsForm } from "@/components/profile/settings-form";
import { ThemeControl } from "@/components/theme/theme-control";
import { requireAccount } from "@/lib/account";
import { countries, languages, testCurrencies, timezones } from "@/lib/regions";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const account = await requireAccount();
  const supabase = await createClient();
  const [{ data: profile }, { data: provider }] = await Promise.all([supabase.from("profiles").select("*").eq("id", account.userId).single(), supabase.from("provider_profiles").select("*").eq("user_id", account.userId).maybeSingle()]);
  return <main className="settings-page page-width"><header className="simple-header"><BrandMark /><ThemeControl /></header><div className="settings-heading"><Link className="back-link" href="/workspace">Back to workspace</Link><h1>Profile and settings</h1><p>Your Pactset account manages identity and bookings. A separately verified Stellar wallet authorizes Testnet transactions.</p></div><SettingsForm profile={profile ?? {}} provider={provider} roles={account.roles} countries={countries} languages={languages} timezones={timezones()} currencies={testCurrencies()} /></main>;
}
