-- Private agreement-chat attachments and conservative source-language metadata.
-- Message originals remain authoritative; this migration never touches evidence storage.

alter table public.agreement_messages
  add column if not exists language_detection_status text not null default 'manual'
    check (language_detection_status in ('manual','detected','uncertain'));

create table public.agreement_message_attachments (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.agreements(id) on delete cascade,
  message_id uuid references public.agreement_messages(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  object_path text not null unique,
  original_name text not null check (char_length(original_name) between 1 and 180),
  media_type text not null check (media_type in (
    'image/jpeg','image/png','image/webp','video/mp4','video/webm',
    'application/pdf','text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  )),
  size_bytes bigint not null check (size_bytes between 1 and 26214400),
  status text not null default 'pending' check (status in ('pending','attached')),
  created_at timestamptz not null default now(),
  attached_at timestamptz,
  constraint attachment_message_state check (
    (status='pending' and message_id is null and attached_at is null) or
    (status='attached' and message_id is not null and attached_at is not null)
  )
);
create index agreement_message_attachments_message_idx on public.agreement_message_attachments(message_id) where message_id is not null;
create index agreement_message_attachments_pending_idx on public.agreement_message_attachments(uploaded_by,created_at) where status='pending';

alter table public.agreement_message_attachments enable row level security;
revoke all on public.agreement_message_attachments from public,anon,authenticated;
grant select on public.agreement_message_attachments to authenticated;
grant all on public.agreement_message_attachments to service_role;
create policy agreement_message_attachments_member_read on public.agreement_message_attachments for select to authenticated
  using (status='attached' and public.can_access_agreement_conversation(agreement_id));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('conversation-attachments','conversation-attachments',false,26214400,array[
  'image/jpeg','image/png','image/webp','video/mp4','video/webm','application/pdf','text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy conversation_attachment_prepared_upload on storage.objects for insert to authenticated
with check (
  bucket_id='conversation-attachments' and exists(
    select 1 from public.agreement_message_attachments a
    where a.object_path=name and a.uploaded_by=(select auth.uid()) and a.status='pending'
      and public.can_access_agreement_conversation(a.agreement_id)
  )
);

create or replace function public.send_agreement_message_with_attachments(
  p_agreement_id uuid,p_body text,p_language_code text,p_idempotency_key uuid,p_attachment_ids uuid[] default '{}'
) returns public.agreement_messages language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=(select auth.uid()); v_message public.agreement_messages; v_count integer; v_status text;
begin
  if cardinality(p_attachment_ids)>5 then raise exception 'A message can include at most five attachments'; end if;
  if lower(trim(coalesce(p_language_code,'auto')))='auto' then
    if char_length(trim(p_body))<20 then p_language_code:='und'; v_status:='uncertain';
    elsif p_body ~ '[؀-ۿ]' then p_language_code:='ar'; v_status:='detected';
    elsif p_body ~* '(^|\s)(bonjour|merci|avec|pour|vous|nous|demain)(\s|$)' then p_language_code:='fr'; v_status:='detected';
    elsif p_body ~* '(^|\s)(hola|gracias|para|usted|mañana|equipo)(\s|$)' then p_language_code:='es'; v_status:='detected';
    elsif p_body ~* '(^|\s)(olá|obrigado|para|você|amanhã|equipa)(\s|$)' then p_language_code:='pt'; v_status:='detected';
    else p_language_code:='en'; v_status:='uncertain'; end if;
  else v_status:='manual'; end if;
  if cardinality(p_attachment_ids)>0 then
    select count(*) into v_count from public.agreement_message_attachments a
      where a.id=any(p_attachment_ids) and a.agreement_id=p_agreement_id and a.uploaded_by=v_actor and a.status='pending'
      and exists(select 1 from storage.objects o where o.bucket_id='conversation-attachments' and o.name=a.object_path);
    if v_count<>cardinality(p_attachment_ids) then raise exception 'One or more attachments are missing or unavailable'; end if;
  end if;
  v_message:=public.send_agreement_message(p_agreement_id,p_body,p_language_code,p_idempotency_key);
  update public.agreement_messages set language_detection_status=v_status where id=v_message.id;
  update public.agreement_message_attachments set message_id=v_message.id,status='attached',attached_at=now()
    where id=any(p_attachment_ids) and agreement_id=p_agreement_id and uploaded_by=v_actor and status='pending';
  select * into v_message from public.agreement_messages where id=v_message.id;
  return v_message;
end;
$$;
revoke all on function public.send_agreement_message_with_attachments(uuid,text,text,uuid,uuid[]) from public,anon;
grant execute on function public.send_agreement_message_with_attachments(uuid,text,text,uuid,uuid[]) to authenticated;

comment on table public.agreement_message_attachments is 'Private agreement-chat files. Separate from milestone evidence; pending objects may be safely abandoned without deleting evidence.';
