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
