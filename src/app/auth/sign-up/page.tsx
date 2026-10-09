import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthLayout } from "@/components/auth/auth-layout";
import { signUp } from "../actions";

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ role?: string; next?: string }> }) {
  const { role, next } = await searchParams;
  const initialRole = ["organizer", "supplier", "crew"].includes(role ?? "") ? role : "organizer";
  return <AuthLayout title="Create your Pactset account." intro="Choose a starting role now. You can add organizer, supplier, or crew roles later."><AuthForm action={signUp} submitLabel="Create account" next={next} fields={[{ name: "displayName", label: "Display name", autoComplete: "name" }, { name: "email", label: "Email", type: "email", autoComplete: "email" }, { name: "password", label: "Password (10 characters minimum)", type: "password", autoComplete: "new-password" }, { name: "role", label: "Starting role", defaultValue: initialRole, options: [{ value: "organizer", label: "Organizer" }, { value: "supplier", label: "Supplier" }, { value: "crew", label: "Crew" }] }]} footnote={<span>Support access is assigned by Pactset. Already registered? <Link href={`/auth/sign-in${next ? `?next=${encodeURIComponent(next)}` : ""}`}>Sign in</Link></span>} /></AuthLayout>;
}
