---
name: pi-ralph
description: Ralph 工作流 - 简化的迭代开发循环，支持规划模式 (plan) 和构建模式 (build)。适用于需要多次迭代、多步骤或定期反思的开发任务；避免用于简单的一次性任务或快速修复。
---

# Ralph Wiggum - 简化的迭代开发工作流

## 工作流程

1. **初始化模板**：使用 `/ralph init` 复制模板文件到当前项目
2. **讨论需求**：使用 `/ralph talk` 与 AI 讨论产品需求
3. **规划模式**：使用 `/ralph plan` 启动规划循环，生成开发计划 (Tasks.md)
4. **构建模式**：使用 `/ralph build` 启动构建循环，根据计划实现功能

## 用户命令

- `/ralph init [--force]` - 复制模板文件到当前项目
- `/ralph plan [--max-iterations N]` - 启动规划模式循环
- `/ralph build [--max-iterations N]` - 启动构建模式循环
- `/ralph talk` - 讨论需求（列出 doc 文档）
- `/ralph stop` - 停止当前循环
- `/ralph status` - 查看当前状态
- `/ralph clean [--yes]` - 安全删除 .ralph 目录（移动到回收站）

按 ESC 暂停助手，发送消息继续，使用 `/ralph stop` 结束循环。

## 模式说明

### 规划模式 (Plan Mode)
- 目标：对比规格说明书 (specs) 与现有代码，生成细粒度的开发计划 (Tasks.md)
- 输入：`.ralph/specs/*.md` 规格说明书
- 输出：`.ralph/workflow/Tasks.md` 开发计划
- 提示词：`.ralph/ralph_plan.md`

### 构建模式 (Build Mode)
- 目标：根据开发计划 (Tasks.md) 实现功能，确保代码质量并通过验证
- 输入：`.ralph/workflow/Tasks.md` 开发计划
- 输出：实现的代码，更新的 Learnings.md
- 提示词：`.ralph/ralph_build.md`

## Agent 工具

- `ralph_done` - 完成当前迭代，继续下一个迭代（在 plan/build 模式中自动调用）
- `ralph_start` - 已弃用，建议使用 `/ralph plan` 或 `/ralph build`

## 完成标记

当任务完全完成时，输出：
```
<promise>COMPLETE</promise>
```

这将自动停止循环并标记为完成。

## 最佳实践

1. **规划阶段**：确保规格说明书清晰、完整
2. **任务拆分**：每个任务应小到能在一个上下文窗口内完成
3. **验证步骤**：每个任务必须包含可验证的验收标准
4. **知识沉淀**：在 Learnings.md 中记录发现和模式
5. **安全删除**：使用 `/ralph clean --yes` 安全删除 .ralph 目录
