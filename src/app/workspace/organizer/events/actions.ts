"use server";

import { fromZonedTime } from "date-fns-tz";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAccount } from "@/lib/account";
import { type FormState, formFields } from "@/lib/form-state";
import { countries, isTestCurrencyAssetCode, timezones } from "@/lib/regions";
import { createClient } from "@/lib/supabase/server";

const eventSchema = z.object({
  name: z.string().trim().min(3).max(140), eventType: z.string().trim().min(2).max(80),
  countryCode: z.string().refine((value) => countries.some(([code]) => code === value)), city: z.string().trim().min(2).max(100), venueAddress: z.string().trim().max(240),
  timezone: z.string().refine((value) => timezones().includes(value)), startsAt: z.string().min(10), endsAt: z.string().min(10), preparationDeadline: z.string().min(10),
  attendeeCount: z.coerce.number().int().positive(), venueCapacity: z.coerce.number().int().positive(),
  budgetCurrency: z.string().refine(isTestCurrencyAssetCode, "Choose a current ISO fiat test currency."), contingencyAmount: z.coerce.number().min(0),
  spaces: z.string().max(2000), foodRequirements: z.string().max(2000), rentalEquipment: z.string().max(2000), purchaseEquipment: z.string().max(2000), crewRequirements: z.string().max(2000), budgetAllocations: z.string().max(2000),
});

const lines = (value: string) => value.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 50);
const allocations = (value: string) => lines(value).map((line) => { const [category, rawAmount] = line.split(":"); return { category: category?.trim(), amount: Number(rawAmount?.trim()) }; }).filter((item) => item.category && Number.isFinite(item.amount) && item.amount >= 0);

export async function saveEvent(eventId: string | null, _: FormState, formData: FormData): Promise<FormState> {
  const account = await requireAccount("organizer");
  const fields = formFields(formData);
  const parsed = eventSchema.safeParse(fields);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Review the event details.", fields, entityId: eventId ?? undefined };
  let startsAt: Date; let endsAt: Date; let prepAt: Date;
  try { startsAt = fromZonedTime(parsed.data.startsAt, parsed.data.timezone); endsAt = fromZonedTime(parsed.data.endsAt, parsed.data.timezone); prepAt = fromZonedTime(parsed.data.preparationDeadline, parsed.data.timezone); } catch { return { status: "error", message: "Use valid local dates and a named timezone.", fields, entityId: eventId ?? undefined }; }
  if (endsAt <= startsAt) return { status: "error", message: "The event must end after it starts.", fields, entityId: eventId ?? undefined };
  if (parsed.data.venueCapacity < parsed.data.attendeeCount) return { status: "error", message: "Venue capacity cannot be lower than attendee count.", fields, entityId: eventId ?? undefined };
  if (prepAt >= startsAt) return { status: "error", message: "Preparation must be due before the event starts. Event-time and teardown duties belong in crew requirements.", fields, entityId: eventId ?? undefined };
  if (prepAt <= new Date()) return { status: "error", message: "The preparation deadline has already passed. Choose a future deadline.", fields, entityId: eventId ?? undefined };
  const payload = { organizer_id: account.userId, status: "draft", name: parsed.data.name, event_type: parsed.data.eventType, country_code: parsed.data.countryCode, city: parsed.data.city, venue_address: parsed.data.venueAddress, timezone: parsed.data.timezone, starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), preparation_deadline: prepAt.toISOString(), attendee_count: parsed.data.attendeeCount, venue_capacity: parsed.data.venueCapacity, budget_currency: parsed.data.budgetCurrency, contingency_amount: parsed.data.contingencyAmount, spaces: lines(parsed.data.spaces), food_requirements: lines(parsed.data.foodRequirements), equipment_requirements: { rental: lines(parsed.data.rentalEquipment), purchase: lines(parsed.data.purchaseEquipment) }, crew_requirements: lines(parsed.data.crewRequirements), budget_allocations: allocations(parsed.data.budgetAllocations) };
  const supabase = await createClient();
  const query = eventId ? supabase.from("events").update(payload).eq("id", eventId).eq("organizer_id", account.userId) : supabase.from("events").insert(payload);
  const { data, error } = await query.select("id").single();
  if (error || !data) return { status: "error", message: "The draft could not be saved. Your entered values are still on this page.", fields, entityId: eventId ?? undefined };
  revalidatePath("/workspace/organizer"); revalidatePath(`/workspace/organizer/events/${data.id}`);
  return { status: "success", message: "Draft saved to your account.", fields, entityId: data.id };
}

