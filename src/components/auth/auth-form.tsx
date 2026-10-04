"use client";

import { ArrowRight, CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { useActionState } from "react";
import { initialFormState, type FormState } from "@/lib/form-state";

type Field = { name: string; label: string; type?: string; autoComplete?: string; defaultValue?: string; options?: { value: string; label: string }[] };

export function AuthForm({ action, submitLabel, fields, next, footnote }: { action: (state: FormState, data: FormData) => Promise<FormState>; submitLabel: string; fields: Field[]; next?: string; footnote?: React.ReactNode }) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  return (
    <form className="auth-form glass-panel" action={formAction}>
      {next && <input type="hidden" name="next" value={next} />}
      {fields.map((field) => (
        <label key={field.name} htmlFor={`auth-${field.name}`}>{field.label}
          {field.options ? (
            <select id={`auth-${field.name}`} name={field.name} defaultValue={state.fields?.[field.name] ?? field.defaultValue} required>
              {field.options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
            </select>
          ) : (
            <input id={`auth-${field.name}`} name={field.name} type={field.type ?? "text"} autoComplete={field.autoComplete} defaultValue={state.fields?.[field.name] ?? field.defaultValue} required />
          )}
        </label>
      ))}
      {state.message && <p className={`form-message ${state.status}`} role={state.status === "error" ? "alert" : "status"}>{state.status === "error" ? <WarningCircle /> : <CheckCircle />}{state.message}</p>}
      <button className="button button-primary" type="submit" disabled={pending} aria-busy={pending}>{pending ? "Please wait" : submitLabel}<ArrowRight aria-hidden="true" /></button>
      {footnote && <div className="auth-footnote">{footnote}</div>}
    </form>
  );
}

export function AccountWalletBoundary() {
  return <aside className="account-boundary"><strong>Your account is not a wallet.</strong><p>A Pactset account manages identity, roles, drafts, offers, and bookings. A Stellar wallet will authorize Testnet transactions in the next settlement milestone. Pactset never asks for a seed phrase.</p><span>Wallet connection is not available yet</span></aside>;
}
