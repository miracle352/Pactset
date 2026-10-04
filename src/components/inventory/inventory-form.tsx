"use client";

import { CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { useActionState } from "react";
import { addInventory } from "@/app/workspace/supplier/inventory/actions";
import { initialFormState } from "@/lib/form-state";

export function InventoryForm() { const [state, action, pending] = useActionState(addInventory, initialFormState); return <form action={action} className="inventory-form glass-panel"><div className="compact-section-heading"><div><h2>Add inventory</h2><p>Quantity is shared across overlapping accepted bookings and active 30-minute acceptance reservations.</p></div></div><div className="form-grid"><label>Name<input name="name" defaultValue={state.fields?.name} required /></label><label>Category<input name="category" defaultValue={state.fields?.category} required /></label><label>Total bookable quantity<input name="totalQuantity" type="number" min="0.001" step="0.001" defaultValue={state.fields?.totalQuantity} required /></label><label>Unit<input name="unit" defaultValue={state.fields?.unit ?? "item"} required /></label></div>{state.message && <p className={`form-message ${state.status}`}>{state.status === "error" ? <WarningCircle /> : <CheckCircle />}{state.message}</p>}<button type="submit" className="button button-primary" disabled={pending}>{pending ? "Adding" : "Add inventory"}</button></form>; }