const budgetSchema = z.object({
  totalAmount: z.coerce.number().min(0).max(999_999_999_999),
  contingencyAmount: z.coerce.number().min(0).max(999_999_999_999),
  allocations: z.string().max(4000),
  assumptions: z.string().max(4000),
  source: z.enum(["manual", "rule_based", "gemini"]).default("manual"),
});

export async function saveEventBudget(eventId: string, _: FormState, formData: FormData): Promise<FormState> {
  const account = await requireAccount("organizer");
  const fields = formFields(formData);
  const parsed = budgetSchema.safeParse(fields);
  if (!parsed.success) return { status: "error", message: "Review the budget total, contingency, and allocations.", fields };
  if (parsed.data.contingencyAmount > parsed.data.totalAmount) return { status: "error", message: "Contingency cannot exceed the total budget.", fields };
  const supabase = await createClient();
  const { data: event } = await supabase.from("events").select("id,event_type,city,timezone,starts_at,attendee_count,spaces,food_requirements,equipment_requirements,crew_requirements,budget_currency").eq("id", eventId).eq("organizer_id", account.userId).maybeSingle();
  if (!event) return { status: "error", message: "The event could not be found.", fields };
  const spendable = parsed.data.totalAmount - parsed.data.contingencyAmount;
  const manual = allocations(parsed.data.allocations);
  let proposed = parsed.data.source === "rule_based" ? [
    { category: "Venue", amount: Number((spendable * 0.35).toFixed(2)) },
    { category: "Food", amount: Number((spendable * 0.25).toFixed(2)) },
    { category: "Equipment", amount: Number((spendable * 0.2).toFixed(2)) },
    { category: "Crew", amount: Number((spendable * 0.2).toFixed(2)) },
  ] : manual;
  let generatedAssumptions: string[] | null = null;
  if (parsed.data.source === "gemini") {
    const { data: suggestion, error: suggestionError } = await supabase.functions.invoke("budget-suggestions", { body: { eventId, totalAmount: parsed.data.totalAmount, contingencyAmount: parsed.data.contingencyAmount } });
    if (suggestionError || !Array.isArray(suggestion?.allocations)) return { status: "error", message: "Gemini suggestions are not available yet. Your entries were preserved; use the rule-based draft or save them manually.", fields };
    proposed = suggestion.allocations;
    generatedAssumptions = Array.isArray(suggestion.assumptions) ? suggestion.assumptions : [];
  }
  if (!proposed.length) return { status: "error", message: "Add at least one allocation as `category: amount`.", fields };
  const assumptionLines = parsed.data.source === "rule_based" ? [
    "Rule-based starting point only; these figures are not market quotes or accepted offers.",
    `Based on ${event.attendee_count ?? "the saved attendee count"} attendees and the current event brief.`,
    "Edit every allocation before approval.",
  ] : generatedAssumptions ?? lines(parsed.data.assumptions);
  const { data, error } = await supabase.rpc("save_event_budget", {
    p_event_id: eventId,
    p_total_amount: parsed.data.totalAmount,
    p_contingency_amount: parsed.data.contingencyAmount,
    p_allocations: proposed,
    p_assumptions: assumptionLines,
    p_input_snapshot: { eventType: event.event_type, city: event.city, timezone: event.timezone, startsAt: event.starts_at, attendees: event.attendee_count, spaces: event.spaces, food: event.food_requirements, equipment: event.equipment_requirements, crew: event.crew_requirements },
    p_proposal_source: parsed.data.source === "gemini" ? "ai" : parsed.data.source,
  });
  if (error || !data) return { status: "error", message: error?.message.includes("exceed") ? "Allocations and contingency cannot exceed the total budget." : "The budget draft could not be saved. Existing approved planning is unchanged.", fields };
  revalidatePath(`/workspace/organizer/events/${eventId}`);
  return { status: "success", message: parsed.data.source === "rule_based" ? "Editable rule-based draft saved. Review it before approval." : parsed.data.source === "gemini" ? "Editable Gemini suggestion saved. Review every amount before approval." : "Editable budget draft saved." };
}

