/**
 * SayHello Extension
 *
 * A minimal pi extension that demonstrates a custom greeting tool
 * and a `/hello` slash command.
 *
 * Usage:
 *   - LLM can call the `say_hello` tool directly
 *   - Users can run `/hello World` in the chat
 */

import { Type } from "@sinclair/typebox";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function sayhelloExtension(pi: ExtensionAPI) {
  // React to session start
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify("👋 SayHello extension loaded!", "info");
  });

  // Register a custom tool the LLM can call
  pi.registerTool({
    name: "say_hello",
    label: "Say Hello",
    description: "Send a greeting message to a named person or group. Use this tool when the user asks you to greet someone.",
    promptSnippet: "Greet someone or a group of people by name",
    parameters: Type.Object({
      name: Type.String({ description: "The name of the person or group to greet" }),
      language: Type.Optional(Type.String({ description: "Language for the greeting (e.g., 'en', 'zh', 'fr'). Defaults to English." })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const lang = (params.language || "en").toLowerCase();
      const greetings: Record<string, string> = {
        en: `Hello, ${params.name}! 👋`,
        zh: `${params.name}，你好！👋`,
        fr: `Bonjour, ${params.name}! 👋`,
        es: `¡Hola, ${params.name}! 👋`,
        ja: `${params.name}さん、こんにちは！👋`,
        de: `Hallo, ${params.name}! 👋`,
      };
      const greeting = greetings[lang] || `Hello, ${params.name}! 👋`;

      return {
        content: [{ type: "text", text: greeting }],
        details: { greeted: params.name, language: lang },
      };
    },
  });

  // Register a slash command for manual invocation
  pi.registerCommand("hello", {
    description: "Say hello to someone",
    getArgumentCompletions: (prefix) => {
      const suggestions = ["World", "pi", "Developer", "Team"] as const;
      const items = suggestions.filter((s) => s.toLowerCase().startsWith(prefix.toLowerCase()));
      return items.length > 0 ? items.map((item) => ({ value: item, label: item })) : null;
    },
    handler: async (args, ctx) => {
      const name = args.trim() || "World";
      ctx.ui.notify(`👋 Hello, ${name}!`, "info");
    },
  });
}
