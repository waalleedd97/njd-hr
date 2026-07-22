// One-off write-path verification: calls the real send_notification tool over MCP stdio.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import { fileURLToPath } from "node:url";

const transport = new StdioClientTransport({
  command: "node",
  args: ["index.js"],
  cwd: fileURLToPath(new URL(".", import.meta.url)),
});
const client = new Client({ name: "write-test", version: "0.0.1" });
await client.connect(transport);

const result = await client.callTool({
  name: "send_notification",
  arguments: {
    target: "employee",
    email: "waleed@njdstudio.net",
    type: "system",
    title_ar: "اختبار سيرفر MCP",
    title_en: "MCP server test",
    body_ar: "تم إرسال هذا الإشعار عبر سيرفر MCP للتحقق من مسار الكتابة. يمكن تجاهله.",
    body_en: "This notification was sent via the MCP server to verify the write path. Safe to ignore.",
    link: "/",
  },
});
console.log(JSON.stringify(result, null, 2));
await client.close();
