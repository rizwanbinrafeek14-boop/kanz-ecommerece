-- 0023 Files on quotation requests (additive). The rfq_attachments table and the private rfq-attachments bucket exist
-- since 0002 / 0004; this adds the file size and the detected type, and lets the bucket take the files buyers usually send:
-- drawings and datasheets (PDF, images) and bills of quantities (Excel, CSV, Word).
-- Uploads go through the application (a one-time signed upload URL for the holder of the RFQ's access token, at most
-- 5 files of up to 10 MB within an hour of submitting); the bucket stays private: staff read files through signed URLs.
alter table rfq_attachments
  add column if not exists size_bytes int check (size_bytes is null or size_bytes between 1 and 10485760),
  add column if not exists content_type text;
create index if not exists rfq_attachments_rfq_idx on rfq_attachments(rfq_id);

update storage.buckets set public = false, file_size_limit = 10485760, allowed_mime_types = array[
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword']
where id = 'rfq-attachments';
