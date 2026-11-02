-- The node's rest_api key is only ever checked by its hash (obsNodeAuth).
-- Its encrypted copy was written at claim but never read, and anyone with
-- TOKEN_ENCRYPTION_KEY could turn it back into the node's key. Only the
-- obs_command key needs an encrypted copy: the obs-auto-switcher decrypts it
-- to call the node's /obs route.
ALTER TABLE "public"."obs_node_api_keys"
    ALTER COLUMN "key_ciphertext" DROP NOT NULL,
    ALTER COLUMN "key_iv"         DROP NOT NULL,
    ALTER COLUMN "key_tag"        DROP NOT NULL;

UPDATE "public"."obs_node_api_keys"
SET "key_ciphertext" = NULL, "key_iv" = NULL, "key_tag" = NULL
WHERE "type" = 'rest_api';

-- obs_command rows must keep the full encrypted copy; rest_api rows must not
-- have one.
ALTER TABLE "public"."obs_node_api_keys"
    ADD CONSTRAINT "obs_node_api_keys_ciphertext_by_type" CHECK (
        CASE "type"
            WHEN 'obs_command' THEN "key_ciphertext" IS NOT NULL AND "key_iv" IS NOT NULL AND "key_tag" IS NOT NULL
            ELSE "key_ciphertext" IS NULL AND "key_iv" IS NULL AND "key_tag" IS NULL
        END
    );
