# Ralph 工作流对比分析

> 本文对比了 `.vscode/how-to-ralph-wiggum/README.md`（Clayton Farr 的 Ralph Playbook）与 `.vscode/ralph/` 工程文件中的实际实现流程，分析两者的设计理念、机制差异，并给出综合理解。

---

## 一、宏观对比：两条路径，同一内核

两个版本共享**同一个核心思想**：
> 用一个"哑巴"的 bash 循环不断重启 AI agent，每次给一个干净的上下文窗口，让 AI 读取磁盘上持久化的状态文件，完成一个小任务后提交代码，然后循环重启。

但两者在**需求表达形式、任务编排方式、中间产物**上走了截然不同的路线。

| 维度 | Playbook (README.md) | Ralph 工程 (ralph/) |
|------|----------------------|---------------------|
| **需求格式** | `specs/*.md`（自由文本，JTBD 驱动） | `prd.json`（结构化 JSON，User Story 驱动） |
| **计划文件** | `IMPLEMENTATION_PLAN.md`（AI 自行生成的待办清单） | `prd.json` 里的 `passes` 字段（人为维护的状态） |
| **模式** | PLANNING + BUILDING 双模式（`PROMPT_plan.md` / `PROMPT_build.md`） | 单模式（`prompt.md` / `CLAUDE.md` 固定指令） |
| **任务来源** | AI 自行做 gap analysis（spec vs 代码） | 人预先拆解好的 User Story（`passes: false` 的条目） |
| **循环控制** | `while :; do cat PROMPT.md \| claude; done`（无上限） | `for i in $(seq 1 $MAX_ITERATIONS)`（默认 10 次上限） |
| **完成信号** | 没有显式完成信号（Ctrl+C 手动停止或计划全部完成） | `<promise>COMPLETE</promise>` 标记（所有 `passes: true`） |
| **工具支持** | 纯 Claude CLI | 支持 Amp 和 Claude Code 双后端 |
| **记忆载体** | `IMPLEMENTATION_PLAN.md` → 磁盘 → 下一次迭代 | `progress.txt` + `prd.json` + git 历史 |
| **辅助产物** | `AGENTS.md`（运营学习） | `progress.txt`（进度日志 + 模式沉淀）+ 目录级 `AGENTS.md` |

---

## 二、Playbook 流程详解（how-to-ralph-wiggum/README.md）

### 2.1 三阶段架构

```
Phase 1: 需求定义（人类 + LLM 对话）
    ↓
Phase 2: 计划生成（PLANNING 模式循环）
    ↓
Phase 3: 代码实现（BUILDING 模式循环）
```

### 2.2 Phase 1: JTBD 驱动的需求定义

- 人类与 LLM **对话**，识别 **Jobs to Be Done（JTBD）**
- 每个 JTBD 拆分为多个 **Topic of Concern**（关注点）
- 每个关注点 → 一个 `specs/FILENAME.md` 文件
- **粒度法则**：如果一个关注点需要"和"来描述，说明它太大了，应该拆分

### 2.3 Phase 2: PLANNING 模式（Gap Analysis）

1. AI 并读取所有 `specs/*`（最多 250 个 Sonnet subagents）
2. 读取现有 `src/lib/*` 了解已有共享库
3. 对比 specs 与现有代码，找出差距
4. **仅做计划，不做实现**
5. 生成/更新 `IMPLEMENTATION_PLAN.md`（按优先级排序的待办清单）

关键特性：**计划是可丢弃的**——如果方向错了，删掉重新跑一遍 Planning 即可。

### 2.4 Phase 3: BUILDING 模式（实现循环）

每次迭代的内部步骤：
1. **Orient（定位）** → 读取 specs 了解需求
2. **Read Plan** → 读取 IMPLEMENTATION_PLAN.md
3. **Select（选择）** → 挑选最重要的任务
4. **Investigate（调查）** → 搜索代码确认该功能是否真的没实现（"don't assume not implemented"）
5. **Implement（实现）** → 用 up to 500 个 Sonnet subagents 并行操作文件
6. **Validate（验证）** → 仅用 1 个 subagent 跑测试（backpressure）
7. **Update Plan** → 标记任务完成，记录发现
8. **Update AGENTS.md** → 记录运营学习
9. **Commit + Push** → 提交并推送
10. **循环重启** → 上下文清空，回到步骤 1

### 2.5 核心设计哲学

| 原则 | 含义 |
|------|------|
| **Context Is Everything** | 每次迭代保持~156kb上下文，1个任务 = 100% 利用"智能区" |
| **主 Agent 是调度器** | 昂贵的子任务用 subagent 分发，主上下文只做协调 |
| **Steer Upstream** | 通过已有的代码模式引导 AI 走向正确方向 |
| **Steer Downstream** | 通过测试/构建/类型检查创建 backpressure |
| **Let Ralph Ralph** | 信任 AI 自主决策，不 micromanage |
| **Plan is Disposable** | 计划错了就重来，成本极低（一次 Planning loop） |
| **Move Outside the Loop** | 人类的职责是设计环境，而不是干预循环内部 |

