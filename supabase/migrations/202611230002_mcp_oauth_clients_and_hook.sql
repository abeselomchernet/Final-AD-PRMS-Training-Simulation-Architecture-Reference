-- AD-PRMS Phase 1 MCP: Registered OAuth 2.1 Client Allowlist & Custom Access Token Hook (ERR-3.1-01)
-- Preserves standard browser SPA login claims ("aud": "authenticated") while binding aud = MCP_RESOURCE_URI
-- strictly for explicitly registered, active MCP OAuth 2.1 client IDs.

CREATE TABLE IF NOT EXISTS public.mcp_oauth_clients (
  oauth_client_id TEXT PRIMARY KEY,
  client_name TEXT NOT NULL,
  resource_uri TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

REVOKE ALL ON TABLE public.mcp_oauth_clients FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  claims JSONB := COALESCE(event->'claims', '{}'::jsonb);
  auth_method TEXT := COALESCE(event->>'authentication_method', '');
  token_client_id TEXT := NULLIF(claims->>'client_id', '');
  bound_resource TEXT;
BEGIN
  -- Re-scope audience strictly for explicitly registered active MCP OAuth 2.1 clients.
  -- Preserves all documented required claims (including session_id) untouched.
  IF token_client_id IS NOT NULL THEN
    SELECT c.resource_uri INTO bound_resource
    FROM public.mcp_oauth_clients c
    WHERE c.oauth_client_id = token_client_id
      AND c.is_active = true;

    IF bound_resource IS NOT NULL THEN
      claims := jsonb_set(claims, '{aud}', to_jsonb(bound_resource), true);
      claims := jsonb_set(claims, '{mcp_auth_method}', to_jsonb(auth_method), true);
      RETURN jsonb_build_object('claims', claims);
    END IF;
  END IF;

  -- Browser SPA logins & non-MCP clients retain existing claims unchanged (aud = 'authenticated')
  RETURN jsonb_build_object('claims', claims);
END;
$$;

REVOKE ALL ON FUNCTION public.custom_access_token_hook(JSONB) FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT SELECT ON TABLE public.mcp_oauth_clients TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(JSONB) TO supabase_auth_admin;
