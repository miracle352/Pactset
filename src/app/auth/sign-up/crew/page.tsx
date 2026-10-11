import { RoleSignupPage } from "@/components/auth/role-signup-page";

export default async function CrewSignUp({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <RoleSignupPage signupRole="crew" requestedNext={next} />;
}
