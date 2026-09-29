-- Adds the per-VM alert opt-ins to the alert-worker's tick snapshot
-- (docs/proxmox-monitoring-plan.md). Everything else in
-- alert_worker_tick_snapshot is unchanged from 20260816100000_alert_worker_tick_rpcs;
-- the worker's zod schema defaults the new key to [] so it keeps parsing a
-- database that hasn't run this migration yet.

CREATE OR REPLACE FUNCTION public.alert_worker_tick_snapshot(
  p_env               text,
  p_lock_name         text,
  p_lock_ttl_seconds  integer,
  p_owner             text
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  IF p_lock_name IS NOT NULL THEN
    -- Insert-or-steal in one statement: a fresh row wins, an expired lease
    -- (a pass that crashed without releasing) is taken over, a live lease
    -- updates nothing and FOUND stays false. Mirrors the semantics the
    -- worker previously implemented client-side in tryAcquireAlertLock.
    INSERT INTO public.alert_locks (name, locked_at, expires_at, locked_by)
    VALUES (p_lock_name, now(), now() + make_interval(secs => p_lock_ttl_seconds), p_owner)
    ON CONFLICT (name) DO UPDATE
      SET locked_at  = EXCLUDED.locked_at,
          expires_at = EXCLUDED.expires_at,
          locked_by  = EXCLUDED.locked_by
      WHERE public.alert_locks.expires_at < now();

    IF NOT FOUND THEN
      RETURN jsonb_build_object('locked', false);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'locked', true,
    'obs_nodes', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
         'id', n.id, 'name', n.name, 'status', n.status,
         'maintenance', n.maintenance, 'created_at', n.created_at,
         'api_url', n.api_url))
       FROM public.obs_nodes n),
      '[]'::jsonb),
    'ingest_nodes', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
         'id', n.id, 'name', n.name, 'status', n.status,
         'maintenance', n.maintenance, 'created_at', n.created_at,
         'tailscale_ip', n.tailscale_ip))
       FROM public.ingest_nodes n),
      '[]'::jsonb),
    'live_ingest_sessions', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('id', s.id, 'started_at', s.started_at))
       FROM public.ingest_sessions s
       WHERE s.ended_at IS NULL),
      '[]'::jsonb),
    -- EXISTS, not count: the only consumer short-circuits on "nobody live"
    -- and never reads the number.
    'any_channel_live',
      EXISTS (SELECT 1 FROM public.broadcaster_live_status WHERE is_live),
    'rule_configs', COALESCE(
      (SELECT jsonb_agg(to_jsonb(rc)) FROM public.alert_rule_config rc),
      '[]'::jsonb),
    -- Filtered server-side; the worker previously downloaded every env's row
    -- and picked its own client-side.
    'notification_config',
      (SELECT to_jsonb(nc) FROM public.alert_notification_config nc
       WHERE nc.env = p_env),
    'alert_states', COALESCE(
      (SELECT jsonb_agg(to_jsonb(st)) FROM public.alert_state st
       WHERE st.env = p_env),
      '[]'::jsonb),
    -- Proxmox VM alert opt-ins (20260929150000_proxmox_vms). VM state
    -- itself comes from Influx in the vm.* rules.
    -- Only VMs with at least one rule switched on; no row = no alerts.
    'proxmox_vm_alert_settings', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
         'host', s.host, 'vmid', s.vmid, 'rules', s.rules))
       FROM public.proxmox_vm_alert_settings s
       WHERE cardinality(s.rules) > 0),
      '[]'::jsonb)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.alert_worker_tick_snapshot(text, text, integer, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.alert_worker_tick_snapshot(text, text, integer, text)
  TO service_role;
