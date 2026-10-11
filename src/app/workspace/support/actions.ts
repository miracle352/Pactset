"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAccount } from "@/lib/account";
import type { FormState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";

const openSchema = z.object({ agreementId: z.uuid(), reason: z.string().trim().min(10).max(4000) });
const messageSchema = z.object({ caseId: z.uuid(), agreementId: z.uuid(), body: z.string().trim().min(1).max(4000) });

export async function openSupportCase(_: FormState, formData: FormData): Promise<FormState> {
  await requireAccount();
  const parsed = openSchema.safeParse({ agreementId: formData.get("agreementId"), reason: formData.get("reason") });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Describe the issue." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("open_support_case", { p_agreement_id: parsed.data.agreementId, p_reason: parsed.data.reason });
  if (error || !data) return { status: "error", message: error?.message ?? "The case could not be opened." };
  revalidatePath(`/workspace/agreements/${parsed.data.agreementId}/payment`);
  revalidatePath("/workspace/support");
  return { status: "success", message: "Case opened. Only the participants and assigned support can see it." };
}

export async function addSupportCaseMessage(_: FormState, formData: FormData): Promise<FormState> {
  await requireAccount();
  const parsed = messageSchema.safeParse({ caseId: formData.get("caseId"), agreementId: formData.get("agreementId"), body: formData.get("body") });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Write a message." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_support_case_message", { p_case_id: parsed.data.caseId, p_body: parsed.data.body, p_evidence_id: null });
  if (error) return { status: "error", message: error.message };
  revalidatePath(`/workspace/agreements/${parsed.data.agreementId}/payment`);
  revalidatePath(`/workspace/support/cases/${parsed.data.caseId}`);
  return { status: "success", message: "Message added to the private case." };
}
