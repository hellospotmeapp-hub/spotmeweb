-- The old client never kept profiles.total_raised / total_given in sync.
-- Recompute them once from the source rows; new payments keep them current
-- through spotme_apply_contribution / spotme_fulfill_payment.
UPDATE public.profiles p SET
  total_raised = COALESCE((SELECT SUM(n.raised_amount) FROM public.needs n WHERE n.user_id = p.id AND n.status <> 'Deleted'), 0),
  total_given  = COALESCE((SELECT SUM(c.amount) FROM public.contributions c WHERE c.user_id = p.id), 0);
