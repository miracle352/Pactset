import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthLayout } from "@/components/auth/auth-layout";
import { signIn } from "../actions";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <AuthLayout title="Welcome back." intro="Sign in to resume saved events, offers, and bookings."><AuthForm action={signIn} submitLabel="Sign in" next={next} fields={[{ name: "email", label: "Email", type: "email", autoComplete: "email" }, { name: "password", label: "Password", type: "password", autoComplete: "current-password" }]} footnote={<><Link href="/auth/forgot-password">Forgot password?</Link><span>New here? <Link href="/auth/sign-up">Create an account</Link></span></>} /></AuthLayout>;
}
