import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { SettingsForm } from "@/components/profile/settings-form";
import { UsernameForm } from "@/components/profile/username-form";
import { preferredWorkspaceRole, requireAccount } from "@/lib/account";
import { countryOptions, locationPreferences } from "@/lib/location-data";
import { languages, testCurrencies, timezones } from "@/lib/regions";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const account = await requireAccount(undefined, "/settings");
  const workspaceRole = await preferredWorkspaceRole(account);
  const supabase = await createClient();
  const [{ data: profile }, { data: provider }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", account.userId).single(),
    supabase.from("provider_profiles").select("*").eq("user_id", account.userId).maybeSingle(),
  ]);
  const workspaceHref = workspaceRole ? `/workspace/${workspaceRole}` : "/workspace";
  const currentCountry = typeof profile?.country_code === "string" ? profile.country_code : "";
  const location = currentCountry ? locationPreferences(currentCountry) : null;
  return <main className="settings-page">
    <Link className="back-link settings-back" href={workspaceHref}><ArrowLeft size={15} aria-hidden="true" /> Back to {workspaceRole ? `${workspaceRole} workspace` : "workspace"}</Link>
    <div className="settings-heading"><h1>Profile and settings</h1><p>Your Pactset account manages identity and bookings. A separately verified Stellar wallet authorizes Testnet transactions.</p></div>
    <UsernameForm username={typeof profile?.username === "string" ? profile.username : null} workspaceHref={workspaceHref} />
    <SettingsForm profile={profile ?? {}} provider={provider} roles={account.roles} countries={countryOptions()} initialLocation={location} languages={languages} timezones={timezones()} currencies={testCurrencies()} />
  </main>;
}
