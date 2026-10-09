import { AuthForm } from "@/components/auth/auth-form";
import { AuthLayout } from "@/components/auth/auth-layout";
import { updatePassword } from "../actions";

export default function UpdatePasswordPage() { return <AuthLayout boundary="recovery" title="Choose a new password." intro="Open this page from the newest recovery email. An expired, invalid, or already-used link cannot change your password."><AuthForm action={updatePassword} submitLabel="Update password" fields={[{ name: "password", label: "New password", type: "password", autoComplete: "new-password" }, { name: "confirmPassword", label: "Confirm new password", type: "password", autoComplete: "new-password" }]} /></AuthLayout>; }