export async function approveEventBudget(eventId: string, budgetId: string, _: FormState, _formData: FormData): Promise<FormState> {
  await requireAccount("organizer");
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_event_budget", { p_budget_id: budgetId });
  if (error) return { status: "error", message: "This budget could not be approved. Refresh to confirm its current version." };
  revalidatePath(`/workspace/organizer/events/${eventId}`);
  return { status: "success", message: "Budget approved for planning. No offer was accepted and no funds moved." };
}

const requestSchema = z.object({ title: z.string().trim().min(3).max(140), publicScope: z.string().trim().min(10).max(4000), providerRole: z.enum(["supplier", "crew"]), category: z.string().trim().min(2).max(100), quantity: z.coerce.number().positive(), quantityUnit: z.string().trim().min(1).max(40), pricingUnit: z.string().trim().min(1).max(80), currency: z.string().refine(isTestCurrencyAssetCode), availableFrom: z.string().min(10), availableUntil: z.string().min(10), preparationDeadline: z.string().min(10), cancellationTerms: z.string().trim().min(10).max(2000), milestones: z.string().max(2000), timezone: z.string() });

export async function createRequest(eventId: string, _: FormState, formData: FormData): Promise<FormState> {
  const account = await requireAccount("organizer"); const fields = formFields(formData); const parsed = requestSchema.safeParse(fields);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Review the request details.", fields };
  const availableFrom = fromZonedTime(parsed.data.availableFrom, parsed.data.timezone); const availableUntil = fromZonedTime(parsed.data.availableUntil, parsed.data.timezone); const prep = fromZonedTime(parsed.data.preparationDeadline, parsed.data.timezone);
  if (availableUntil <= availableFrom) return { status: "error", message: "The availability window must end after it begins.", fields };
  if (prep > availableFrom && parsed.data.providerRole === "supplier") return { status: "error", message: "Supplier preparation or delivery must be due before service begins. Put event-time exceptions in the scope.", fields };
  const supabase = await createClient();
  const { data: event } = await supabase.from("events").select("id,budget_currency").eq("id", eventId).eq("organizer_id", account.userId).single();
  if (!event) return { status: "error", message: "The event could not be found.", fields };
  if (event.budget_currency !== parsed.data.currency) return { status: "error", message: "This request must use the event budget currency. Existing terms never change when account preferences change.", fields };
  const { data, error } = await supabase.from("requests").insert({ event_id: eventId, organizer_id: account.userId, provider_role: parsed.data.providerRole, title: parsed.data.title, public_scope: parsed.data.publicScope, category: parsed.data.category, quantity: parsed.data.quantity, quantity_unit: parsed.data.quantityUnit, pricing_unit: parsed.data.pricingUnit, currency: parsed.data.currency, available_from: availableFrom.toISOString(), available_until: availableUntil.toISOString(), preparation_deadline: prep.toISOString(), cancellation_terms: parsed.data.cancellationTerms, milestones: lines(parsed.data.milestones) }).select("id").single();
  if (error || !data) return { status: "error", message: "The request draft could not be saved. Your entered values are still here.", fields };
  if (formData.get("intent") === "publish") {
    const { error: publishError } = await supabase.rpc("publish_request", { p_request_id: data.id });
    if (publishError) return { status: "error", message: "The request saved as a private draft, but publishing failed.", fields, entityId: data.id };
  }
  revalidatePath("/workspace/organizer"); revalidatePath(`/workspace/organizer/events/${eventId}`);
  return { status: "success", message: formData.get("intent") === "publish" ? "Request published to eligible providers." : "Request saved privately.", fields, entityId: data.id };
}

