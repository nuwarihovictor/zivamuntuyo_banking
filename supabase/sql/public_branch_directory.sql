-- Minimal public branch directory for the unauthenticated branch-selection landing page.
-- Only active branch identifiers and display labels are exposed; no staff, account, or balance data.
create or replace view public.branch_directory_public
with (security_barrier=true)
as
select id, branch_code, branch_name, is_head_office
from public.branches
where is_active=true;
revoke all on public.branch_directory_public from public;
grant select on public.branch_directory_public to anon, authenticated;