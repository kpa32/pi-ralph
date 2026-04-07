# 构建模式（Build Mode）

## 文件路径
- [Makefile.md](.ralph/workflow/Makefile.md)
- [Tasks.md](.ralph/workflow/Tasks.md)
- [Learnings.md](.ralph/workflow/Learnings.md)

## 目标
根据开发计划（Tasks.md）实现功能，确保代码质量并通过验证。

## 步骤

### 0. 准备工作
- 阅读 `Tasks.md` 获取当前开发计划
- 阅读 `.ralph/specs/*` 了解需求规格

### 1. 选择任务
- 从 `Tasks.md` 中选择优先级最高的未完成任务
- **重要**：每次迭代只处理一个任务（确保能在上下文窗口内完成）
- 如果任务太大，将其拆分为更小的子任务

### 2. 实施前检查
- **不要假设功能未实现**：先搜索代码库，确认该功能确实缺失
- 检查是否有现有代码可以复用或扩展
- 优先使用项目中的共享组件和工具

### 3. 实施功能
- 编写实现代码
- 遵循现有代码风格和架构模式
- 如果发现更好的实现方式，更新 `Tasks.md` 中的相关任务说明

### 4. 质量验证（反向压力）
- 运行项目验证命令（参考 `Makefile.md`）：
  - 类型检查（typecheck）
  - 代码风格检查（lint）
  - 运行相关测试
- **所有验证必须通过**才能继续
- 如果测试失败，必须修复问题后再提交


### 5. 更新计划与记录
- 任务完成后，在 `Tasks.md` 中标记该任务为完成
- 如果发现新问题或需要后续工作，添加到 `Learnings.md`
- 如果学到新的项目构建/运行知识，更新 `Learnings.md`（保持简洁）

### 6. 提交代码
- 通过验证后，提交所有更改：
```bash
git add -A
git commit -m "feat: [任务描述]"
git push
```

## 重要原则


### 反向压力（Backpressure）
- 测试和验证不是可选项，是必须通过的关卡
- 未通过验证的代码不能提交
- 如果发现无关测试失败，也必须修复（保持CI绿色）


### 知识沉淀
#### 主学习日志
- 写入文件: **Learnings.md**
- 写入方式：追加（never replace），每次迭代都在文件末尾添加一个新段落。
- 标准格式：
  ```markdown
    ## [日期/时间] - [故事ID]
    - 实现了什么
    - 修改了哪些文件
    - **Learnings for future iterations:**
      - Patterns discovered (e.g., "this codebase uses X for Y")
      - Gotchas encountered (e.g., "don't forget to update Z when changing W")
      - Useful context (e.g., "the evaluation panel is in component X")
    ---
  ```
- 关键部分：Learnings for future iterations 是必须填写的，用于记录对未来迭代有帮助的模式、坑点、上下文。

#### “代码库模式”汇总
- 如果发现通用、可复用的模式，需要将其添加到 **Learnings.md** 文件最开头的 ## Codebase Patterns 区域（若不存在则创建）。
- 示例：
  ```markdown
    ## Codebase Patterns
    - Use `sql<number>` template for aggregations
    - Always use `IF NOT EXISTS` for migrations
    - Export types from actions.ts for UI components
  ```
- 每次迭代开始前，代理都会首先读取这个区域，以了解代码库的通用约定。

- 避免重复学习，让后续迭代更高效


## 完成条件
- 所有计划任务完成后，`Tasks.md` 中应无未完成任务
- 最终代码应通过所有验证
- 功能完全实现，无占位符或半成品

**记住**：每次迭代都是独立的，从干净上下文开始。依赖磁盘文件（specs、Tasks.md、Makefile.md、Learnings.md）传递状态和知识。
