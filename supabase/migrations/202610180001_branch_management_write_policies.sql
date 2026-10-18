-- Branch management write permissions
-- Apply only after review in Supabase SQL migrations.
-- RLS is intentionally retained; only active system administrators may create/update branches.
drop policy if exists branches_insert_system_admin on public.branches;
create policy branches_insert_system_admin
  on public.branches for insert to authenticated
  with check (public.is_active_system_admin());

drop policy if exists branches_update_system_admin on public.branches;
create policy branches_update_system_admin
  on public.branches for update to authenticated
  using (public.is_active_system_admin())
  with check (public.is_active_system_admin());

-- Do not add DELETE: historical branch records may be referenced by financial records.
