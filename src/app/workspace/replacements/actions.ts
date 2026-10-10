"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAccount } from "@/lib/account";
import { type FormState, formFields } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";

const createSchema = z.object({
  agreementId: z.uuid(), reason: z.string().trim().min(10).max(2000),
  affectedTasks: z.string().trim().min(3).max(2000), budgetLimit: z.coerce.number().min(0),
  setupMinutes: z.coerce.number().int().min(0).max(10080), teardownMinutes: z.coerce.number().int().min(0).max(10080),
});

export async function createReplacement(_: FormState, formData: FormData): Promise<FormState> {
  await requireAccount("organizer");
  const fields = formFields(formData); const parsed = createSchema.safeParse(fields);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Review the replacement details.", fields };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_replacement_request", {
    p_original_agreement_id: parsed.data.agreementId, p_reason: parsed.data.reason,
    p_affected_tasks: parsed.data.affectedTasks.split("\n").map((value) => value.trim()).filter(Boolean),
    p_budget_limit: parsed.data.budgetLimit, p_setup_minutes: parsed.data.setupMinutes, p_teardown_minutes: parsed.data.teardownMinutes,
  });
  if (error || !data) return { status: "error", message: error?.message ?? "The replacement request could not be created.", fields };
  revalidatePath(`/workspace/agreements/${parsed.data.agreementId}/payment`);
  return { status: "success", message: "Replacement search created. The original booking and its funds remain unchanged.", entityId: data.id };
}

const inviteSchema = z.object({ replacementId: z.uuid(), providerId: z.uuid(), reason: z.string().trim().min(3).max(1000) });
export async function inviteReplacement(_: FormState, formData: FormData): Promise<FormState> {
  await requireAccount("organizer"); const fields = formFields(formData); const parsed = inviteSchema.safeParse(fields);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Choose an eligible provider.", fields };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("invite_replacement_provider", { p_replacement_id: parsed.data.replacementId, p_provider_id: parsed.data.providerId, p_reason: parsed.data.reason });
  if (error || !data) return { status: "error", message: error?.message ?? "The invitation could not be sent.", fields };
  revalidatePath(`/workspace/replacements/${parsed.data.replacementId}`);
  return { status: "success", message: "Invitation sent. The provider must submit and accept current terms before a replacement booking exists." };
}