---

## 三、Ralph 工程流程详解（.vscode/ralph/）

### 3.1 流程图式架构

```
1. 人写 PRD (markdown)
    ↓
2. 转换为 prd.json（拆分为 User Story）
    ↓
3. 运行 ralph.sh（启动自主循环）
    ↓
  ┌─────────────────────────────────┐
  │ 4. AI 挑一个 passes:false 故事   │
  │ 5. 实现它（写代码、跑测试）       │
  │ 6. 如果测试通过，提交代码          │
  │ 7. 更新 prd.json 设置 passes:true │
  │ 8. 追加进度到 progress.txt        │
  │ 9. 还有 passes:false 的故事？     │
  │    → 是：回到 4                   │
  │    → 否：Done                     │
  └─────────────────────────────────┘
```

### 3.2 prd.json：结构化的需求 + 计划

```json
{
  "userStories": [
    {
      "id": "US-001",
      "passes": false,    // 核心状态标记
      "priority": 1,      // 执行顺序（依赖优先）
      "acceptanceCriteria": [...]  // 可验证的验收标准
    }
  ]
}
```

**关键约束**：每个 User Story 必须小到能在**一次上下文窗口内完成**。如果太大，AI 会耗尽上下文产生烂代码。

### 3.3 ralph.sh：循环控制

- 支持 `--tool amp` 或 `--tool claude` 双后端
- 默认最多 10 次迭代（可配置）
- 检测到 `<promise>COMPLETE</promise>` 立即退出
- **分支归档机制**：如果 `prd.json` 的 `branchName` 变了，自动把上次的 `prd.json` 和 `progress.txt` 归档到 `archive/` 目录
- `progress.txt` 同时充当进度日志和模式知识库

### 3.4 Skills 生态

| Skill | 职责 |
|-------|------|
| `prd` | 接收模糊需求 → 问 3-5 个澄清问题 → 生成结构化 PRD |
| `ralph` | 把 PRD 拆分成 `prd.json`（User Story 格式，依赖排序，粒度控制） |

---

## 四、核心差异深度分析

### 4.1 需求驱动 vs 故事驱动

| | Playbook | Ralph 工程 |
|---|----------|------------|
| **思维起点** | JTBD（用户要完成什么任务） | User Story（用户需要个功能） |
| **粒度控制** | "One Sentence Without And" 测试 | "2-3 句话描述" 规则 |
| **谁拆任务** | **AI 自动**（gap analysis 从 spec 推导 task） | **人预先拆分**（prd.json 里写好） |
| **灵活性** | 高（AI 可以自创 spec、自调优先级） | 低（严格按人写的顺序执行） |
| **确定性** | 低（gap analysis 每次可能不同） | 高（故事和顺序固定） |

**我的理解**：这是两种截然不同的信任模型。
- Playbook 信任 AI「自己找出该做什么」——**AI 主导的需求发现**
- Ralph 工程信任人类「提前安排好一切」——**人类主导的任务编排**

### 4.2 计划的"活性"差异

**Playbook 的 IMPLEMENTATION_PLAN.md 是活的**：
- Planning 模式：AI 自主创建/重写
- Building 模式：AI 在执行中标记完成、添加发现、记录 bug
- 随时可以删掉重来
- AI 甚至可以创建新的 spec 文件

**Ralph 工程的 prd.json 是半活的**：
- 初始由人创建（或 prd skill 辅助）
- AI 只修改 `passes` 字段
- 不会自创新故事（除非人更新文件）
- 没有"删掉重来"的概念——靠分支归档来切分不同轮次

### 4.3 子代理（Subagent）策略

**Playbook 重度依赖 subagent**：
- 最多 500 个 Sonnet subagents 并行读代码/specs
- 最多 250 个 Sonnet subagents 读 lib 库
- Opus subagent 做复杂推理
- 1 个 Sonnet subagent 专做测试验证
- **主 agent 只做调度和决策**

**Ralph 工程没有 subagent 概念**：
- 每次迭代产生一个独立的 Amp/Claude 实例
- 单个 agent 完成"读→写→测试→提交"全链路
- 更简单但也更受限（没有并行读/并行写的能力）

### 4.4 记忆持久化

| | Playbook | Ralph 工程 |
|---|----------|------------|
| **主存储** | `IMPLEMENTATION_PLAN.md` | `prd.json` + `progress.txt` |
| **运营知识** | `AGENTS.md`（全局，~60行） | `progress.txt` 中的 Patterns + 目录级 `AGENTS.md` |
| **Git 历史** | ✓ | ✓ |
| **自动归档** | 无 | ✓（按分支和时间戳） |

Playbook 的 `AGENTS.md` 有严格纪律：只能放"怎么构建/运行/测试"的运营知识，不放进度状态。

