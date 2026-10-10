import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { Compass } from "@phosphor-icons/react/dist/ssr/Compass";
import Link from "next/link";

type Role = "organizer" | "supplier" | "crew" | "support";

export function WorkspaceNextStep({ accountRole, complete, href, title, body, action }: { accountRole: Exclude<Role, "support">; complete: boolean; href: string; title?: string; body?: string; action?: string }) {
  const copy = {
    organizer: { title: complete ? "Continue your event plan" : "Create your first event", body: complete ? "Open the latest event to review its requests, bookings, deadlines, and next decisions." : "Set the date, place, timezone, attendance, requirements, and budget in a private saved draft.", action: complete ? "Open events" : "Create event" },
    supplier: { title: complete ? "Review matching requests" : "Finish your service profile", body: complete ? "Your services and availability can now be matched with eligible published requests." : "Add the services, working area, pricing units, availability, and capacity organizers need to evaluate.", action: complete ? "Find requests" : "Complete profile" },
    crew: { title: complete ? "Review eligible opportunities" : "Add your skills and availability", body: complete ? "Your saved skills and availability can now be matched with eligible event shifts." : "Add your working area, skills, rates, and availability before responding to work.", action: complete ? "Find opportunities" : "Complete profile" },
  }[accountRole];
  return <section className="next-step workspace-first-step" aria-labelledby={`workspace-next-${accountRole}`}><Compass aria-hidden="true" /><div><p>Your next step</p><h2 id={`workspace-next-${accountRole}`}>{title ?? copy.title}</h2><span>{body ?? copy.body}</span></div><Link href={href}>{action ?? copy.action} <ArrowRight aria-hidden="true" /></Link></section>;
}

export function AgreementNextStep({ role, agreementId, walletReady, escrowStatus, conversionConfirmed, milestoneStatuses }: { role: Role; agreementId: string; walletReady: boolean; escrowStatus?: string | null; conversionConfirmed: boolean; milestoneStatuses: string[] }) {
  let title = "Review this booking", body = "Check the accepted terms and current ledger state before taking action.", href = "#transactions", actor = "You";
  if (!walletReady && role !== "support") { title = "Connect your Testnet wallet"; body = "Verify ownership before creating an escrow, funding, submitting evidence, or receiving a release."; href = "/settings/wallet"; }
  else if (!escrowStatus && role === "organizer") { title = "Create this booking’s escrow"; body = "Both participants must verify their wallets. You then review and sign the agreement-bound escrow deployment."; href = "#payment-actions"; actor = "Organizer"; }
  else if (!escrowStatus && (role === "supplier" || role === "crew")) { title = "Waiting for the organizer to create escrow"; body = "Your verified wallet is ready. The organizer must create the agreement-bound escrow next."; actor = "Organizer"; }
  else if (escrowStatus === "awaiting_funding" && role === "organizer" && !conversionConfirmed) { title = "Convert XLM for this booking"; body = "Review an exact-output quote for the accepted asset and amount, then approve it in your wallet."; href = "#payment-actions"; actor = "Organizer"; }
  else if (escrowStatus === "awaiting_funding" && role === "organizer") { title = "Fund this booking"; body = "The conversion is confirmed. Fund from the converted balance without converting again."; href = "#payment-actions"; actor = "Organizer"; }
  else if (milestoneStatuses.includes("disputed")) { title = "Wait for assigned support"; body = "A disputed milestone is frozen. Ordinary approval cannot release it."; href = "#transactions"; actor = "Assigned support"; }
  else if ((role === "supplier" || role === "crew") && milestoneStatuses.some((status) => ["pending", "correction_requested"].includes(status))) { title = milestoneStatuses.includes("correction_requested") ? "Submit corrected evidence" : "Submit work evidence"; body = "Add a note and optional private media for organizer review. Submission is not payment approval."; href = "#evidence"; actor = role === "crew" ? "Crew" : "Provider"; }
  else if (role === "organizer" && milestoneStatuses.includes("submitted")) { title = "Review submitted work"; body = "Approve the milestone or request a correction. Approval is the explicit release authorization."; href = "#evidence"; actor = "Organizer"; }
  else if ((role === "supplier" || role === "crew") && milestoneStatuses.length > 0 && milestoneStatuses.every((status) => ["released", "refunded"].includes(status))) { title = "Keep or convert released funds"; body = "The release is complete. Any recipient conversion is a separate wallet-authorized transaction."; href = "#transactions"; actor = "Recipient"; }
  return <section className="next-step" aria-labelledby={`next-step-${agreementId}`}><Compass /><div><p>{actor} acts next</p><h2 id={`next-step-${agreementId}`}>{title}</h2><span>{body}</span></div><Link href={href}>Go to next step <ArrowRight /></Link></section>;
}
