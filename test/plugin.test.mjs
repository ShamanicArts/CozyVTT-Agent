import assert from "node:assert/strict";
import test from "node:test";
import { cozyVttAgentPlugin } from "../dist/index.js";

const capabilities = {
  listCommands: () => [
    {
      id: "scene.wall.add",
      version: "1",
      title: "Add wall",
      description: "Add a wall to the current scene.",
      inputSchema: { type: "object", properties: { wall: { type: "object" } } },
      outputSchema: { type: "array" },
      risk: "medium",
      approvalRequired: false,
      idempotencyRequired: true,
      openWorld: false,
      operatingRoles: ["GM"],
    },
  ],
  dispatch: async (id, input, options) => ({ id, input, options }),
  listQueries: () => [
    {
      id: "campaign.summary.get",
      version: "1",
      title: "Campaign summary",
      description: "Read the campaign summary.",
      inputSchema: { type: "object", additionalProperties: false },
      outputSchema: { type: "object" },
    },
  ],
  query: async () => ({ id: "campaign-1" }),
};

async function call(id, method, params) {
  return cozyVttAgentPlugin.httpHandlers["transport.mcp"](
    new Request("https://vtt.example/api/plugin-transports/cozyvtt.agent/mcp", {
      method: "POST",
      headers: {
        Accept: "application/json, text/event-stream",
        "Content-Type": "application/json",
        "MCP-Protocol-Version": "2025-03-26",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    }),
    {
      extensionId: "cozyvtt.agent",
      routeId: "transport.mcp",
      authorization: {
        credentialId: "credential-1",
        delegatedUserId: "user-1",
        campaignId: "campaign-1",
        resourceId: "resource.mcp",
        scopes: ["plugin.access"],
      },
      capabilities,
    },
  );
}

test("declares MCP as an OAuth-protected host transport", () => {
  assert.deepEqual(cozyVttAgentPlugin.manifest.capabilities, ["http-transports"]);
  assert.deepEqual(cozyVttAgentPlugin.manifest.httpRoutes, [
    {
      id: "transport.mcp",
      method: "POST",
      path: "/mcp",
      oauthResourceId: "resource.mcp",
      requiredScopes: ["plugin.access"],
    },
  ]);
});

test("generates and invokes MCP tools through scoped plugin capabilities", async () => {
  const listed = await call(1, "tools/list", {});
  assert.equal(listed.status, 200);
  const catalogue = await listed.json();
  assert.deepEqual(
    catalogue.result.tools.map(({ name }) => name),
    ["query_campaign_summary_get", "command_scene_wall_add"],
  );

  const invoked = await call(2, "tools/call", {
    name: "command_scene_wall_add",
    arguments: {
      input: { wall: { id: "wall-1" } },
      idempotencyKey: "request-1234",
    },
  });
  const result = await invoked.json();
  assert.deepEqual(result.result.structuredContent, {
    id: "scene.wall.add",
    input: { wall: { id: "wall-1" } },
    options: { idempotencyKey: "request-1234" },
  });
});

test("rejects invocation without host authorization and capability access", async () => {
  const response = await cozyVttAgentPlugin.httpHandlers["transport.mcp"](
    new Request("https://vtt.example/mcp", { method: "POST" }),
    { extensionId: "cozyvtt.agent", routeId: "transport.mcp" },
  );
  assert.equal(response.status, 401);
});
