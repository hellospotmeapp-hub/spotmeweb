-- Needs are only public once an admin approves them.
-- Keep existing needs that are clearly already live (never reviewed, or already
-- received money) visible; anything else waits in the admin Approvals tab.

UPDATE public.needs SET verification_status = 'approved'
WHERE verification_status IS NULL
   OR (verification_status = 'pending' AND (raised_amount > 0 OR status <> 'Collecting'));

ALTER TABLE public.needs ALTER COLUMN verification_status SET DEFAULT 'pending';
