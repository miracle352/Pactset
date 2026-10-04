import { AuthForm } from "@/components/auth/auth-form";
import { AuthLayout } from "@/components/auth/auth-layout";
import { updatePassword } from "../actions";

export default function UpdatePasswordPage() { return <AuthLayout title="Choose a new password." intro="This changes account access only. It does not create or connect a wallet."><AuthForm action={updatePassword} submitLabel="Update password" fields={[{ name: "password", label: "New password", type: "password", autoComplete: "new-password" }, { name: "confirmPassword", label: "Confirm new password", type: "password", autoComplete: "new-password" }]} /></AuthLayout>; }
