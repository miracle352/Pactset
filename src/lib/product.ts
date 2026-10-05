export const roles = ["organizer", "supplier", "crew", "support"] as const;
export type Role = (typeof roles)[number];

export const publicRoles = roles.filter((role) => role !== "support");

export const roleContent: Record<Role, {
  label: string;
  eyebrow: string;
  title: string;
  description: string;
  focus: string;
}> = {
  organizer: {
    label: "Organizer",
    eyebrow: "Readiness and decisions",
    title: "Organizer overview",
    description: "Explore sample events, requests, offers, and accepted unfunded agreements.",
    focus: "Confirm venue access before the production walkthrough.",
  },
  supplier: {
    label: "Supplier",
    eyebrow: "Offers and availability",
    title: "Supplier overview",
    description: "Explore sample inventory, relevant requests, offers, and accepted bookings.",
    focus: "Review the revised delivery window before responding.",
  },
  crew: {
    label: "Crew",
    eyebrow: "Shifts and evidence",
    title: "Crew overview",
    description: "Explore sample opportunities, accepted jobs, schedule, and preparation timing.",
    focus: "Sound check begins 24 minutes after venue access.",
  },
  support: {
    label: "Support",
    eyebrow: "Assigned cases and decisions",
    title: "Support access boundary",
    description: "Support is server-assigned. This public demo contains no private cases or privileged tools.",
    focus: "Two parties are waiting for a milestone evidence review.",
  },
};

export const currencies = [
  { code: "TUSD", name: "Test US Dollar" },
  { code: "TGBP", name: "Test British Pound" },
  { code: "TAUD", name: "Test Australian Dollar" },
  { code: "TNGN", name: "Test Nigerian Naira" },
  { code: "TEUR", name: "Test Euro" },
] as const;

export const demoEvent = {
  name: "Harborlight Forum",
  location: "Fictional venue · Valletta",
  date: "18 October 2026",
  attendees: 180,
  currency: "TGBP",
  team: [
    { name: "Mara Okafor", role: "Organizer", initials: "MO" },
    { name: "Northstar Pavilion Co.", role: "Supplier · fictional", initials: "NP" },
    { name: "Ivo Chen", role: "Crew · fictional", initials: "IC" },
    { name: "Sana Bell", role: "Crew · fictional", initials: "SB" },
  ],
};
