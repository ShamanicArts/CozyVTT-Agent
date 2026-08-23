import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import type {
  CoreCommandSummary,
  CoreExtensionGateway,
} from "@cozyvtt/extension-sdk";

export function createCozyVttAgentMcpServer(
  capabilities: CoreExtensionGateway,
): Server {
  const server = new Server(
    { name: "cozyvtt-agent", version: "0.2.1" },
    {
      capabilities: { tools: { listChanged: false } },
      instructions:
        "Tools operate only through capabilities granted to this installed CozyVTT plugin.",
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: listTools(capabilities),
  }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      return await callTool(
        capabilities,
        request.params.name,
        request.params.arguments ?? {},
      );
    } catch (error) {
      return toolError(publicError(error));
    }
  });
  return server;
}

function listTools(capabilities: CoreExtensionGateway): Tool[] {
  return [
    ...capabilities.listQueries().map((query): Tool => ({
      name: toolName("query", query.id),
      title: query.title,
      description: query.description,
      inputSchema: objectSchema(query.inputSchema),
      outputSchema: objectSchema(query.outputSchema),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    })),
    ...capabilities.listCommands().map(commandTool),
  ];
}

async function callTool(
  capabilities: CoreExtensionGateway,
  name: string,
  value: Record<string, unknown>,
): Promise<CallToolResult> {
  const query = capabilities
    .listQueries()
    .find((entry) => toolName("query", entry.id) === name);
  if (query) return toolSuccess(await capabilities.query(query.id, value));

  const command = capabilities
    .listCommands()
    .find((entry) => toolName("command", entry.id) === name);
  if (!command) return toolError("Tool is not available to this plugin.");
  const execution = readCommandArguments(value);
  if (
    command.idempotencyRequired &&
    !validIdempotencyKey(execution.idempotencyKey)
  )
    throw new Error("A valid idempotency key is required for write tools.");
  return toolSuccess(
    await capabilities.dispatch(command.id, execution.input, {
      idempotencyKey: execution.idempotencyKey,
      approvalId: execution.approvalId,
    }),
  );
}

function commandTool(command: CoreCommandSummary): Tool {
  const properties: Record<string, object> = {
    input: objectSchema(command.inputSchema),
  };
  const required = ["input"];
  if (command.idempotencyRequired) {
    properties.idempotencyKey = {
      type: "string",
      minLength: 8,
      maxLength: 200,
    };
    required.push("idempotencyKey");
  }
  if (command.approvalRequired)
    properties.approvalId = { type: "string", minLength: 1 };
  return {
    name: toolName("command", command.id),
    title: command.title,
    description: command.description,
    inputSchema: {
      type: "object",
      properties,
      required,
      additionalProperties: false,
    },
    outputSchema: objectSchema(command.outputSchema),
    annotations: {
      readOnlyHint: false,
      destructiveHint: command.risk === "high",
      idempotentHint: command.idempotencyRequired,
      openWorldHint: command.openWorld,
    },
  };
}

function readCommandArguments(value: Record<string, unknown>): {
  input: Record<string, unknown>;
  idempotencyKey?: string;
  approvalId?: string;
} {
  if (!isRecord(value.input)) throw new Error("input must be a JSON object.");
  return {
    input: value.input,
    idempotencyKey:
      typeof value.idempotencyKey === "string" ? value.idempotencyKey : undefined,
    approvalId:
      typeof value.approvalId === "string" ? value.approvalId : undefined,
  };
}

function toolName(kind: "query" | "command", id: string): string {
  return `${kind}_${id.replace(/[^A-Za-z0-9_-]/g, "_")}`;
}

function objectSchema(value: unknown): Tool["inputSchema"] {
  return isRecord(value) && value.type === "object"
    ? (value as Tool["inputSchema"])
    : { type: "object", additionalProperties: true };
}

function validIdempotencyKey(value: string | undefined): value is string {
  return typeof value === "string" && value.length >= 8 && value.length <= 200;
}

function toolSuccess(value: unknown): CallToolResult {
  const structuredContent = isRecord(value) ? value : { result: value };
  return {
    content: [{ type: "text", text: JSON.stringify(structuredContent) }],
    structuredContent,
  };
}

function toolError(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

function publicError(error: unknown): string {
  if (
    error instanceof Error &&
    /approval|confirmation|idempotency|input must|campaign/i.test(error.message)
  )
    return error.message;
  return "The CozyVTT operation could not be completed.";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
