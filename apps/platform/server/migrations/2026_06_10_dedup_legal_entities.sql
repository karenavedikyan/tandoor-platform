-- Data-fix: collapse duplicate legal_entities created 2026-06-10 (empty INN dup rows).
-- Strategy: per (client_id, normalized name) keep the best row (INN+code+most-filled),
-- archive the rest (is_archived=true, status='archived'). Reversible. Events preserved.
-- Also promote the kept row to 'main' if the group previously had a main entity.

BEGIN;

-- 1. Promote хачкиев keeper (filled INN+code) to main (group had a main on an empty dup).
UPDATE legal_entities
SET status = 'main', updated_at = NOW()
WHERE id = '45535e92-2a44-4d42-a2df-042ac7a8a844'::uuid;

-- 2. Archive the 12 duplicate (empty) rows.
UPDATE legal_entities
SET is_archived = true, status = 'archived', updated_at = NOW()
WHERE id IN (
  -- client-ma-ma118806 (игошев) — keep 8f93bd53 (main)
  'd9ce5f57-f9cb-41aa-8ce9-ef8210f0b7bc',
  '03e17a2a-bc8e-4208-960c-c8eb1ad7fe9e',
  '9aef1a15-7544-4648-8319-ab389474187d',
  -- client-ma0002809 (хачкиев) — keep 45535e92 (filled, promoted to main)
  '45c259dc-4c24-4591-99ec-ee467d9e1a99',
  '861bcee4-52fb-4f88-9fde-22705309cf11',
  'caded92b-0ead-4f49-b26a-4c20b3c3c6f8',
  '01417079-106e-4df4-8d9b-f8af595ed5e3',
  '47e76449-b20e-4216-ac7f-c9cd9b549595',
  '80cd9ff6-3524-49ea-8df9-c31bd40acd42',
  -- client-ma-ma074652 (кузнецов) — keep 22bd35c8 (main)
  'c6fcf2e7-8217-4b1a-ad70-962ff50f70fe',
  'a340ab65-fba2-4a60-bdd2-9fca6cb7954b',
  'dc90e2fa-5c6b-4150-8165-b0601a213e28'
);

COMMIT;
