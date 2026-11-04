-- Node API keys are checked by their hash only (obsNodeAuth, ingestNodeAuth).
-- The claim routes stop writing an encrypted copy of the rest_api key and the
-- ingest node key, so the ciphertext columns become nullable and the copies
-- that exist are cleared. obs_command keys keep theirs: the obs-auto-switcher
-- decrypts it to call the node's /obs route.
--
-- This step only relaxes the schema, so the rest-api that still writes the
-- ciphertext keeps working until the new one is deployed. The check
-- constraint on obs_node_api_keys and the drop of the ingest node columns
-- follow in a later migration, after that deploy.
ALTER TABLE "public"."obs_node_api_keys"
    ALTER COLUMN "key_ciphertext" DROP NOT NULL,
    ALTER COLUMN "key_iv"         DROP NOT NULL,
    ALTER COLUMN "key_tag"        DROP NOT NULL;

UPDATE "public"."obs_node_api_keys"
SET "key_ciphertext" = NULL, "key_iv" = NULL, "key_tag" = NULL
WHERE "type" = 'rest_api'
  AND ("key_ciphertext" IS NOT NULL OR "key_iv" IS NOT NULL OR "key_tag" IS NOT NULL);

-- Guarded so a local DB that already dropped these columns can re-apply it.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'ingest_node_api_keys'
          AND column_name = 'key_ciphertext'
    ) THEN
        ALTER TABLE "public"."ingest_node_api_keys"
            ALTER COLUMN "key_ciphertext" DROP NOT NULL,
            ALTER COLUMN "key_iv"         DROP NOT NULL,
            ALTER COLUMN "key_tag"        DROP NOT NULL;

        UPDATE "public"."ingest_node_api_keys"
        SET "key_ciphertext" = NULL, "key_iv" = NULL, "key_tag" = NULL
        WHERE "key_ciphertext" IS NOT NULL OR "key_iv" IS NOT NULL OR "key_tag" IS NOT NULL;
    END IF;
END
$$;
