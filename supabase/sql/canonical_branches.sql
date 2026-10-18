-- Canonical Zivamuntuyo branch network.
-- Preserve historical rows by deactivating superseded duplicate branches instead of hard-deleting them.
DO $$
DECLARE v_country_id uuid;
BEGIN
  SELECT country_id INTO v_country_id FROM public.branches WHERE branch_code='BUTARE' LIMIT 1;
  IF v_country_id IS NULL THEN
    RAISE EXCEPTION 'Cannot configure branches: a country_id is required from the Butare main branch';
  END IF;

  UPDATE public.branches
     SET branch_name='Butare', branch_code='BUTARE',
         address=COALESCE(address,'Main Branch / Head Office'),
         timezone='Africa/Kampala', is_head_office=true, is_active=true
   WHERE id=(SELECT id FROM public.branches WHERE branch_code='BUTARE' OR branch_name='Butare' ORDER BY is_head_office DESC, created_at ASC LIMIT 1);

  UPDATE public.branches SET branch_name='Rubirizi', branch_code='RUBIRIZI',
      timezone='Africa/Kampala', is_head_office=false, is_active=true
   WHERE id=(SELECT id FROM public.branches WHERE branch_code='RUBIRIZI' OR branch_name='Rubirizi' ORDER BY created_at ASC LIMIT 1);

  UPDATE public.branches SET branch_name='Ntungamo', branch_code='NTUNGAMO',
      timezone='Africa/Kampala', is_head_office=false, is_active=true
   WHERE id=(SELECT id FROM public.branches WHERE branch_code='NTUNGAMO' OR branch_name='Ntungamo' ORDER BY created_at ASC LIMIT 1);

  UPDATE public.branches
     SET is_active=false, is_head_office=false
   WHERE branch_name IN ('Buhwenju','Buhweju Branch','Butare Branch','Rubirizi Branch','Ntungamo Branch');

  INSERT INTO public.branches(country_id,branch_code,branch_name,timezone,is_head_office,is_active)
  SELECT v_country_id,'RUKUNGIRI','Rukungiri','Africa/Kampala',false,true
  WHERE NOT EXISTS (SELECT 1 FROM public.branches WHERE branch_code='RUKUNGIRI');
  INSERT INTO public.branches(country_id,branch_code,branch_name,timezone,is_head_office,is_active)
  SELECT v_country_id,'MITOOMA','Mitooma','Africa/Kampala',false,true
  WHERE NOT EXISTS (SELECT 1 FROM public.branches WHERE branch_code='MITOOMA');
END $$;

-- Ensure canonical rows are active even if they existed before this script.
UPDATE public.branches SET branch_name='Rukungiri', timezone='Africa/Kampala', is_head_office=false, is_active=true WHERE branch_code='RUKUNGIRI';
UPDATE public.branches SET branch_name='Mitooma', timezone='Africa/Kampala', is_head_office=false, is_active=true WHERE branch_code='MITOOMA';
