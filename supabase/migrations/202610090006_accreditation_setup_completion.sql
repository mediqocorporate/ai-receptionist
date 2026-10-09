begin;

alter table public.accreditation_practice_profiles
  drop constraint if exists accreditation_practice_profiles_journey_status_check;

alter table public.accreditation_practice_profiles
  add constraint accreditation_practice_profiles_journey_status_check
  check (journey_status in ('FIRST_ACCREDITATION','REACCREDITATION','CURRENTLY_ACCREDITED','ASSESSMENT_BOOKED','NOT_SURE'));

commit;
