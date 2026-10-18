create table if not exists public.form_studio_templates (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  template_type text not null check (template_type in ('account','loan','overdraft')),
  template_name text not null check (char_length(trim(template_name)) between 1 and 120),
  template_data jsonb not null check (jsonb_typeof(template_data) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint form_studio_templates_owner_type_unique unique (created_by, template_type)
);
alter table public.form_studio_templates enable row level security;
drop policy if exists "Users read own form templates" on public.form_studio_templates;
create policy "Users read own form templates" on public.form_studio_templates for select to authenticated using ((select auth.uid()) = created_by);
drop policy if exists "Users insert own form templates" on public.form_studio_templates;
create policy "Users insert own form templates" on public.form_studio_templates for insert to authenticated with check ((select auth.uid()) = created_by);
drop policy if exists "Users update own form templates" on public.form_studio_templates;
create policy "Users update own form templates" on public.form_studio_templates for update to authenticated using ((select auth.uid()) = created_by) with check ((select auth.uid()) = created_by);
drop policy if exists "Users delete own form templates" on public.form_studio_templates;
create policy "Users delete own form templates" on public.form_studio_templates for delete to authenticated using ((select auth.uid()) = created_by);
grant select, insert, update, delete on public.form_studio_templates to authenticated;