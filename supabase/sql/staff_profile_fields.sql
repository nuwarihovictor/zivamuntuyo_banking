-- Extend employee profiles for the staff directory. Sensitive national IDs are not shown to ordinary staff.
ALTER TABLE public.employee_profiles
  ADD COLUMN IF NOT EXISTS sex text,
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS national_id text,
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS employment_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS job_title text,
  ADD COLUMN IF NOT EXISTS start_date date;

ALTER TABLE public.employee_profiles
  DROP CONSTRAINT IF EXISTS employee_profiles_sex_check,
  DROP CONSTRAINT IF EXISTS employee_profiles_employment_status_check;

ALTER TABLE public.employee_profiles
  ADD CONSTRAINT employee_profiles_sex_check
    CHECK (sex IS NULL OR sex IN ('female','male','other','prefer_not_to_say')),
  ADD CONSTRAINT employee_profiles_employment_status_check
    CHECK (employment_status IN ('active','probation','on_leave','suspended','terminated','inactive')),
  ADD CONSTRAINT employee_profiles_photo_url_check
    CHECK (photo_url IS NULL OR photo_url ~ '^https://');

CREATE INDEX IF NOT EXISTS employee_profiles_status_branch_idx
  ON public.employee_profiles(home_branch_id, employment_status);
