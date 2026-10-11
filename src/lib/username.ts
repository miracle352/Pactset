export const usernamePattern = /^[a-z0-9][a-z0-9_]{2,29}$/;

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function usernameValidationMessage(value: string) {
  const normalized = normalizeUsername(value);
  if (normalized.length < 3) return "Use at least 3 characters.";
  if (normalized.length > 30) return "Use no more than 30 characters.";
  if (!/^[a-z0-9]/.test(normalized)) return "Start with a letter or number.";
  if (!usernamePattern.test(normalized)) return "Use only lowercase letters, numbers, and underscores.";
  return null;
}
