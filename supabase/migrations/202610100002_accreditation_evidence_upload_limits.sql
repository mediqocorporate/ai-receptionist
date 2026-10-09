begin;

update storage.buckets
set
  file_size_limit = 26214400,
  allowed_mime_types = array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'image/jpeg',
    'image/png'
  ]::text[]
where id = 'accreditation-evidence';

alter table public.accreditation_evidence
  drop constraint if exists accreditation_evidence_size_bytes_check;

alter table public.accreditation_evidence
  add constraint accreditation_evidence_size_bytes_check
  check (size_bytes >= 0 and size_bytes <= 26214400);

commit;
