"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { publicAccountRoles } from "@/lib/account";
import { type FormState, formFields } from "@/lib/form-state";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

const credentials = z.object({ email: z.email(), password: z.string().min(10).max(128) });
const signup = credentials.extend({ displayName: z.string().trim().min(2).max(80), role: z.enum(publicAccountRoles) });
const safeFields = (fields: Record<string, string>) => Object.fromEntries(Object.entries(fields).filter(([key]) => !key.toLowerCase().includes("password")));

function originFromHeaders(value: Headers) {
  return process.env.NEXT_PUBLIC_SITE_URL ?? value.get("origin") ?? "http://localhost:3000";
}

export async function signIn(_: FormState, formData: FormData): Promise<FormState> {
  const fields = formFields(formData);
  if (!isSupabaseConfigured()) return { status: "error", message: "The Pactset account service is not connected yet.", fields: safeFields(fields) };
  const parsed = credentials.safeParse(fields);
  if (!parsed.success) return { status: "error", message: "Enter a valid email and a password of at least 10 characters.", fields: safeFields(fields) };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { status: "error", message: "Sign-in failed. Check your details or verify your email.", fields: { email: parsed.data.email } };
  const next = typeof fields.next === "string" && fields.next.startsWith("/") && !fields.next.startsWith("//") ? fields.next : "/workspace";
  redirect(next);
}

export async function signUp(_: FormState, formData: FormData): Promise<FormState> {
  const fields = formFields(formData);
  if (!isSupabaseConfigured()) return { status: "error", message: "The Pactset account service is not connected yet.", fields: safeFields(fields) };
  const parsed = signup.safeParse(fields);
  if (!parsed.success) return { status: "error", message: "Enter your name, a valid email, a 10-character password, and a public role.", fields: safeFields(fields) };
  const requestHeaders = await headers();
  const origin = originFromHeaders(requestHeaders);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName },
      emailRedirectTo: `${origin}/auth/confirm?next=/workspace/${parsed.data.role}&role=${parsed.data.role}`,
    },
  });
  if (error) return { status: "error", message: "Account creation failed. The address may already be registered.", fields: { email: parsed.data.email, displayName: parsed.data.displayName, role: parsed.data.role } };
  if (data.session) {
    const { error: roleError } = await supabase.from("account_roles").insert({ user_id: data.session.user.id, role: parsed.data.role });
    if (roleError && roleError.code !== "23505") return { status: "error", message: "The account was created, but its role could not be assigned. Sign in and try again.", fields: { email: parsed.data.email, displayName: parsed.data.displayName, role: parsed.data.role } };
    redirect(`/workspace/${parsed.data.role}`);
  }
  return { status: "success", message: "Check your email to verify the account, then return to Pactset.", fields: { email: parsed.data.email, displayName: parsed.data.displayName, role: parsed.data.role } };
}

export async function requestPasswordReset(_: FormState, formData: FormData): Promise<FormState> {
  const fields = formFields(formData);
  const parsed = z.object({ email: z.email() }).safeParse(fields);
  if (!parsed.success) return { status: "error", message: "Enter a valid email address.", fields };
  if (!isSupabaseConfigured()) return { status: "error", message: "The Pactset account service is not connected yet.", fields };
  const requestHeaders = await headers();
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: `${originFromHeaders(requestHeaders)}/auth/confirm?next=/auth/update-password` });
  if (error) return { status: "error", message: "Password recovery could not be started. Try again shortly.", fields };
  return { status: "success", message: "If the account exists, a recovery link is on its way.", fields: { email: parsed.data.email } };
}

export async function updatePassword(_: FormState, formData: FormData): Promise<FormState> {
  const fields = formFields(formData);
  const parsed = z.object({ password: z.string().min(10).max(128), confirmPassword: z.string() }).safeParse(fields);
  if (!parsed.success || parsed.data.password !== parsed.data.confirmPassword) return { status: "error", message: "Use at least 10 characters and make both passwords match." };
  if (!isSupabaseConfigured()) return { status: "error", message: "The Pactset account service is not connected yet." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { status: "error", message: "The recovery session expired. Request a new link." };
  redirect("/workspace?notice=password-updated");
}

export async function signOut() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/auth/sign-in?notice=signed-out");
}
