-- Only the explicitly approved exact Flash model gains a $15 cumulative ceiling.
-- Atomic replacement preserves the $10 default, existing rows and all accounting guards.
ALTER TABLE "PdfProviderBudget"
  DROP CONSTRAINT "pdf_provider_model_ceiling",
  ADD CONSTRAINT "pdf_provider_model_ceiling" CHECK
    (scope<>'MODEL' OR "hardCeilingNano"<=CASE
      WHEN "scopeKey"='google/gemini-3.8-flash' THEN 15000000000 ELSE 10000000000 END);
