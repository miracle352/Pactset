"use client";

import { CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { useActionState, useMemo, useRef, useState } from "react";
import { saveSettings } from "@/app/settings/actions";
import type { AccountRole } from "@/lib/account";
import { initialFormState } from "@/lib/form-state";
import type { CountryOption, LocationPreferences } from "@/lib/location-data";
import type { TestCurrency } from "@/lib/regions";
import { PactsetAvatar } from "./pactset-avatar";

type Props = {
  profile: Record<string, unknown>;
  provider: Record<string, unknown> | null;
  roles: AccountRole[];
  countries: CountryOption[];
  initialLocation: LocationPreferences | null;
  languages: readonly string[];
  timezones: string[];
  currencies: TestCurrency[];
};

export function SettingsForm({ profile, provider, roles, countries, initialLocation, languages, timezones, currencies }: Props) {
  const [state, action, pending] = useActionState(saveSettings, initialFormState);
  const [avatarSeed, setAvatarSeed] = useState(String(profile.avatar_seed ?? "opal"));
  const [avatarStyle, setAvatarStyle] = useState(String(profile.avatar_style ?? "orbit"));
  const [avatarColor, setAvatarColor] = useState(String(profile.avatar_color ?? "indigo"));
  const [countryCode, setCountryCode] = useState(String(profile.country_code ?? ""));
  const [regionCode, setRegionCode] = useState(String(profile.region_code ?? ""));
  const [location, setLocation] = useState<LocationPreferences | null>(initialLocation);
  const [locationStatus, setLocationStatus] = useState<"idle" | "loading" | "error">("idle");
  const [timezone, setTimezone] = useState(String(profile.timezone ?? "UTC"));
  const [currency, setCurrency] = useState(String(profile.preferred_test_currency ?? "TUSD"));
  const previousSuggestion = useRef(initialLocation?.suggestedTestCurrency ?? "");
  const displayName = String(profile.display_name ?? "");
  const storedLanguage = String(profile.preferred_language ?? "English");
  const languageValue = storedLanguage === "en" ? "English" : storedLanguage;
  const currencyLabels = useMemo(() => new Map(currencies.map((item) => [item.assetCode, item.label])), [currencies]);

  async function changeCountry(nextCountry: string) {
    setCountryCode(nextCountry);
    setRegionCode("");
    if (!nextCountry) {
      setLocation(null);
      setLocationStatus("idle");
      return;
    }
    setLocationStatus("loading");
    try {
      const response = await fetch(`/api/locations/preferences?country=${encodeURIComponent(nextCountry)}`);
      if (!response.ok) throw new Error("location lookup failed");
      const next = await response.json() as LocationPreferences;
      setLocation(next);
      if (next.timezones.length === 1) setTimezone(next.timezones[0]);
      else if (next.timezones.length > 1 && !next.timezones.includes(timezone)) setTimezone("");
      if (next.suggestedTestCurrency && (!currency || currency === previousSuggestion.current)) setCurrency(next.suggestedTestCurrency);
      previousSuggestion.current = next.suggestedTestCurrency ?? "";
      setLocationStatus("idle");
    } catch {
      setLocation(null);
      setLocationStatus("error");
    }
  }

  const timezoneSuggestions = location?.timezones.length ? location.timezones : timezones;
  return <form action={action} className="settings-form">
    <section className="settings-section glass-panel">
      <div className="settings-title"><div><p className="kicker">Profile</p><h2>Identity and avatar</h2><p className="field-note">Only your username and at least one role are needed for workspace access. Complete the rest when it becomes useful.</p></div><PactsetAvatar size="large" label={displayName || "Pactset member"} seed={avatarSeed} style={avatarStyle} color={avatarColor} /></div>
      <div className="form-grid"><label>Display or business name <span className="optional-label">Optional</span><input name="displayName" defaultValue={displayName} autoComplete="name" /></label><label>Avatar name<input name="avatarSeed" value={avatarSeed} onChange={(event) => setAvatarSeed(event.target.value)} required /></label><label>Avatar shape<select name="avatarStyle" value={avatarStyle} onChange={(event) => setAvatarStyle(event.target.value)}><option value="orbit">Orbit</option><option value="arc">Arc</option><option value="spark">Spark</option></select></label><label>Avatar color<select name="avatarColor" value={avatarColor} onChange={(event) => setAvatarColor(event.target.value)}><option value="indigo">Indigo</option><option value="periwinkle">Periwinkle</option><option value="ocean">Ocean</option><option value="plum">Plum</option></select></label></div>
    </section>
    <section className="settings-section glass-panel"><p className="kicker">Roles</p><h2>Ways you work</h2><div className="role-checks">{(["organizer", "supplier", "crew"] as const).map((role) => <label key={role}><input type="checkbox" name="roles" value={role} defaultChecked={roles.includes(role)} />{role}</label>)}</div><p className="field-note">Choose at least one role. Support access is assigned separately and cannot be added here.</p></section>
    <section className="settings-section glass-panel">
      <div className="settings-section-heading"><div><p className="kicker">Regional preferences</p><h2>Location, time, and currency</h2></div><p>These preferences help Pactset suggest useful defaults. They never rewrite an existing agreement, deadline, or wallet binding.</p></div>
      <div className="form-grid">
        <label>Country <span className="optional-label">Optional</span><select name="countryCode" value={countryCode} onChange={(event) => void changeCountry(event.target.value)}><option value="">Choose later</option>{countries.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}</select></label>
        <label>State or region <span className="optional-label">Optional</span><select name="regionCode" value={regionCode} onChange={(event) => setRegionCode(event.target.value)} disabled={!location?.regions.length || locationStatus === "loading"}><option value="">{locationStatus === "loading" ? "Loading regions…" : location?.regions.length ? "Choose a region" : "No subdivision needed"}</option>{location?.regions.map((region) => <option key={`${region.code}-${region.name}`} value={region.code}>{region.name}</option>)}</select></label>
        <label>City or service area <span className="optional-label">Optional</span><input name="city" defaultValue={String(profile.city ?? "")} autoComplete="address-level2" /></label>
        <label>Service radius (km) <span className="optional-label">Optional</span><input name="serviceRadius" type="number" min="1" max="2000" defaultValue={profile.service_radius_km == null ? "" : String(profile.service_radius_km)} inputMode="numeric" /></label>
        <label>Preferred language<select name="language" defaultValue={languageValue} required>{languages.map((language) => <option key={language} value={language}>{language}</option>)}</select></label>
        <label>Named timezone<input name="timezone" list="timezone-options" value={timezone} onChange={(event) => setTimezone(event.target.value)} placeholder={location?.timezones.length && location.timezones.length > 1 ? "Choose the correct timezone" : "Type a named timezone"} required /><datalist id="timezone-options">{timezoneSuggestions.map((item) => <option key={item} value={item} />)}</datalist>{location?.timezones.length && location.timezones.length > 1 ? <span className="input-help">This country has several timezones. Choose the one that applies to you.</span> : null}</label>
        <label>Preferred test currency<input name="currency" list="currency-options" value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} required /><datalist id="currency-options">{currencies.map((item) => <option key={item.assetCode} value={item.assetCode}>{item.label}</option>)}</datalist><span className="input-help">{currencyLabels.get(currency) ?? "Choose any listed planning currency."}</span></label>
      </div>
      {locationStatus === "error" && <p className="form-message error" role="alert"><WarningCircle aria-hidden="true" />Regional suggestions could not be loaded. Your saved values have not changed.</p>}
      <p className="testnet-note">Every T-prefixed currency is a planning label for Stellar Testnet and has no monetary value. Selection does not mean its asset or conversion liquidity is provisioned.</p>
    </section>
    <section id="provider" className="settings-section glass-panel"><p className="kicker">Provider profile</p><h2>Services, skills, and availability</h2><p className="field-note">Optional until you publish services, submit an offer, or accept work.</p><div className="form-grid"><label>Profile headline<input name="headline" defaultValue={String(provider?.headline ?? "")} /></label><label>Pricing units<input name="pricingUnits" defaultValue={Array.isArray(provider?.pricing_units) ? provider.pricing_units.join(", ") : ""} placeholder="per hour, per item" /></label><label className="wide">Services (comma separated)<input name="services" defaultValue={Array.isArray(provider?.services) ? provider.services.join(", ") : ""} /></label><label className="wide">Skills (comma separated)<input name="skills" defaultValue={Array.isArray(provider?.skills) ? provider.skills.join(", ") : ""} /></label><label className="wide">Availability note<input name="availability" defaultValue={String(provider?.availability_note ?? "")} /></label><label className="wide">About your work<textarea name="bio" defaultValue={String(provider?.bio ?? "")} rows={4} /></label><label className="wide">Portfolio visibility<select name="portfolioVisibility" defaultValue={String(provider?.portfolio_visibility ?? "private")}><option value="private">Private — only you can preview it</option><option value="public">Public — approved details are visible by link</option></select></label></div><p className="field-note">Public portfolios exclude offers, messages, declines, sensitive finances, and unresolved disputes.</p></section>
    {state.message && <p className={`form-message sticky-message ${state.status}`} role={state.status === "error" ? "alert" : "status"}>{state.status === "error" ? <WarningCircle aria-hidden="true" /> : <CheckCircle aria-hidden="true" />}{state.message}</p>}
    <button type="submit" className="button button-primary settings-save" disabled={pending} aria-busy={pending}>{pending ? "Saving…" : "Save changes"}</button>
  </form>;
}
