import { AuthForm } from "@/components/auth/auth-form";
import { AuthLayout } from "@/components/auth/auth-layout";
import { requestPasswordReset } from "../actions";

export default function ForgotPasswordPage() { return <AuthLayout title="Reset your password." intro="We will send a time-limited recovery link if the address belongs to an account."><AuthForm action={requestPasswordReset} submitLabel="Send recovery link" fields={[{ name: "email", label: "Email", type: "email", autoComplete: "email" }]} /></AuthLayout>; }
