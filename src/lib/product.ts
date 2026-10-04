export const roles = ["organizer", "supplier", "crew", "support"] as const;
export type Role = (typeof roles)[number];

export const publicRoles = roles.filter((role) => role !== "support");

export const roleContent: Record<Role, {
  label: string;
  eyebrow: string;
  title: string;
  description: string;
  nav: string[];
  focus: string;
}> = {
  organizer: {
    label: "Organizer",
    eyebrow: "Readiness and decisions",
    title: "Keep every agreement moving toward one opening moment.",
    description: "Review blockers, approve changes, and see what needs your decision next.",
    nav: ["Overview", "Plan", "Team", "Agreements", "Messages"],
    focus: "Confirm venue access before the production walkthrough.",
  },
  supplier: {
    label: "Supplier",
    eyebrow: "Offers and availability",
    title: "Shape clear offers around the work you can deliver.",
    description: "Keep services, timing, and capacity visible before you accept new work.",
    nav: ["Requests", "Offers", "Services", "Calendar", "Messages"],
    focus: "Review the revised delivery window before responding.",
  },
  crew: {
    label: "Crew",
    eyebrow: "Shifts and evidence",
    title: "Know where to be, what is due, and what proves it is done.",
    description: "Follow shift timing, preparation notes, and milestone evidence in one place.",
    nav: ["Today", "Shifts", "Evidence", "Schedule", "Messages"],
    focus: "Sound check begins 24 minutes after venue access.",
  },
  support: {
    label: "Support",
    eyebrow: "Assigned cases and decisions",
    title: "See the full case without exceeding disclosed authority.",
    description: "Review agreements, evidence, and conversations for cases assigned to you.",
    nav: ["Queue", "Cases", "Decisions", "Audit", "Messages"],
    focus: "Two parties are waiting for a milestone evidence review.",
  },
};

export const currencies = [
  { code: "TUSD", name: "Test US Dollar" },
  { code: "TGBP", name: "Test British Pound" },
  { code: "TAUD", name: "Test Australian Dollar" },
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
