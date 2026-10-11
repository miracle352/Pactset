"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAccount } from "@/lib/account";
import { type FormState, formFields } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";

const inventorySchema = z.object({ name: z.string().trim().min(2).max(120), category: z.string().trim().min(2).max(100), totalQuantity: z.coerce.number().positive(), unit: z.string().trim().min(1).max(40) });
export async function addInventory(_: FormState, formData: FormData): Promise<FormState> { const account = await requireAccount("supplier"); const fields = formFields(formData); const parsed = inventorySchema.safeParse(fields); if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Review the inventory values.", fields }; const supabase = await createClient(); const { error } = await supabase.from("inventory_items").insert({ supplier_id: account.userId, name: parsed.data.name, category: parsed.data.category, total_quantity: parsed.data.totalQuantity, unit: parsed.data.unit }); if (error) return { status: "error", message: "Inventory could not be added. Existing quantities were not changed.", fields }; revalidatePath("/workspace/supplier"); revalidatePath("/workspace/supplier/inventory"); return { status: "success", message: "Inventory capacity added." }; }
