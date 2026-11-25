import 'dotenv/config';
import path from 'node:path';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { VerifiedBridgeIdentity } from '../../../server/mcpBridge.ts';
import { ExpressBridgeClient } from './bridgeClient.ts';
import { resolveMcpConfig } from './config.ts';
import { createAdprmsMcpServer, createMcpHttpApp } from './server.ts';

function resolveTransportMode(argv: string[]): 'http' | 'stdio' {
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--transport=stdio' || (arg === '--transport' && argv[i + 1] === 'stdio')) {
      return 'stdio';
    }
  }
  return 'http';
}

async function main(): Promise<void> {
  const mode = resolveTransportMode(process.argv.slice(2));
  const config = resolveMcpConfig(process.env);

  if (mode === 'stdio') {
    if (!config.localStdioUid || !config.localStdioClientId) {
      throw new Error(
        'Fail-closed stdio startup error: MCP_LOCAL_STDIO_UID and MCP_LOCAL_STDIO_CLIENT_ID are required for --transport=stdio.'
      );
    }
    const bridgeClient = new ExpressBridgeClient(config);
    const getStdioIdentity = (): VerifiedBridgeIdentity => ({
      authMode: 'LOCAL_STDIO',
      supabaseUid: config.localStdioUid,
      clientId: config.localStdioClientId,
      tokenIat: Math.floor(Date.now() / 1000),
      jti: null,
    });
    const server = createAdprmsMcpServer(bridgeClient, getStdioIdentity);
    const transport = new StdioServerTransport();
    await server.connect(transport);
    return;
  }

  const { app } = createMcpHttpApp(config);
  app.listen(config.port, config.bindHost, () => {
    console.log(
      `AD-PRMS Standalone MCP Server listening on http://${config.bindHost}:${config.port}/mcp (resource=${config.resourceUri})`
    );
  });
}

const isMainEntry =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(import.meta.filename);

if (isMainEntry) {
  main().catch((err) => {
    console.error('AD-PRMS MCP service startup failed:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
