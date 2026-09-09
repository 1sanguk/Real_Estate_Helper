create table if not exists public.listing_document_analyses (
  attachment_id bigint primary key references public.listing_attachments(id) on delete cascade,
  source_listing_id text not null references public.official_listings(source_listing_id) on delete cascade,
  extraction_status text not null check (extraction_status in ('pending', 'succeeded', 'failed', 'unsupported')),
  text_content text,
  content_hash text,
  error_message text,
  analyzed_at timestamptz not null default now()
);

create table if not exists public.listing_eligibility_rules (
  id bigint generated always as identity primary key,
  source_listing_id text not null references public.official_listings(source_listing_id) on delete cascade,
  attachment_id bigint references public.listing_attachments(id) on delete set null,
  rule_key text not null,
  operator text not null,
  numeric_value numeric,
  text_value text,
  description text not null,
  evidence_text text not null,
  confidence numeric not null check (confidence between 0 and 1),
  analyzed_at timestamptz not null default now(),
  unique (source_listing_id, rule_key, description)
);

create table if not exists public.listing_required_documents (
  id bigint generated always as identity primary key,
  source_listing_id text not null references public.official_listings(source_listing_id) on delete cascade,
  attachment_id bigint references public.listing_attachments(id) on delete set null,
  document_name text not null,
  requirement_type text not null check (requirement_type in ('필수', '조건부', '확인 필요')),
  issuer text,
  evidence_text text not null,
  analyzed_at timestamptz not null default now(),
  unique (source_listing_id, document_name, requirement_type)
);

create index if not exists listing_rules_listing_idx on public.listing_eligibility_rules (source_listing_id);
create index if not exists listing_documents_listing_idx on public.listing_required_documents (source_listing_id);

alter table public.listing_document_analyses enable row level security;
alter table public.listing_eligibility_rules enable row level security;
alter table public.listing_required_documents enable row level security;

create policy "authenticated_read_document_analyses" on public.listing_document_analyses
  for select to authenticated using (true);
create policy "authenticated_read_eligibility_rules" on public.listing_eligibility_rules
  for select to authenticated using (true);
create policy "authenticated_read_required_documents" on public.listing_required_documents
  for select to authenticated using (true);
