UPDATE public.classifications
SET status = 'failed',
    retake_reason_sv = COALESCE(retake_reason_sv, 'AI-tjänsten svarade inte. Försök igen.')
WHERE id IN ('ae220ec1-0b3f-4ad8-b159-a6f81e0bd737','be411ef9-1851-4641-be3c-1ffe37705516')
  AND status = 'processing';