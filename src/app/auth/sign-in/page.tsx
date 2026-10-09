import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthLayout } from "@/components/auth/auth-layout";
import { signIn } from "../actions";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const suffix = next ? `?next=${encodeURIComponent(next)}` : "";
  return <AuthLayout title="Welcome back." intro="Sign in to resume saved events, offers, and bookings."><AuthForm action={signIn} submitLabel="Sign in" next={next} fields={[{ name: "identifier", label: "Email or username", autoComplete: "username" }, { name: "password", label: "Password", type: "password", autoComplete: "current-password" }]} footnote={<><Link href={`/auth/forgot-password${suffix}`}>Forgot password?</Link><span>New here? <Link href={`/auth/sign-up${suffix}`}>Create an account</Link></span></>} /></AuthLayout>;
}
