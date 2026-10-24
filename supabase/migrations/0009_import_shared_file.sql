-- A staged import batch can carry ONE shared private file (e.g. a supplier's mill-test-certificate bundle) that is attached
-- to every product created from that batch. The file lives in the private product-mtc bucket.
alter table import_batches add column if not exists shared_file_path text;
