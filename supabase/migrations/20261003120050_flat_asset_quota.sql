-- Media library storage is 100MB for every account, paid plans included, for
-- now. Drop the cloud_obs override (1024MB) so getUserAssetQuotaMb returns
-- null and the code default applies. The override path stays: a paid tier can
-- get more later by setting limits->storage->asset_quota_mb again.

UPDATE public.plans
SET limits = limits #- '{storage,asset_quota_mb}'
WHERE product_id = 'cloud_obs'
  AND limits #> '{storage,asset_quota_mb}' IS NOT NULL;
