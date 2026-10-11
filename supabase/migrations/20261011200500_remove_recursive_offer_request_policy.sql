-- Correct the initially applied policy without weakening request privacy.
-- Requests already depend on offer visibility for organizer/provider checks;
-- making requests depend on offers in return creates PostgreSQL RLS recursion.
drop policy if exists requests_offer_participant_select on public.requests;
