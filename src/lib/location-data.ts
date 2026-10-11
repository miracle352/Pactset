import "server-only";

import { Countries } from "countries-states-cities-service/countries";
import { States } from "countries-states-cities-service/states";

export type CountryOption = { code: string; name: string };
export type RegionOption = { code: string; name: string };
export type LocationPreferences = {
  country: CountryOption;
  regions: RegionOption[];
  timezones: string[];
  suggestedTestCurrency: string | null;
};

export function countryOptions(): CountryOption[] {
  return Countries.getCountries({ sort: { mode: "alphabetical", key: "name" } })
    .map((country) => ({ code: country.iso2, name: country.name }));
}

export function locationPreferences(countryCode: string): LocationPreferences | null {
  const normalized = countryCode.trim().toUpperCase();
  const country = Countries.getCountries({ filters: { iso2: normalized } })[0];
  if (!country) return null;
  const regions = States.getStates({ filters: { country_code: normalized }, sort: { mode: "alphabetical", key: "name" } })
    .map((region) => ({ code: region.state_code, name: region.name }));
  const timezones = [...new Set(country.timezones.map((timezone) => timezone.zoneName).filter(Boolean))];
  return {
    country: { code: country.iso2, name: country.name },
    regions,
    timezones,
    suggestedTestCurrency: /^[A-Z]{3}$/.test(country.currency) ? `T${country.currency}` : null,
  };
}

export function isValidRegion(countryCode: string, regionCode: string | null) {
  const preferences = locationPreferences(countryCode);
  if (!preferences) return false;
  if (!preferences.regions.length) return !regionCode;
  return Boolean(regionCode && preferences.regions.some((region) => region.code === regionCode));
}

export function isSuggestedTimezone(countryCode: string, timezone: string) {
  return locationPreferences(countryCode)?.timezones.includes(timezone) ?? false;
}
