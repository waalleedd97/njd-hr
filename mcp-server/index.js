// NJD HR MCP Server — stdio transport.
// Registers all HR admin tools backed by the production Supabase project.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { supabase, resend } from "./lib/supabase.js";
import * as helpers from "./lib/helpers.js";
import * as notify from "./lib/notify.js";

import * as employees from "./tools/employees.js";
import * as attendance from "./tools/attendance.js";
import * as leaves from "./tools/leaves.js";
import * as requests from "./tools/requests.js";
import * as invitations from "./tools/invitations.js";
import * as payroll from "./tools/payroll.js";
import * as reports from "./tools/reports.js";
import * as settings from "./tools/settings.js";

const server = new McpServer({
  name: "njd-hr",
  version: "1.0.0",
});

const ctx = { supabase, resend, helpers, notify };

employees.register(server, ctx);
attendance.register(server, ctx);
leaves.register(server, ctx);
requests.register(server, ctx);
invitations.register(server, ctx);
payroll.register(server, ctx);
reports.register(server, ctx);
settings.register(server, ctx);

const transport = new StdioServerTransport();
await server.connect(transport);
