import { AuthForm } from "@/components/auth/auth-form";
import { AuthLayout } from "@/components/auth/auth-layout";
import { requestPasswordReset } from "../actions";
import Link from "next/link";

export default function ForgotPasswordPage() { return <AuthLayout boundary="recovery" title="Reset your password." intro="We will send a time-limited recovery link if the address belongs to an account."><AuthForm action={requestPasswordReset} submitLabel="Send recovery link" fields={[{ name: "email", label: "Email", type: "email", autoComplete: "email" }]} footnote={<><span>For privacy, the response is the same whether or not an account exists.</span><Link href="/auth/sign-in">Return to sign in</Link></>} /></AuthLayout>; }
