begin;

insert into public.accreditation_agencies (id, name, is_active)
values
  ('achs', 'Australian Council on Healthcare Standards (ACHS)', true),
  ('agpal', 'AGPAL Group of Companies', true),
  ('global-mark', 'Global Mark Pty Ltd', true),
  ('qpa', 'Quality Practice Accreditation (QPA)', true)
on conflict (id) do update set
  name = excluded.name,
  is_active = true;

commit;
