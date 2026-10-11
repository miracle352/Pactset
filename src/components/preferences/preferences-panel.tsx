"use client";

import { CheckCircle, GlobeHemisphereWest, Info, WarningCircle } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { testCurrencies } from "@/lib/regions";

type Preferences = { serviceArea: string; language: string; timezone: string; currency: string };
const defaults: Preferences = { serviceArea: "West Africa", language: "English", timezone: "Africa/Lagos", currency: "TUSD" };
const key = "pactset-preferences-v1";
const currencies = testCurrencies();

export function PreferencesPanel({ compact = false }: { compact?: boolean }) {
  const [preferences, setPreferences] = useState(defaults);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let sync: number | undefined;
    try {
      const stored = localStorage.getItem(key);
      if (stored) sync = window.setTimeout(() => setPreferences({ ...defaults, ...JSON.parse(stored) }), 0);
    } catch {
      localStorage.removeItem(key);
    }
    return () => {
      if (sync) window.clearTimeout(sync);
    };
  }, []);

  function update(field: keyof Preferences, value: string) {
    const next = { ...preferences, [field]: value };
    setPreferences(next);
    localStorage.setItem(key, JSON.stringify(next));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  }

  return (
    <section className={`preferences glass-panel ${compact ? "preferences-compact" : ""}`} aria-labelledby="preferences-title">
      <div className="section-heading">
        <span className="section-icon"><GlobeHemisphereWest size={18} /></span>
        <div>
          <p className="kicker">Regional preferences</p>
          <h2 id="preferences-title">Your working context</h2>
        </div>
        <span className={`save-state ${saved ? "is-visible" : ""}`} role="status"><CheckCircle size={15} /> Saved on this device</span>
      </div>
      <div className="preference-grid">
        <label>Service area
          <select value={preferences.serviceArea} onChange={(event) => update("serviceArea", event.target.value)}>
            <option>West Africa</option><option>Southern Africa</option><option>United Kingdom</option><option>Australia & New Zealand</option><option>Global / remote</option>
          </select>
        </label>
        <label>Language
          <select value={preferences.language} onChange={(event) => update("language", event.target.value)}>
            <option>English</option><option>French</option><option>Portuguese</option><option>Spanish</option>
          </select>
        </label>
        <label>Named timezone
          <select value={preferences.timezone} onChange={(event) => update("timezone", event.target.value)}>
            <option>Africa/Lagos</option><option>Europe/London</option><option>America/New_York</option><option>Australia/Sydney</option>
          </select>
        </label>
        <label>Preferred test currency
          <select value={preferences.currency} onChange={(event) => update("currency", event.target.value)}>
            {currencies.map((currency) => <option key={currency.assetCode} value={currency.assetCode}>{currency.label}</option>)}
          </select>
        </label>
      </div>
      <p className="preference-note"><Info size={17} /> These settings are independent. Changing your preferred currency never changes the settlement currency of an existing agreement.</p>
      <p className="testnet-note"><WarningCircle size={17} /> T-prefixed choices are Pactset Testnet labels with no monetary value. A planning choice does not provision a Stellar asset or conversion path.</p>
    </section>
  );
}
