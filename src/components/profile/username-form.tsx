"use client";
import Link from "next/link";
import { useActionState } from "react";
import { saveUsername } from "@/app/settings/actions";
import { initialFormState } from "@/lib/form-state";
import { UsernameInput } from "./username-input";
export function UsernameForm({ username, workspaceHref }: { username?: string | null; workspaceHref: string }) {
  const [state, action, pending] = useActionState(saveUsername, initialFormState);
  return <form action={action} className="settings-section glass-panel username-settings"><div><p className="kicker">Account access</p><h2>Choose your public username</h2><p className="field-note">Your username is unique and can be used to sign in. It stays separate from your optional display or business name.</p></div><UsernameInput defaultValue={state.fields?.username ?? username ?? ""} id="settings-username" /><div className="settings-inline-actions"><button className="button button-secondary" type="submit" disabled={pending} aria-busy={pending}>{pending ? "Saving…" : "Save username"}</button>{state.status === "success" && <Link className="button button-primary" href={workspaceHref}>Continue to workspace</Link>}</div>{state.message && <p className={`form-message ${state.status}`} role={state.status === "error" ? "alert" : "status"}>{state.message}</p>}</form>;
}