export async function proposeEventChange(eventId: string, _: FormState, formData: FormData): Promise<FormState> {
  await requireAccount("organizer");
  const fields = formFields(formData);
  const parsed = z.object({
    changeType: z.enum(["venue", "schedule", "attendance", "scope", "price", "deadline"]),
    reason: z.string().trim().min(10).max(2000),
    timezone: z.string().refine((value) => timezones().includes(value)),
    venueAddress: z.string().trim().max(240).optional(),
    startsAt: z.string().optional(), endsAt: z.string().optional(), preparationDeadline: z.string().optional(),
    attendeeCount: z.string().optional(), venueCapacity: z.string().optional(),
    impactNote: z.string().trim().max(2000).optional(),
  }).safeParse(fields);
  if (!parsed.success) return { status: "error", message: "Describe the proposed value and why the event is changing.", fields };
  const value = parsed.data;
  let proposedValues: Record<string, string | number>;
  try {
    if (value.changeType === "venue") proposedValues = { venue_address: z.string().min(3).parse(value.venueAddress) };
    else if (value.changeType === "schedule") proposedValues = { starts_at: fromZonedTime(z.string().min(10).parse(value.startsAt), value.timezone).toISOString(), ends_at: fromZonedTime(z.string().min(10).parse(value.endsAt), value.timezone).toISOString() };
    else if (value.changeType === "attendance") proposedValues = { attendee_count: z.coerce.number().int().positive().parse(value.attendeeCount), venue_capacity: z.coerce.number().int().positive().parse(value.venueCapacity) };
    else if (value.changeType === "deadline") proposedValues = { preparation_deadline: fromZonedTime(z.string().min(10).parse(value.preparationDeadline), value.timezone).toISOString() };
    else proposedValues = { [value.changeType === "scope" ? "scope_note" : "price_note"]: z.string().min(5).parse(value.impactNote) };
  } catch { return { status: "error", message: "Complete the proposed values for this type of change.", fields }; }
  const supabase = await createClient();
  const { error } = await supabase.rpc("propose_event_change", { p_event_id: eventId, p_change_type: value.changeType, p_reason: value.reason, p_proposed_values: proposedValues });
  if (error) return { status: "error", message: error.message.includes("awaiting") ? "Another event change is still awaiting participant responses." : "The change request could not be saved. Existing event and agreement terms are unchanged.", fields };
  revalidatePath(`/workspace/organizer/events/${eventId}`);
  return { status: "success", message: "Change proposed. Existing agreement terms remain active while affected providers respond." };
}

export async function respondEventChange(agreementId: string, impactId: string, _: FormState, formData: FormData): Promise<FormState> {
  await requireAccount();
  const fields = formFields(formData);
  const parsed = z.object({ response: z.enum(["accepted", "adjustment_requested", "declined"]), reason: z.string().trim().min(3).max(2000), adjustmentNote: z.string().trim().max(2000).optional() }).safeParse(fields);
  if (!parsed.success) return { status: "error", message: "Choose a response and record your reason.", fields };
  if (parsed.data.response === "adjustment_requested" && (parsed.data.adjustmentNote?.length ?? 0) < 5) return { status: "error", message: "Describe the work, price, or timing adjustment you need.", fields };
  const supabase = await createClient();
  const { error } = await supabase.rpc("respond_event_change", { p_impact_id: impactId, p_response: parsed.data.response, p_reason: parsed.data.reason, p_proposed_implications: parsed.data.adjustmentNote ? { note: parsed.data.adjustmentNote } : {} });
  if (error) return { status: "error", message: "The response was not saved. Refresh to confirm that the agreement version is still current.", fields };
  revalidatePath(`/workspace/agreements/${agreementId}/payment`);
  return { status: "success", message: parsed.data.response === "accepted" ? "Acknowledgement recorded. Your accepted agreement remains unchanged until a compatible amendment is separately accepted and funded." : "Your response was recorded without changing the existing agreement." };
}

export async function cancelEventChange(eventId: string, changeId: string, _: FormState, formData: FormData): Promise<FormState> {
  await requireAccount("organizer");
  const fields = formFields(formData);
  const parsed = z.object({ reason: z.string().trim().min(3).max(2000) }).safeParse(fields);
  if (!parsed.success) return { status: "error", message: "Record why this proposal is being closed.", fields };
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_event_change", { p_change_id: changeId, p_reason: parsed.data.reason });
  if (error) return { status: "error", message: "The proposal could not be closed. Refresh to check its current status.", fields };
  revalidatePath(`/workspace/organizer/events/${eventId}`);
  return { status: "success", message: "Proposal closed. Existing event and agreement terms were not changed." };
}
