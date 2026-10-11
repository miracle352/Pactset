const allowedPrefixes = ["/workspace", "/settings", "/onboarding", "/auth"];

export function safeInternalPath(value: string | null | undefined, fallback = "/workspace") {
  if (!value?.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  try {
    const url = new URL(value, "https://pactset.local");
    if (url.origin !== "https://pactset.local" || !allowedPrefixes.some((prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`))) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
