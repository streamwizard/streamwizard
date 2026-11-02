-- An ingest node's API key is only ever checked by its hash
-- (ingestNodeAuth). Its encrypted copy was written at claim but never read,
-- and anyone with TOKEN_ENCRYPTION_KEY could turn it back into the node's key.
-- Same change as 20261101210000 for OBS nodes; this table holds no other key
-- type, so the columns go entirely.
ALTER TABLE "public"."ingest_node_api_keys"
    DROP COLUMN "key_ciphertext",
    DROP COLUMN "key_iv",
    DROP COLUMN "key_tag";
