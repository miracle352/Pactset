import { RoleSignupPage } from "@/components/auth/role-signup-page";

export default async function OrganizerSignUp({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <RoleSignupPage signupRole="organizer" requestedNext={next} />;
}
