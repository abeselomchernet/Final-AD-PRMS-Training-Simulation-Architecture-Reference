import { isValidBridgeSecret } from '../../../server/mcpBridge.ts';

export interface McpServiceConfig {
  nodeEnv: string;
  bridgeSecret: string;
  bridgePreviousSecret: string;
  expressBaseUrl: string;
  port: number;
  bindHost: string;
  publicHost: string;
  resourceUri: string;
  protectedResourceMetadataUrl: string;
  supabaseIssuer: string;
  jwksUri: string;
  allowLocalDevToken: boolean;
  localDevTokenSecret: string;
  publicTunnelEnabled: boolean;
  localStdioUid: string;
  localStdioClientId: string;
}

export function resolveMcpConfig(env: NodeJS.ProcessEnv = process.env): McpServiceConfig {
  const nodeEnv = (env.NODE_ENV || 'development').trim();
  const bridgeSecret = (env.MCP_INTERNAL_BRIDGE_SECRET || '').trim();
  const bridgePreviousSecret = (env.MCP_INTERNAL_BRIDGE_SECRET_PREVIOUS || '').trim();

  if (!isValidBridgeSecret(bridgeSecret)) {
    throw new Error(
      'Fail-closed startup error: MCP_INTERNAL_BRIDGE_SECRET must be configured with at least 32 characters.'
    );
  }

  const expressPort = Number(env.PORT || 3000);
  const port = Number(env.MCP_PORT || 3100);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid MCP_PORT "${env.MCP_PORT}".`);
  }
  if (port === expressPort) {
    throw new Error(`MCP_PORT (${port}) must not collide with Express PORT (${expressPort}).`);
  }

  const bindHost = (env.MCP_BIND_HOST || '127.0.0.1').trim();
  const publicHost = (env.MCP_PUBLIC_HOST || '').trim();
  const publicTunnelEnabled = String(env.MCP_PUBLIC_TUNNEL_ENABLED || 'false').toLowerCase() === 'true';
  const allowLocalDevToken = String(env.MCP_ALLOW_LOCAL_DEV_TOKEN || 'false').toLowerCase() === 'true';

  if (allowLocalDevToken) {
    if (nodeEnv === 'production') {
      throw new Error('Fail-closed startup error: MCP_ALLOW_LOCAL_DEV_TOKEN=true is forbidden when NODE_ENV=production.');
    }
    if (bindHost !== '127.0.0.1' && bindHost !== '::1') {
      throw new Error('Fail-closed startup error: MCP_ALLOW_LOCAL_DEV_TOKEN=true requires loopback MCP_BIND_HOST (127.0.0.1 or ::1).');
    }
    if (publicTunnelEnabled) {
      throw new Error('Fail-closed startup error: MCP_ALLOW_LOCAL_DEV_TOKEN=true cannot be enabled with MCP_PUBLIC_TUNNEL_ENABLED=true.');
    }
  }

  if (publicTunnelEnabled && !publicHost) {
    throw new Error('Fail-closed startup error: MCP_PUBLIC_HOST is required when MCP_PUBLIC_TUNNEL_ENABLED=true.');
  }

  const rawResourceUri = (
    env.MCP_RESOURCE_URI ||
    (publicHost ? `https://${publicHost}/mcp` : `http://127.0.0.1:${port}/mcp`)
  ).trim();

  let parsedResource: URL;
  try {
    parsedResource = new URL(rawResourceUri);
  } catch {
    throw new Error(`Invalid MCP_RESOURCE_URI "${rawResourceUri}".`);
  }

  if (parsedResource.pathname !== '/mcp' || parsedResource.search || parsedResource.hash) {
    throw new Error(
      `MCP_RESOURCE_URI "${rawResourceUri}" must end with exact path "/mcp" with no trailing slash, query, or hash.`
    );
  }
  if (publicTunnelEnabled && parsedResource.protocol !== 'https:') {
    throw new Error('MCP_RESOURCE_URI must use https:// when MCP_PUBLIC_TUNNEL_ENABLED=true.');
  }
  if (publicHost && parsedResource.hostname !== publicHost) {
    throw new Error(
      `MCP_RESOURCE_URI hostname "${parsedResource.hostname}" must match MCP_PUBLIC_HOST "${publicHost}".`
    );
  }

  const supabaseIssuer = (
    env.MCP_SUPABASE_ISSUER || 'https://vzjojdnttsfdwynumxtv.supabase.co/auth/v1'
  )
    .trim()
    .replace(/\/+$/, '');
  const jwksUri = (env.MCP_SUPABASE_JWKS_URI || `${supabaseIssuer}/.well-known/jwks.json`).trim();

  const expressBaseUrl = (env.MCP_EXPRESS_BASE_URL || `http://127.0.0.1:${expressPort}`)
    .trim()
    .replace(/\/+$/, '');

  const localDevTokenSecret = (env.MCP_LOCAL_DEV_TOKEN_SECRET || bridgeSecret).trim();

  return {
    nodeEnv,
    bridgeSecret,
    bridgePreviousSecret,
    expressBaseUrl,
    port,
    bindHost,
    publicHost,
    resourceUri: rawResourceUri,
    protectedResourceMetadataUrl: `${parsedResource.origin}/.well-known/oauth-protected-resource`,
    supabaseIssuer,
    jwksUri,
    allowLocalDevToken,
    localDevTokenSecret,
    publicTunnelEnabled,
    localStdioUid: (env.MCP_LOCAL_STDIO_UID || '').trim(),
    localStdioClientId: (env.MCP_LOCAL_STDIO_CLIENT_ID || '').trim(),
  };
}
