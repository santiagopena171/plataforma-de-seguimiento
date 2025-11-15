-- Remove the implicit max members limit on pencas.num_participants
ALTER TABLE public.pencas
  DROP CONSTRAINT IF EXISTS pencas_num_participants_check;

ALTER TABLE public.pencas
  ADD CONSTRAINT pencas_num_participants_check
  CHECK (num_participants >= 3);

COMMENT ON COLUMN public.pencas.num_participants IS
  'Minimum 3 members/players per penca. No maximum enforced.';
