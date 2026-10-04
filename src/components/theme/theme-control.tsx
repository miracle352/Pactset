"use client";

import { Desktop, Moon, Sun } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

type ThemePreference = "light" | "dark" | "system";
const storageKey = "pactset-theme-v1";

function applyTheme(preference: ThemePreference) {
  const dark = preference === "dark" || (preference === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.dataset.themePreference = preference;
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

export function ThemeControl() {
  const [theme, setTheme] = useState<ThemePreference>("system");

  useEffect(() => {
    const saved = localStorage.getItem(storageKey) as ThemePreference | null;
    const current = saved && ["light", "dark", "system"].includes(saved) ? saved : "system";
    const sync = window.setTimeout(() => setTheme(current), 0);
    applyTheme(current);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => current === "system" && applyTheme("system");
    media.addEventListener("change", onChange);
    return () => {
      window.clearTimeout(sync);
      media.removeEventListener("change", onChange);
    };
  }, []);

  function choose(next: ThemePreference) {
    setTheme(next);
    localStorage.setItem(storageKey, next);
    applyTheme(next);
  }

  return (
    <fieldset className="theme-control" aria-label="Appearance">
      {([
        ["light", "Light", Sun],
        ["dark", "Dark", Moon],
        ["system", "System", Desktop],
      ] as const).map(([value, label, Icon]) => (
        <button
          key={value}
          type="button"
          aria-label={`${label} theme`}
          aria-pressed={theme === value}
          className="theme-option"
          onClick={() => choose(value)}
          title={label}
        >
          <Icon size={16} weight="regular" />
          <span>{label}</span>
        </button>
      ))}
    </fieldset>
  );
}
