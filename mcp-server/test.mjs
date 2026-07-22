// Smoke test: spawn the MCP server over stdio, list tools, and call
// get_dashboard_stats + list_employees against the LIVE Supabase project.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "node",
  args: ["index.js"],
  stderr: "inherit",
});

const client = new Client({ name: "njd-hr-mcp-test", version: "1.0.0" });

try {
  await client.connect(transport);

  const { tools } = await client.listTools();
  console.log(`\n=== Registered tools (${tools.length}) ===`);
  for (const t of tools) console.log(`  - ${t.name}`);

  console.log("\n=== get_dashboard_stats ===");
  const stats = await client.callTool({ name: "get_dashboard_stats", arguments: {} });
  console.log(stats.content[0].text);
  if (stats.isError) throw new Error("get_dashboard_stats returned isError");

  console.log("\n=== list_employees ===");
  const emps = await client.callTool({ name: "list_employees", arguments: {} });
  const parsed = JSON.parse(emps.content[0].text);
  console.log(`count: ${parsed.count}`);
  for (const e of parsed.employees.slice(0, 10)) {
    console.log(`  - ${e.email} | ${e.nameEn || "-"} / ${e.nameAr || "-"} | ${e.role}`);
  }
  if (emps.isError || typeof parsed.count !== "number") {
    throw new Error("list_employees failed");
  }

  console.log("\nOK — live data received from production Supabase.");
} catch (err) {
  console.error("\nTEST FAILED:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await client.close();
}
