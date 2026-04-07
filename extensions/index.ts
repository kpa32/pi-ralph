/**
 * Ralph Wiggum - Simplified workflow for iterative development.
 * Adapted for pi-ralph workflow: plan/build modes with template management.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RALPH_DIR = ".ralph";
const COMPLETE_MARKER = "<promise>COMPLETE</promise>";

type LoopStatus = "active" | "completed";
type RalphMode = "plan" | "build";

interface LoopState {
	mode: RalphMode;
	iteration: number;
	maxIterations: number;
	startedAt: string;
	completedAt?: string;
	status: LoopStatus;
}

const STATUS_ICONS: Record<LoopStatus, string> = { active: "▶", completed: "✓" };

export default function (pi: ExtensionAPI) {
	let currentLoop: RalphMode | null = null;

	// --- File helpers ---

	const ralphDir = (ctx: ExtensionContext) => path.resolve(ctx.cwd, RALPH_DIR);
	const sanitize = (name: string) => name.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_+/g, "_");

	function ensureDir(filePath: string): void {
		const dir = path.dirname(filePath);
		if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
	}

	function tryRead(filePath: string): string | null {
		try {
			return fs.readFileSync(filePath, "utf-8");
		} catch {
			return null;
		}
	}

	function getStatePath(ctx: ExtensionContext, mode: RalphMode): string {
		return path.join(ralphDir(ctx), `${mode}.state.json`);
	}

	// --- State management ---

	function migrateState(raw: any): LoopState {
		// Migrate from old format if needed
		if (raw.mode === undefined) {
			// Assume old format, create new state
			return {
				mode: "plan", // default
				iteration: raw.iteration || 1,
				maxIterations: raw.maxIterations || 50,
				startedAt: raw.startedAt || new Date().toISOString(),
				completedAt: raw.completedAt,
				status: raw.status === "completed" ? "completed" : "active",
			};
		}
		return raw as LoopState;
	}

	function loadState(ctx: ExtensionContext, mode: RalphMode): LoopState | null {
		const content = tryRead(getStatePath(ctx, mode));
		return content ? migrateState(JSON.parse(content)) : null;
	}

	function saveState(ctx: ExtensionContext, state: LoopState): void {
		const filePath = getStatePath(ctx, state.mode);
		ensureDir(filePath);
		fs.writeFileSync(filePath, JSON.stringify(state, null, 2), "utf-8");
	}

	// --- UI ---

	function updateUI(ctx: ExtensionContext): void {
		if (!ctx.hasUI) return;

		if (!currentLoop) {
			ctx.ui.setStatus("ralph", undefined);
			ctx.ui.setWidget("ralph", undefined);
			return;
		}

		const state = loadState(ctx, currentLoop);
		if (!state) return;

		const { theme } = ctx.ui;
		const maxStr = state.maxIterations > 0 ? `/${state.maxIterations}` : "";

		ctx.ui.setStatus("ralph", theme.fg("accent", `🔄 ${state.mode} (${state.iteration}${maxStr})`));

		const lines = [
			theme.fg("accent", theme.bold("Ralph Wiggum")),
			theme.fg("muted", `模式: ${state.mode}`),
			theme.fg("dim", `状态: ${STATUS_ICONS[state.status]} ${state.status === "active" ? "活跃" : "完成"}`),
			theme.fg("dim", `迭代: ${state.iteration}${maxStr}`),
			theme.fg("dim", `开始: ${state.startedAt.slice(0, 10)}`),
		];
		lines.push("");
		lines.push(theme.fg("warning", "ESC 暂停助手"));
		lines.push(theme.fg("warning", "发送消息继续; /ralph stop 结束循环"));
		ctx.ui.setWidget("ralph", lines);
	}

	// --- Template helpers ---

	function copyTemplates(ctx: ExtensionContext, force = false): boolean {
		// Get extension directory (where this file is located)
		const sourceRalph = path.join(__dirname, ".ralph");
		const sourceDoc = path.join(__dirname, "doc");
		const targetRalph = ralphDir(ctx);
		const targetDoc = path.resolve(ctx.cwd, "doc");

		function copyDir(source: string, target: string): boolean {
			try {
				if (!fs.existsSync(source)) {
					ctx.ui.notify(`源目录不存在: ${source}`, "error");
					return false;
				}
				// 确保目标目录存在
				if (!fs.existsSync(target)) {
					fs.mkdirSync(target, { recursive: true });
				}
				const entries = fs.readdirSync(source, { withFileTypes: true });
				for (const entry of entries) {
					const srcPath = path.join(source, entry.name);
					const dstPath = path.join(target, entry.name);
					if (entry.isDirectory()) {
						// 对于子目录，递归复制
						copyDir(srcPath, dstPath);
					} else {
						// 对于文件，确保目标目录存在然后复制
						try {
							ensureDir(dstPath);
							if (!force && fs.existsSync(dstPath)) continue;
							fs.copyFileSync(srcPath, dstPath);
						} catch (err: any) {
							ctx.ui.notify(`复制文件失败: ${entry.name}\n源: ${srcPath}\n目标: ${dstPath}\n错误: ${err.message}`, "error");
							return false;
						}
					}
				}
				return true;
			} catch (err: any) {
				ctx.ui.notify(`复制目录失败: ${source} -> ${target}\n错误: ${err.message}`, "error");
				return false;
			}
		}

		const ralphOk = copyDir(sourceRalph, targetRalph);
		const docOk = copyDir(sourceDoc, targetDoc);
		return ralphOk && docOk;
	}

	function getPromptForMode(mode: RalphMode): string {
		const promptFile = mode === "plan" ? "ralph_plan.md" : "ralph_build.md";
		const promptPath = path.join(__dirname, ".ralph", promptFile);
		try {
			return fs.readFileSync(promptPath, "utf-8");
		} catch (err: any) {
			return `# ${mode.toUpperCase()} 模式\n\n错误加载提示词文件: ${promptFile}\n${err.message}`;
		}
	}

	function listDocFiles(ctx: ExtensionContext): string[] {
		const docDir = path.resolve(ctx.cwd, "doc");
		try {
			if (!fs.existsSync(docDir)) return [];
			return fs.readdirSync(docDir).filter(f => f.endsWith(".md"));
		} catch {
			return [];
		}
	}

	// --- Arg parsing ---

	function parseArgs(argsStr: string) {
		const tokens = argsStr.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
		const result = {
			maxIterations: 50,
		};

		for (let i = 0; i < tokens.length; i++) {
			const tok = tokens[i];
			const next = tokens[i + 1];
			if (tok === "--max-iterations" && next) {
				result.maxIterations = parseInt(next, 10) || 0;
				i++;
			}
		}
		return result;
	}

	// --- Commands ---

	const commands: Record<string, (rest: string, ctx: ExtensionContext) => void> = {
		init(rest, ctx) {
			const force = rest.trim() === "--force";
			const ok = copyTemplates(ctx, force);
			if (ok) {
				ctx.ui.notify("模板文件已复制到当前项目。", "info");
			} else {
				ctx.ui.notify("复制模板文件时出错。", "error");
			}
		},

		plan(rest, ctx) {
			const args = parseArgs(rest);
			// Stop current loop if any
			if (currentLoop) {
				const state = loadState(ctx, currentLoop);
				if (state && state.status === "active") {
					state.status = "completed";
					state.completedAt = new Date().toISOString();
					saveState(ctx, state);
				}
				currentLoop = null;
			}
			// Check if plan already active
			const existing = loadState(ctx, "plan");
			if (existing?.status === "active") {
				ctx.ui.notify("Plan 循环已在运行中。使用 /ralph stop 停止。", "warning");
				return;
			}
			const state: LoopState = {
				mode: "plan",
				iteration: 1,
				maxIterations: args.maxIterations,
				startedAt: existing?.startedAt || new Date().toISOString(),
				status: "active",
			};
			saveState(ctx, state);
			currentLoop = "plan";
			updateUI(ctx);
			const prompt = getPromptForMode("plan");
			pi.sendUserMessage(prompt);
		},

		build(rest, ctx) {
			const args = parseArgs(rest);
			if (currentLoop) {
				const state = loadState(ctx, currentLoop);
				if (state && state.status === "active") {
					state.status = "completed";
					state.completedAt = new Date().toISOString();
					saveState(ctx, state);
				}
				currentLoop = null;
			}
			const existing = loadState(ctx, "build");
			if (existing?.status === "active") {
				ctx.ui.notify("Build 循环已在运行中。使用 /ralph stop 停止。", "warning");
				return;
			}
			const state: LoopState = {
				mode: "build",
				iteration: 1,
				maxIterations: args.maxIterations,
				startedAt: existing?.startedAt || new Date().toISOString(),
				status: "active",
			};
			saveState(ctx, state);
			currentLoop = "build";
			updateUI(ctx);
			const prompt = getPromptForMode("build");
			pi.sendUserMessage(prompt);
		},

		talk(_rest, ctx) {
			const files = listDocFiles(ctx);
			if (files.length === 0) {
				pi.sendUserMessage("doc 目录下没有需求文档。请先创建需求文档，或使用 /ralph init 复制模板。");
				return;
			}
			const fileList = files.map(f => `- ${f}`).join("\n");
			pi.sendUserMessage(`doc 目录下有这些文件：\n\n${fileList}\n\n 等待我选择一个文件后,你读取我选择的文件，然后根据文件内容和用户讨论。在没做出选择前，不要擅自行动`);
		},

		stop(_rest, ctx) {
			if (!currentLoop) {
				ctx.ui.notify("没有活跃的 Ralph 循环。", "warning");
				return;
			}
			const state = loadState(ctx, currentLoop);
			if (!state) {
				ctx.ui.notify("状态文件不存在。", "error");
				return;
			}
			if (state.status === "completed") {
				ctx.ui.notify(`循环 ${currentLoop} 已经完成。`, "info");
				return;
			}
			state.status = "completed";
			state.completedAt = new Date().toISOString();
			saveState(ctx, state);
			ctx.ui.notify(`已停止 ${currentLoop} 循环 (迭代 ${state.iteration})。`, "info");
			currentLoop = null;
			updateUI(ctx);
		},

		status(_rest, ctx) {
			if (!currentLoop) {
				ctx.ui.notify("没有活跃的 Ralph 循环。", "info");
				return;
			}
			const state = loadState(ctx, currentLoop);
			if (!state) {
				ctx.ui.notify("状态文件不存在。", "error");
				return;
			}
			const maxStr = state.maxIterations > 0 ? `/${state.maxIterations}` : "";
			ctx.ui.notify(
				`当前循环: ${state.mode}\n` +
				`状态: ${state.status === "active" ? "活跃" : "完成"}\n` +
				`迭代: ${state.iteration}${maxStr}\n` +
				`开始时间: ${state.startedAt}`,
				"info"
			);
		},

		clean(rest, ctx) {
			const force = rest.trim() === "--yes";
			const warning = `此操作将删除 .ralph 目录中的所有文件（包括状态、任务、进度记录）。这些文件将被移动到回收站。\n\n请确认您要删除这些文件。`;
			const run = () => {
				const dir = ralphDir(ctx);
				if (!fs.existsSync(dir)) {
					ctx.ui.notify("没有找到 .ralph 目录。", "info");
					return;
				}
				// Rename to .ralph.deleted.[timestamp] as safe deletion
				const timestamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
				const deletedDir = path.resolve(ctx.cwd, `.ralph.deleted.${timestamp}`);
				try {
					fs.renameSync(dir, deletedDir);
					ctx.ui.notify(`已安全删除 .ralph 目录，文件移动到: ${deletedDir}\n\n如需永久删除，请手动删除该目录。`, "info");
				} catch (err: any) {
					ctx.ui.notify(`删除失败: ${err.message}`, "error");
				}
				currentLoop = null;
				updateUI(ctx);
			};
			if (!force) {
				if (ctx.hasUI) {
					void ctx.ui.confirm("删除所有 Ralph 文件？", warning).then((confirmed) => {
						if (confirmed) run();
					});
				} else {
					ctx.ui.notify(`请使用 /ralph clean --yes 确认删除。\n\n${warning}`, "warning");
				}
				return;
			}
			if (ctx.hasUI) ctx.ui.notify(warning, "warning");
			run();
		},
	};

	const HELP = `Ralph Wiggum - 简化的迭代开发工作流

命令:
  /ralph init [--force]           复制模板文件到当前项目
  /ralph plan [--max-iterations N] 启动规划模式循环
  /ralph build [--max-iterations N] 启动构建模式循环
  /ralph talk                     讨论需求（列出 doc 文档）
  /ralph stop                     停止当前循环
  /ralph status                   查看当前状态
  /ralph clean [--yes]            安全删除 .ralph 目录（移动到回收站）

选项:
  --max-iterations N      最大迭代次数（默认 50）

停止循环: 按 ESC 暂停助手，发送消息继续，使用 /ralph stop 结束循环。

示例:
  /ralph init
  /ralph plan --max-iterations 20
  /ralph build
  /ralph talk`;

	pi.registerCommand("ralph", {
		description: "Ralph Wiggum - 简化的迭代开发工作流",
		handler: async (args, ctx) => {
			const [cmd] = args.trim().split(/\s+/);
			const handler = commands[cmd];
			if (handler) {
				handler(args.slice(cmd.length).trim(), ctx);
			} else {
				ctx.ui.notify(HELP, "info");
			}
		},
	});

	// --- Tool for agent self-invocation ---

	pi.registerTool({
		name: "ralph_start",
		label: "Start Ralph Loop",
		description: "Start a long-running development loop. Use for complex multi-iteration tasks.",
		promptSnippet: "Start a persistent multi-iteration development loop with pacing and reflection controls.",
		promptGuidelines: [
			"Use this tool when the user explicitly wants an iterative loop, autonomous repeated passes, or paced multi-step execution.",
			"After starting a loop, continue each finished iteration with ralph_done unless the completion marker has already been emitted.",
		],
		parameters: Type.Object({
			name: Type.String({ description: "Loop name (e.g., 'refactor-auth')" }),
			taskContent: Type.String({ description: "Task in markdown with goals and checklist" }),
			itemsPerIteration: Type.Optional(Type.Number({ description: "Suggest N items per turn (0 = no limit)" })),
			reflectEvery: Type.Optional(Type.Number({ description: "Reflect every N iterations" })),
			maxIterations: Type.Optional(Type.Number({ description: "Max iterations (default: 50)", default: 50 })),
		}),
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			// For compatibility with old tool, but recommend using /ralph plan or /ralph build
			ctx.ui.notify("注意: ralph_start 工具已弃用，请使用 /ralph plan 或 /ralph build 命令。", "warning");
			// Create a generic loop file
			const loopName = sanitize(params.name);
			const taskFile = path.join(RALPH_DIR, `${loopName}.md`);
			const fullPath = path.resolve(ctx.cwd, taskFile);
			ensureDir(fullPath);
			fs.writeFileSync(fullPath, params.taskContent, "utf-8");
			
			ctx.ui.notify(`已创建任务文件: ${taskFile}，请使用 /ralph plan 或 /ralph build 启动循环。`, "info");
			return {
				content: [{ type: "text", text: `任务文件已创建: ${taskFile}` }],
				details: {},
			};
		},
	});

	// Tool for agent to signal iteration complete
	pi.registerTool({
		name: "ralph_done",
		label: "Ralph Iteration Done",
		description: "Signal that you've completed this iteration of the Ralph loop. Call this after making progress to get the next iteration prompt. Do NOT call this if you've output the completion marker.",
		promptSnippet: "Advance an active Ralph loop after completing the current iteration.",
		promptGuidelines: [
			"Call this after making real iteration progress so Ralph can queue the next prompt.",
			"Do not call this if there is no active loop, if pending messages are already queued, or if the completion marker has already been emitted.",
		],
		parameters: Type.Object({}),
		async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
			if (!currentLoop) {
				return { content: [{ type: "text", text: "没有活跃的 Ralph 循环。" }], details: {} };
			}

			const state = loadState(ctx, currentLoop);
			if (!state || state.status !== "active") {
				return { content: [{ type: "text", text: "Ralph 循环未激活。" }], details: {} };
			}

			if (ctx.hasPendingMessages()) {
				return {
					content: [{ type: "text", text: "已有待处理消息，跳过 ralph_done。" }],
					details: {},
				};
			}

			// Increment iteration
			state.iteration++;

			// Check max iterations
			if (state.maxIterations > 0 && state.iteration > state.maxIterations) {
				state.status = "completed";
				state.completedAt = new Date().toISOString();
				saveState(ctx, state);
				currentLoop = null;
				updateUI(ctx);
				pi.sendUserMessage(`───────────────────────────────────────────────────────────────────────\n⚠️ RALPH 循环停止: ${state.mode} | 达到最大迭代次数 (${state.maxIterations})\n───────────────────────────────────────────────────────────────────────`);
				return { content: [{ type: "text", text: "达到最大迭代次数，循环已停止。" }], details: {} };
			}

			saveState(ctx, state);
			updateUI(ctx);

			// Send next iteration prompt
			const prompt = getPromptForMode(state.mode);
			pi.sendUserMessage(prompt, { deliverAs: "followUp" });

			return {
				content: [{ type: "text", text: `迭代 ${state.iteration - 1} 完成，已开始迭代 ${state.iteration}。` }],
				details: {},
			};
		},
	});

	// --- Event handlers ---

	pi.on("before_agent_start", async (event, ctx) => {
		if (!currentLoop) return;
		const state = loadState(ctx, currentLoop);
		if (!state || state.status !== "active") return;

		const iterStr = `${state.iteration}${state.maxIterations > 0 ? `/${state.maxIterations}` : ""}`;
		const instructions = `你正在 Ralph ${state.mode} 循环中工作 (迭代 ${iterStr})。\n` +
			`- 遵循 ${state.mode} 模式的指示\n` +
			`- 完成每个迭代后调用 ralph_done 工具继续\n` +
			`- 当完全完成时输出: ${COMPLETE_MARKER}`;

		return {
			systemPrompt: event.systemPrompt + `\n[RALPH ${state.mode.toUpperCase()} 循环 - 迭代 ${iterStr}]\n\n${instructions}`,
		};
	});

	pi.on("agent_end", async (event, ctx) => {
		if (!currentLoop) return;
		const state = loadState(ctx, currentLoop);
		if (!state || state.status !== "active") return;

		// Check for completion marker
		const lastAssistant = [...event.messages].reverse().find((m) => m.role === "assistant");
		const text =
			lastAssistant && Array.isArray(lastAssistant.content)
				? lastAssistant.content
						.filter((c): c is { type: "text"; text: string } => c.type === "text")
						.map((c) => c.text)
						.join("\n")
				: "";

		if (text.includes(COMPLETE_MARKER)) {
			state.status = "completed";
			state.completedAt = new Date().toISOString();
			saveState(ctx, state);
			currentLoop = null;
			updateUI(ctx);
			pi.sendUserMessage(`───────────────────────────────────────────────────────────────────────\n✅ RALPH 循环完成: ${state.mode} | ${state.iteration} 次迭代\n───────────────────────────────────────────────────────────────────────`);
			return;
		}

		// Check max iterations
		if (state.maxIterations > 0 && state.iteration >= state.maxIterations) {
			state.status = "completed";
			state.completedAt = new Date().toISOString();
			saveState(ctx, state);
			currentLoop = null;
			updateUI(ctx);
			pi.sendUserMessage(`───────────────────────────────────────────────────────────────────────\n⚠️ RALPH 循环停止: ${state.mode} | 达到最大迭代次数 (${state.maxIterations})\n───────────────────────────────────────────────────────────────────────`);
			return;
		}
	});

	pi.on("session_start", async (_event, ctx) => {
		// Check for any active loop
		const planState = loadState(ctx, "plan");
		const buildState = loadState(ctx, "build");
		if (planState?.status === "active") {
			currentLoop = "plan";
			ctx.ui.notify(`检测到活跃的 Plan 循环 (迭代 ${planState.iteration})，使用 /ralph stop 停止或继续工作。`, "info");
		} else if (buildState?.status === "active") {
			currentLoop = "build";
			ctx.ui.notify(`检测到活跃的 Build 循环 (迭代 ${buildState.iteration})，使用 /ralph stop 停止或继续工作。`, "info");
		}
		updateUI(ctx);
	});

	pi.on("session_shutdown", async (_event, ctx) => {
		if (currentLoop) {
			const state = loadState(ctx, currentLoop);
			if (state) saveState(ctx, state);
		}
	});
}
