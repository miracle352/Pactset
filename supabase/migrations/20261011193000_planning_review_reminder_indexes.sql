-- Cover new foreign keys used by owner, participant, and reminder-worker lookups.
create index if not exists event_budget_versions_organizer_idx on public.event_budget_versions(organizer_id,created_at desc);
create index if not exists agreement_reviews_reviewer_idx on public.agreement_reviews(reviewer_id,created_at desc);
create index if not exists scheduled_reminders_event_idx on public.scheduled_reminders(event_id) where event_id is not null;
create index if not exists scheduled_reminders_agreement_idx on public.scheduled_reminders(agreement_id) where agreement_id is not null;
