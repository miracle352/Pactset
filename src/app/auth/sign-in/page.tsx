import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthLayout } from "@/components/auth/auth-layout";
import { signIn } from "../actions";

const messages: Record<string, string> = {
  "invalid-confirmation": "This email link is incomplete. Request a fresh confirmation or password-reset email.",
  "expired-confirmation": "This email link is invalid, expired, or already used. Request a fresh link before trying again.",
  "signed-out": "You are signed out. Private Pactset routes now require a new sign-in.",
};

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; notice?: string }> }) {
  const { next, error, notice } = await searchParams;
  const suffix = next ? `?next=${encodeURIComponent(next)}` : "";
  const status = error ? messages[error] : notice ? messages[notice] : null;
  return <AuthLayout title="Welcome back." intro={status ?? "Sign in to resume saved events, offers, and bookings."}><AuthForm action={signIn} submitLabel="Sign in" next={next} fields={[{ name: "identifier", label: "Email or username", autoComplete: "username" }, { name: "password", label: "Password", type: "password", autoComplete: "current-password" }]} footnote={<><Link href={`/auth/forgot-password${suffix}`}>Forgot password?</Link><span>New here? <Link href={`/auth/sign-up${suffix}`}>Create an account</Link></span></>} /></AuthLayout>;
}
