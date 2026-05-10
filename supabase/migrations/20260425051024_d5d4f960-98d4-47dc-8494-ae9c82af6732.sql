-- Prevent the same UPI transaction id from being submitted twice in funnel_payments
CREATE UNIQUE INDEX IF NOT EXISTS uniq_funnel_payments_upi_txn
  ON public.funnel_payments (lower(upi_transaction_id))
  WHERE upi_transaction_id IS NOT NULL AND length(trim(upi_transaction_id)) > 0;

-- Prevent the same UPI transaction id from being submitted twice in live_registrations
CREATE UNIQUE INDEX IF NOT EXISTS uniq_live_registrations_upi_txn
  ON public.live_registrations (lower(upi_transaction_id))
  WHERE upi_transaction_id IS NOT NULL AND length(trim(upi_transaction_id)) > 0;