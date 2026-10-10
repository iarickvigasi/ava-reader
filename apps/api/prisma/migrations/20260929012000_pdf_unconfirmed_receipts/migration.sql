ALTER TABLE "PdfProviderPayload" DROP CONSTRAINT "pdf_provider_payload_bounds";
ALTER TABLE "PdfProviderPayload" ADD CONSTRAINT "pdf_provider_payload_bounds" CHECK
 (kind IN ('REQUEST','RESPONSE','UNCONFIRMED') AND "sizeBytes">0 AND "sizeBytes"<=16777216 AND length(checksum)=64);
