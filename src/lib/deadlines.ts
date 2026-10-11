export type AcceptedDeadlineExtension = {
  agreement_id: string;
  proposed_deadline: string;
  created_at: string;
};

export function latestAcceptedDeadlines(rows: AcceptedDeadlineExtension[] | null | undefined) {
  const deadlines = new Map<string, string>();
  for (const row of rows ?? []) {
    if (!deadlines.has(row.agreement_id)) deadlines.set(row.agreement_id, row.proposed_deadline);
  }
  return deadlines;
}

export function effectivePreparationDeadline(
  agreementId: string,
  originalDeadline: string | null,
  acceptedDeadlines: Map<string, string>,
) {
  return acceptedDeadlines.get(agreementId) ?? originalDeadline;
}
