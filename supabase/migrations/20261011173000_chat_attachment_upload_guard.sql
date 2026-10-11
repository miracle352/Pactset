-- Let Storage validate a prepared pending upload without exposing pending metadata.
create or replace function public.can_upload_conversation_attachment(p_object_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(
    select 1 from public.agreement_message_attachments a
    where a.object_path=p_object_path and a.uploaded_by=(select auth.uid()) and a.status='pending'
      and public.can_access_agreement_conversation(a.agreement_id)
  );
$$;
revoke all on function public.can_upload_conversation_attachment(text) from public,anon;
grant execute on function public.can_upload_conversation_attachment(text) to authenticated,service_role;

drop policy if exists conversation_attachment_prepared_upload on storage.objects;
create policy conversation_attachment_prepared_upload on storage.objects for insert to authenticated
with check (bucket_id='conversation-attachments' and public.can_upload_conversation_attachment(name));
