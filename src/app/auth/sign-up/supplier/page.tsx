import { RoleSignupPage } from "@/components/auth/role-signup-page";

export default async function SupplierSignUp({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <RoleSignupPage signupRole="supplier" requestedNext={next} />;
}
