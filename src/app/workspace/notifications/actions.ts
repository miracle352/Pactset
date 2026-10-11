"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAccount } from "@/lib/account";
import { safeInternalPath } from "@/lib/navigation";
import { createClient } from "@/lib/supabase/server";

export async function openNotification(formData: FormData) {
  const account = await requireAccount();
  const workspace = account.roles[0] ?? "organizer";
  const parsed = z.object({ id: z.coerce.number().int().positive(), href: z.string() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/workspace/${workspace}`);
  const supabase = await createClient();
  await supabase.from("account_notifications").update({ read_at: new Date().toISOString() }).eq("id", parsed.data.id).eq("user_id", account.userId);
  redirect(safeInternalPath(parsed.data.href, `/workspace/${workspace}`));
}

export async function markAllNotificationsRead() {
  const account = await requireAccount();
  const supabase = await createClient();
  await supabase.from("account_notifications").update({ read_at: new Date().toISOString() }).eq("user_id", account.userId).is("read_at", null);
  revalidatePath("/workspace", "layout");
}
