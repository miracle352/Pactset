"use client";

import { ArrowRight, CheckCircle, Eye, EyeSlash, WarningCircle } from "@phosphor-icons/react";
import { useActionState, useState } from "react";
import { initialFormState, type FormState } from "@/lib/form-state";
import { UsernameInput } from "@/components/profile/username-input";

type Field = { name: string; label: string; type?: string; autoComplete?: string; defaultValue?: string; options?: { value: string; label: string }[]; required?: boolean };

function PasswordField({ field, value }: { field: Field; value?: string }) {
  const [visible, setVisible] = useState(false);
  return <div className="auth-field"><label htmlFor={`auth-${field.name}`}>{field.label}</label><span className="password-input"><input id={`auth-${field.name}`} name={field.name} type={visible ? "text" : "password"} autoComplete={field.autoComplete} defaultValue={value ?? field.defaultValue} required /><button type="button" aria-label={visible ? `Hide ${field.label.toLowerCase()}` : `Show ${field.label.toLowerCase()}`} aria-pressed={visible} onClick={() => setVisible((current) => !current)}>{visible ? <EyeSlash aria-hidden="true" /> : <Eye aria-hidden="true" />}<span>{visible ? "Hide" : "Show"}</span></button></span></div>;
}

export function AuthForm({ action, submitLabel, fields, next, footnote }: { action: (state: FormState, data: FormData) => Promise<FormState>; submitLabel: string; fields: Field[]; next?: string; footnote?: React.ReactNode }) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  return (
    <form className="auth-form glass-panel" action={formAction}>
      {next && <input type="hidden" name="next" value={next} />}
      {fields.map((field) => (
        field.type === "hidden" ? <input key={field.name} type="hidden" name={field.name} value={field.defaultValue} /> : field.type === "password" ? <PasswordField key={field.name} field={field} value={state.fields?.[field.name]} /> : field.name === "username" ? <UsernameInput key={field.name} id="auth-username" label={field.label} defaultValue={state.fields?.[field.name] ?? field.defaultValue} /> : <label key={field.name} htmlFor={`auth-${field.name}`}>{field.label}
          {field.options ? (
            <select id={`auth-${field.name}`} name={field.name} defaultValue={state.fields?.[field.name] ?? field.defaultValue} required>
              {field.options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
            </select>
          ) : (
            <input id={`auth-${field.name}`} name={field.name} type={field.type ?? "text"} autoComplete={field.autoComplete} defaultValue={state.fields?.[field.name] ?? field.defaultValue} required={field.required ?? true} />
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
  return <details className="account-boundary glass-panel"><summary>Your account is separate from your wallet.</summary><p>Plan and coordinate work without a wallet. Connect one only when a Stellar Testnet action needs your signature.</p></details>;
}
