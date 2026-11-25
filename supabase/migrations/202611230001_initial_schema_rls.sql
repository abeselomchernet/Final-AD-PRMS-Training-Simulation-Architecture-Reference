-- AD-PRMS Initial Supabase PostgreSQL Schema & Strict Row-Level Security (RLS)
-- Idempotent migration replacing legacy Firebase/Firestore configuration.

CREATE TABLE IF NOT EXISTS public.users (
  uid UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 120),
  role TEXT NOT NULL DEFAULT 'User' CHECK (
    role IN (
      'Owner / Director',
      'General Manager',
      'Assistant Manager',
      'Finance Officer',
      'Clerk',
      'Collections Clerk',
      'Property Clerk',
      'System Administrator',
      'Auditor / Read-only reviewer',
      'Training Coordinator',
      'User'
    )
  ),
  allowed_owners TEXT[] NOT NULL DEFAULT ARRAY['OWN-ALPHA'],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_private_info (
  uid UUID PRIMARY KEY REFERENCES public.users(uid) ON DELETE CASCADE,
  email TEXT NOT NULL CHECK (char_length(email) BETWEEN 3 AND 254),
  phone_msisdn TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.admins (
  uid UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.workspaces (
  id TEXT PRIMARY KEY CHECK (id ~ '^[a-zA-Z0-9_-]{1,128}$'),
  owner_uid UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  active_owner_id TEXT NOT NULL CHECK (active_owner_id IN ('OWN-ALPHA', 'OWN-BETA')),
  updated_by_uid UUID NOT NULL REFERENCES auth.users(id),
  revision BIGINT NOT NULL DEFAULT 1 CHECK (revision >= 0 AND revision <= 1000000000),
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_events (
  id TEXT NOT NULL CHECK (id ~ '^[a-zA-Z0-9_-]{1,128}$'),
  workspace_id TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  owner_uid UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_entity_id TEXT NOT NULL CHECK (owner_entity_id IN ('OWN-ALPHA', 'OWN-BETA')),
  actor TEXT NOT NULL CHECK (char_length(actor) BETWEEN 1 AND 120),
  action TEXT NOT NULL CHECK (char_length(action) BETWEEN 1 AND 160),
  sha256_hash TEXT NOT NULL CHECK (char_length(sha256_hash) BETWEEN 1 AND 128),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, id)
);

CREATE TABLE IF NOT EXISTS public.period_closures (
  id TEXT PRIMARY KEY CHECK (id ~ '^[a-zA-Z0-9_-]{1,128}$'),
  workspace_id TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  owner_uid UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_entity_id TEXT NOT NULL CHECK (owner_entity_id IN ('OWN-ALPHA', 'OWN-BETA')),
  period_code TEXT NOT NULL CHECK (char_length(period_code) BETWEEN 1 AND 16),
  trial_balance_debit_cents BIGINT NOT NULL CHECK (trial_balance_debit_cents >= 0),
  trial_balance_credit_cents BIGINT NOT NULL CHECK (trial_balance_credit_cents >= 0),
  journal_count INTEGER NOT NULL CHECK (journal_count >= 0),
  closed_by_actor TEXT NOT NULL CHECK (char_length(closed_by_actor) BETWEEN 1 AND 120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_period_closure_balanced CHECK (trial_balance_debit_cents = trial_balance_credit_cents),
  UNIQUE (workspace_id, owner_entity_id, period_code)
);

CREATE TABLE IF NOT EXISTS public.payments (
  id TEXT PRIMARY KEY CHECK (id ~ '^[a-zA-Z0-9_-]{1,128}$'),
  workspace_id TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  owner_uid UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_entity_id TEXT NOT NULL CHECK (owner_entity_id IN ('OWN-ALPHA', 'OWN-BETA')),
  gateway TEXT NOT NULL CHECK (gateway IN ('Telebirr', 'ArifPay', 'CBE', 'Cash', 'Cheque')),
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Verified', 'Failed', 'Expired', 'Reversed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_uid UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_entity_id TEXT NOT NULL CHECK (owner_entity_id IN ('OWN-ALPHA', 'OWN-BETA')),
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  device_label TEXT NOT NULL DEFAULT 'Browser',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance & RLS Lookup Indexes
CREATE INDEX IF NOT EXISTS idx_workspaces_owner_uid ON public.workspaces (owner_uid);
CREATE INDEX IF NOT EXISTS idx_audit_events_owner_uid_created ON public.audit_events (owner_uid, owner_entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_period_closures_owner_uid ON public.period_closures (owner_uid, owner_entity_id, period_code);
CREATE INDEX IF NOT EXISTS idx_payments_owner_entity ON public.payments (owner_uid, owner_entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_owner ON public.push_subscriptions (owner_uid, owner_entity_id);

-- Enforce strict RLS on every table (zero unauthenticated or cross-owner access)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_private_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_private_info FORCE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins FORCE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.period_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.period_closures FORCE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions FORCE ROW LEVEL SECURITY;

-- Helper predicates with schema-qualified references
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admins a WHERE a.uid = (SELECT auth.uid())
  ) OR COALESCE(((SELECT auth.jwt()) -> 'app_metadata' ->> 'admin')::boolean, false);
$$;

-- Users policies
DROP POLICY IF EXISTS users_select_own ON public.users;
CREATE POLICY users_select_own ON public.users
  FOR SELECT TO authenticated
  USING (uid = (SELECT auth.uid()) OR public.is_platform_admin());

DROP POLICY IF EXISTS users_insert_own ON public.users;
CREATE POLICY users_insert_own ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (uid = (SELECT auth.uid()) AND role = 'User');

DROP POLICY IF EXISTS users_update_own ON public.users;
CREATE POLICY users_update_own ON public.users
  FOR UPDATE TO authenticated
  USING (uid = (SELECT auth.uid()) OR public.is_platform_admin())
  WITH CHECK (uid = (SELECT auth.uid()) OR public.is_platform_admin());

-- Private info policies
DROP POLICY IF EXISTS user_private_info_own ON public.user_private_info;
CREATE POLICY user_private_info_own ON public.user_private_info
  FOR ALL TO authenticated
  USING (uid = (SELECT auth.uid()) OR public.is_platform_admin())
  WITH CHECK (uid = (SELECT auth.uid()));

-- Admins table: read-only self check; writes via service role only
DROP POLICY IF EXISTS admins_select_self ON public.admins;
CREATE POLICY admins_select_self ON public.admins
  FOR SELECT TO authenticated
  USING (uid = (SELECT auth.uid()) OR public.is_platform_admin());

-- Workspaces policies (strict owner_uid boundary)
DROP POLICY IF EXISTS workspaces_owner_select ON public.workspaces;
CREATE POLICY workspaces_owner_select ON public.workspaces
  FOR SELECT TO authenticated
  USING (owner_uid = (SELECT auth.uid()) OR public.is_platform_admin());

DROP POLICY IF EXISTS workspaces_owner_insert ON public.workspaces;
CREATE POLICY workspaces_owner_insert ON public.workspaces
  FOR INSERT TO authenticated
  WITH CHECK (owner_uid = (SELECT auth.uid()) AND updated_by_uid = (SELECT auth.uid()));

DROP POLICY IF EXISTS workspaces_owner_update ON public.workspaces;
CREATE POLICY workspaces_owner_update ON public.workspaces
  FOR UPDATE TO authenticated
  USING (owner_uid = (SELECT auth.uid()) OR public.is_platform_admin())
  WITH CHECK (owner_uid = (SELECT auth.uid()) AND updated_by_uid = (SELECT auth.uid()));

-- Audit events: append-only (SELECT + INSERT only; zero UPDATE/DELETE)
DROP POLICY IF EXISTS audit_events_owner_select ON public.audit_events;
CREATE POLICY audit_events_owner_select ON public.audit_events
  FOR SELECT TO authenticated
  USING (owner_uid = (SELECT auth.uid()) OR public.is_platform_admin());

DROP POLICY IF EXISTS audit_events_owner_insert ON public.audit_events;
CREATE POLICY audit_events_owner_insert ON public.audit_events
  FOR INSERT TO authenticated
  WITH CHECK (owner_uid = (SELECT auth.uid()));

-- Period closures: append-only balanced closures
DROP POLICY IF EXISTS period_closures_owner_select ON public.period_closures;
CREATE POLICY period_closures_owner_select ON public.period_closures
  FOR SELECT TO authenticated
  USING (owner_uid = (SELECT auth.uid()) OR public.is_platform_admin());

DROP POLICY IF EXISTS period_closures_owner_insert ON public.period_closures;
CREATE POLICY period_closures_owner_insert ON public.period_closures
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_uid = (SELECT auth.uid())
    AND trial_balance_debit_cents = trial_balance_credit_cents
  );

-- Payments policies
DROP POLICY IF EXISTS payments_owner_all ON public.payments;
CREATE POLICY payments_owner_all ON public.payments
  FOR ALL TO authenticated
  USING (owner_uid = (SELECT auth.uid()) OR public.is_platform_admin())
  WITH CHECK (owner_uid = (SELECT auth.uid()));

-- Push subscriptions policies
DROP POLICY IF EXISTS push_subscriptions_owner_all ON public.push_subscriptions;
CREATE POLICY push_subscriptions_owner_all ON public.push_subscriptions
  FOR ALL TO authenticated
  USING (owner_uid = (SELECT auth.uid()))
  WITH CHECK (owner_uid = (SELECT auth.uid()));

-- Atomic RPC for period closure + audit event inside a single transaction
CREATE OR REPLACE FUNCTION public.close_fiscal_period(
  p_workspace_id TEXT,
  p_owner_entity_id TEXT,
  p_period_code TEXT,
  p_debit_cents BIGINT,
  p_credit_cents BIGINT,
  p_journal_count INTEGER,
  p_closed_by_actor TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := (SELECT auth.uid());
  v_closure_id TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF p_debit_cents < 0 OR p_debit_cents <> p_credit_cents THEN
    RAISE EXCEPTION 'Trial balance imbalance: debit (%) must equal credit (%)', p_debit_cents, p_credit_cents;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.workspaces w WHERE w.id = p_workspace_id AND w.owner_uid = v_uid
  ) THEN
    RAISE EXCEPTION 'Workspace not found or unauthorized';
  END IF;

  v_closure_id := 'CLS-' || p_owner_entity_id || '-' || p_period_code || '-' || floor(extract(epoch FROM now()) * 1000)::bigint;

  INSERT INTO public.period_closures (
    id, workspace_id, owner_uid, owner_entity_id, period_code,
    trial_balance_debit_cents, trial_balance_credit_cents, journal_count, closed_by_actor
  ) VALUES (
    v_closure_id, p_workspace_id, v_uid, p_owner_entity_id, p_period_code,
    p_debit_cents, p_credit_cents, p_journal_count, p_closed_by_actor
  );

  INSERT INTO public.audit_events (
    id, workspace_id, owner_uid, owner_entity_id, actor, action, sha256_hash
  ) VALUES (
    'AUD-' || floor(extract(epoch FROM now()) * 1000)::bigint,
    p_workspace_id,
    v_uid,
    p_owner_entity_id,
    p_closed_by_actor,
    'Period Closed: ' || p_period_code,
    v_closure_id
  );

  RETURN v_closure_id;
END;
$$;
