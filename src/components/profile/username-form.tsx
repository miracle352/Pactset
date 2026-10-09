"use client";
import { useActionState } from "react";
import { saveUsername } from "@/app/settings/actions";
import { initialFormState } from "@/lib/form-state";
export function UsernameForm({ username }: { username?: string | null }) {
  const [state, action, pending] = useActionState(saveUsername, initialFormState);
  return <form action={action} className="settings-section glass-panel username-settings"><div><p className="kicker">Sign-in name</p><h2>Unique username</h2><p className="field-note">Separate from your public display name. Use 3–30 lowercase letters, numbers, or underscores.</p></div><label>Username<input name="username" defaultValue={state.fields?.username ?? username ?? ""} pattern="[a-z0-9][a-z0-9_]{2,29}" autoComplete="username" required /></label><button className="button button-secondary" type="submit" disabled={pending}>{pending ? "Checking" : "Save username"}</button>{state.message && <p className={`form-message ${state.status}`} role={state.status === "error" ? "alert" : "status"}>{state.message}</p>}</form>;
}
