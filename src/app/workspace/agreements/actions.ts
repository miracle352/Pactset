"use server";

import { fromZonedTime } from "date-fns-tz";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAccount } from "@/lib/account";
import { type FormState, formFields } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";

export async function sendAgreementMessage(agreementId: string, _: FormState, formData: FormData): Promise<FormState> {
  await requireAccount();
  const fields = formFields(formData);
  const parsed = z.object({ body: z.string().trim().min(1).max(4000), languageCode: z.string().trim().min(2).max(16) }).safeParse(fields);
  if (!parsed.success) return { status: "error", message: "Write a message and choose its original language.", fields };
  const supabase = await createClient();
  const { error } = await supabase.rpc("send_agreement_message", { p_agreement_id: agreementId, p_body: parsed.data.body, p_language_code: parsed.data.languageCode });
  if (error) return { status: "error", message: "The message was not saved. Your text remains in this form.", fields };
  revalidatePath(`/workspace/agreements/${agreementId}/payment`);
  return { status: "success", message: "Message saved to this agreement.", fields: { languageCode: parsed.data.languageCode } };
}

export async function requestDeadlineExtension(agreementId: string, _: FormState, formData: FormData): Promise<FormState> {
  await requireAccount();
  const fields = formFields(formData);
  const parsed = z.object({ proposedDeadline: z.string().min(10), timezone: z.string().min(1), reason: z.string().trim().min(10).max(2000) }).safeParse(fields);
  if (!parsed.success) return { status: "error", message: "Choose a future deadline and explain the impact.", fields };
  let deadline: Date;
  try { deadline = fromZonedTime(parsed.data.proposedDeadline, parsed.data.timezone); }
  catch { return { status: "error", message: "Use a valid event-local date and timezone.", fields }; }
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_deadline_extension", { p_agreement_id: agreementId, p_proposed_deadline: deadline.toISOString(), p_reason: parsed.data.reason });
  if (error) return { status: "error", message: error.message.includes("already") ? "A deadline request is already awaiting acknowledgement." : "The deadline request was not saved. The accepted deadline is unchanged.", fields };
  revalidatePath(`/workspace/agreements/${agreementId}/payment`);
  return { status: "success", message: "Deadline change requested. The accepted deadline remains active until the other participant agrees.", fields };
}

export async function respondDeadlineExtension(agreementId: string, requestId: string, accept: boolean, _: FormState, formData: FormData): Promise<FormState> {
  await requireAccount();
  const fields = formFields(formData);
  const parsed = z.object({ reason: z.string().trim().min(3).max(2000) }).safeParse(fields);
  if (!parsed.success) return { status: "error", message: "Record the reason for this response.", fields };
  const supabase = await createClient();
  const { error } = await supabase.rpc("respond_deadline_extension", { p_request_id: requestId, p_accept: accept, p_reason: parsed.data.reason });
  if (error) return { status: "error", message: "This response could not be recorded. Refresh to check whether the request changed.", fields };
  revalidatePath(`/workspace/agreements/${agreementId}/payment`);
  return { status: "success", message: accept ? "The event-local preparation deadline is acknowledged." : "The proposed deadline was declined; the earlier accepted deadline remains active." };
}
