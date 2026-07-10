-- Remove the unused analytics schema entirely. Both tables (analytics.followers
-- and analytics.streams) were empty with no inbound foreign keys from other schemas.
-- Also clears the no_primary_key and unindexed_foreign_key advisories that were on
-- analytics.followers.
DROP SCHEMA analytics CASCADE;
