import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { defineExtension } from "@cozyvtt/extension-sdk";
import { createCozyVttAgentMcpServer } from "./mcp-server.js";

export const cozyVttAgentPlugin = defineExtension({
  manifest: {
    manifestVersion: "1.0",
    id: "cozyvtt.agent",
    name: "CozyVTT Agent",
    version: "0.2.0",
    description: "MCP transport adapter for scoped CozyVTT plugin capabilities.",
    compatibility: { extensionApi: "^1.0.0", cozyVtt: "^1.1.0" },
    capabilities: ["http-transports"],
    permissions: [
      "campaign.read",
      "campaign.write",
      "characters.read",
      "characters.write",
      "maps.read",
      "maps.write",
      "tokens.read",
      "tokens.write",
      "chat.write",
      "dice.roll",
      "assets.read",
      "assets.write",
    ],
    commands: [],
    publishedCapabilities: [],
    oauthResources: [
      { id: "resource.mcp", path: "/mcp", scopes: ["plugin.access"] },
    ],
    httpRoutes: [
      {
        id: "transport.mcp",
        method: "POST",
        path: "/mcp",
        oauthResourceId: "resource.mcp",
        requiredScopes: ["plugin.access"],
      },
    ],
  },
  httpHandlers: {
    "transport.mcp": async (request, context) => {
      if (!context.authorization || !context.capabilities)
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      const server = createCozyVttAgentMcpServer(context.capabilities);
      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });
      try {
        await server.connect(transport);
        return await transport.handleRequest(request);
      } finally {
        await transport.close().catch(() => undefined);
        await server.close().catch(() => undefined);
      }
    },
  },
});

export default cozyVttAgentPlugin;