Ralph 工程的 `progress.txt` 更随意：既记录做了什么，也沉淀可复用模式。

### 4.5 完成判定

**Playbook**：没有硬编码的完成信号。循环会一直跑直到：
- 人类 Ctrl+C 停止
- 计划全部完成（AI 自行判断后不再有新任务）

**Ralph 工程**：明确退出条件：
- 所有 `passes: true` → 输出 `<promise>COMPLETE</promise>` → `ralph.sh` 退出
- 或达到最大迭代次数 → 退出（返回 1）

---

## 五、我的核心理解

### 5.1 两个版本本质上回答了两个不同的问题

| 版本 | 回答的问题 | 适用场景 |
|------|-----------|----------|
| **Playbook** | "AI 如何从需求到代码完全自主地工作？" | 探索性开发、新产品从零到一、人类不想 micromanage |
| **Ralph 工程** | "如何可靠地把一个已拆解的 PRD 变成代码？" | 已确认的功能开发、团队项目、需要确定性交付 |

### 5.2 Playbook 是"AI 原生"的，Ralph 工程是"人类友好"的

Playbook 的哲学是 **AI 知道它需要什么**：
- 让它自己读 specs + 代码 → 自己做 gap analysis → 自己生成计划 → 自己执行
- 人只负责提供 specs 和优化环境（backpressure、AGENTS.md）
- 这要求人对 AI 有更高的信任度

Ralph 工程的哲学是 **人知道 AI 需要什么**：
- 人先把需求拆好、排好序、写好验收标准
- AI 只是一个忠实的执行者
- 这对不熟悉 AI 能力的团队更安全

### 5.3 两者可以融合：最佳实践

我理解的最佳实践是**结合两者的长处**：

1. **需求阶段**（PRD Skill 模式）：人提供模糊想法 → AI 问澄清问题 → 生成 PRD
2. **转换阶段**（Ralph Skill 模式）：把 PRD 转为 `prd.json`（结构化，确定性强）
3. **Planning 阶段**（Playbook 模式）：用 AI 做 gap analysis，生成 `IMPLEMENTATION_PLAN.md`
4. **Building 阶段**：从 IMPLEMENTATION_PLAN.md 驱动开发，同时对照 prd.json 的验收标准
5. **记忆管理**：`AGENTS.md` 放运营知识，`IMPLEMENTATION_PLAN.md` 放进度，`prd.json` 放验收标准

### 5.4 关于循环控制的反思

Playbook 的 `while :; do` 看似简单，但暗含深意：
- **无限循环 = AI 自主决定何时停止**
- 配合"计划是可丢弃的"原则，AI 可以无限接近正确，直到人类判断"够了"

Ralph 工程的 max_iterations = 10：
- 更务实，防止 AI 失控烧钱
- 但也意味着**人类需要更频繁地介入**（检查进度、调整 prd.json、重启循环）

### 5.5 "上下文隔离"是共同的灵魂

两个版本都理解一件事：**每次迭代必须是干净的上下文**。

- Playbook：bash 循环每次重新 cat PROMPT.md → 新 Claude 实例 → 新上下文窗口
- Ralph 工程：`for` 循环每次启动新的 Amp/Claude 实例 → 新上下文窗口

这保证了：
1. 不会出现上下文膨胀导致 AI 变蠢
2. 不会出现上一次迭代的错误误导下一次
3. 磁盘上的文件是唯一持久状态——简单、可审计、可回滚

### 5.6 Backpressure 是关键差异

Playbook 明确把"测试"称为 **backpressure（反向压力）**——这不是"验证代码能不能跑"，而是**"防止 AI 偷懒"的强制机制**。

- AI 说"做完了"→ backpressure 说"跑测试看看"→ 测试不过→ AI 必须修
- 这是一种**对抗性设计**：让 AI 在压力下产出更好的代码

Ralph 工程的 backpressure 更温和：
- "run quality checks (e.g., typecheck, lint, test - use whatever your project requires)"
- 前端故事额外要求"dev-browser skill"可视化验证
- 但**没有 Playbook 那种"LLM-as-judge 做主观验收标准 backpressure"的概念**

---

## 六、总结

> **Playbook 是 Ralph 的"自动驾驶模式"——AI 自己认路、自己规划、自己开。Ralph 工程是 Ralph 的"辅助驾驶模式"——人规划好路线，AI 负责踩油门。**

两者的核心机制（bash 循环 + 干净上下文 + 磁盘持久化）完全一致，区别只在于**"谁决定做什么"和"AI 有多大自主权"**。

- 如果你知道精确要做什么 → 用 Ralph 工程的 `prd.json` 方式
- 如果你有一堆需求但不知道怎么拆 → 用 Playbook 的 `specs/*.md` + gap analysis 方式
- 最佳实践：先用 PRD Skill 理清需求，再用 Playbook 的 Planning 模式做 gap analysis，最后用双模式的 loop 迭代构建
