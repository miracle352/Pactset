"use server";

import { fromZonedTime } from "date-fns-tz";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAccount } from "@/lib/account";
import { type FormState, formFields } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";

const termsSchema = z.object({ requestId: z.uuid(), scope: z.string().trim().min(10).max(4000), quantity: z.coerce.number().positive(), pricingUnit: z.string().trim().min(1).max(80), amount: z.coerce.number().min(0), currency: z.enum(["TUSD", "TGBP", "TAUD"]), availableFrom: z.string().min(10), availableUntil: z.string().min(10), preparationDeadline: z.string().min(10), cancellationTerms: z.string().trim().min(10).max(2000), milestones: z.string().max(2000), inventoryItemId: z.string().optional(), timezone: z.string(), idempotencyKey: z.uuid() });
const lines = (value: string) => value.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 30);

export async function submitOffer(_: FormState, formData: FormData): Promise<FormState> {
  await requireAccount(); const fields = formFields(formData); const parsed = termsSchema.safeParse(fields);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Review the offer terms.", fields };
  const start = fromZonedTime(parsed.data.availableFrom, parsed.data.timezone); const end = fromZonedTime(parsed.data.availableUntil, parsed.data.timezone); const prep = fromZonedTime(parsed.data.preparationDeadline, parsed.data.timezone);
  if (end <= start) return { status: "error", message: "The offered work window must end after it begins.", fields };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_offer", { p_request_id: parsed.data.requestId, p_scope: parsed.data.scope, p_quantity: parsed.data.quantity, p_pricing_unit: parsed.data.pricingUnit, p_amount: parsed.data.amount, p_currency: parsed.data.currency, p_available_from: start.toISOString(), p_available_until: end.toISOString(), p_preparation_deadline: prep.toISOString(), p_cancellation_terms: parsed.data.cancellationTerms, p_milestones: lines(parsed.data.milestones), p_inventory_item_id: parsed.data.inventoryItemId ? Number(parsed.data.inventoryItemId) : null, p_idempotency_key: parsed.data.idempotencyKey });
  if (error || !data) return { status: "error", message: error?.message.includes("duplicate") ? "You already submitted an offer for this request." : "The offer could not be submitted. Your terms remain on this page.", fields };
  revalidatePath("/workspace/supplier"); revalidatePath("/workspace/crew");
  return { status: "success", message: "Offer submitted. It remains unfunded and can be withdrawn before matching acceptance.", fields, entityId: data.id };
}

export async function respondToOffer(offerId: string, version: number, _: FormState, formData: FormData): Promise<FormState> {
  await requireAccount(); const action = String(formData.get("offerAction") ?? ""); const reason = String(formData.get("reason") ?? "");
  if (!["accept", "reject", "withdraw"].includes(action)) return { status: "error", message: "Choose a valid offer action." };
  const supabase = await createClient(); const { data, error } = await supabase.rpc("respond_to_offer", { p_offer_id: offerId, p_expected_version: version, p_action: action, p_reason: reason || null });
  if (error) return { status: "error", message: error.message.includes("Stale") ? "This offer changed. Refresh and review the current version before responding." : error.message.includes("capacity") || error.message.includes("conflicts") ? error.message : "The offer response could not be recorded. No agreement was created." };
  revalidatePath("/workspace", "layout");
  return { status: "success", message: data?.state === "agreement_created" ? "Both parties accepted the same terms. Agreement created: Awaiting Testnet funding." : action === "accept" ? "Your acceptance is recorded for 30 minutes while the other party reviews the same version." : `Offer ${action === "reject" ? "rejected" : "withdrawn"}.` };
}

const counterSchema = termsSchema.omit({ requestId: true, idempotencyKey: true }).extend({ reason: z.string().trim().min(3).max(1000) });
export async function counterOffer(offerId: string, version: number, _: FormState, formData: FormData): Promise<FormState> {
  await requireAccount(); const fields = formFields(formData); const parsed = counterSchema.safeParse(fields);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Review the revised terms.", fields };
  const supabase = await createClient(); const { error } = await supabase.rpc("counter_offer", { p_offer_id: offerId, p_expected_version: version, p_scope: parsed.data.scope, p_quantity: parsed.data.quantity, p_pricing_unit: parsed.data.pricingUnit, p_amount: parsed.data.amount, p_currency: parsed.data.currency, p_available_from: fromZonedTime(parsed.data.availableFrom, parsed.data.timezone).toISOString(), p_available_until: fromZonedTime(parsed.data.availableUntil, parsed.data.timezone).toISOString(), p_preparation_deadline: fromZonedTime(parsed.data.preparationDeadline, parsed.data.timezone).toISOString(), p_cancellation_terms: parsed.data.cancellationTerms, p_milestones: lines(parsed.data.milestones), p_inventory_item_id: parsed.data.inventoryItemId ? Number(parsed.data.inventoryItemId) : null, p_reason: parsed.data.reason });
  if (error) return { status: "error", message: error.message.includes("Stale") ? "A newer offer version exists. Refresh before revising it." : "The counteroffer could not be saved. No acceptance changed.", fields };
  revalidatePath("/workspace", "layout"); return { status: "success", message: "Counteroffer created. Earlier acceptances are invalid and the other party must review this version.", fields };
}
