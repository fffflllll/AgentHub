# AgentHub 需求文档

## 1. 项目概述

AgentHub 是一个通过 IM 交互承载多 Agent 协作的软件工程平台。用户在一个类似飞书/微信的聊天界面中，与多个 AI Agent（前端Agent、后端Agent、测试Agent、Orchestrator 等）进行群聊协作，完成软件开发任务。

**核心定位**：AgentHub 不是简单的多 Agent 聊天套壳系统。它通过 Java 后端完成会话、消息、鉴权、任务路由，通过 Python AI Harness 完成任务执行、上下文构建、workspace 管理、沙箱执行、patch 生成、验证反馈和流式回传，将聊天中的自然语言任务转化为可执行、可追踪、可审核、可回滚的软件工程任务。

AgentHub 不仅提供类 IM 的多 Agent 交互界面，还通过后端任务调度与 AI Harness 执行层，将自然语言需求转化为可追踪的软件工程任务。系统支持从任务理解、上下文构建、模型调用、代码生成、文件变更、Diff 审核、预览验证到最终应用的完整闭环。

**两大核心场景**：
1. **从零开发**：用户像产品经理一样在群里提需求，Orchestrator（项目经理 Agent）自动拆解任务并在群里 @ 对应 Agent，各 Agent 在群里回复代码，用户全程可见协作过程。
2. **已有项目修改**：用户导入现有项目（MVP 先支持 GitHub URL，拖拽文件夹 / Zip 上传后续扩展），在群里 @ Agent 让它分析代码、修 bug、加功能，Agent 的修改通过 Diff 对比展示，用户审核后应用到项目中。

**第一版 MVP 边界**：
- 第一版只要求跑通 **M1：单 Agent 端到端对话闭环**，即注册登录、Provider 配置、创建单聊、WebSocket 发送消息、Python 调用 LLM 并流式返回。
- 群聊协作、Orchestrator 真调用拆解、代码 Diff、GitHub 项目导入、预览、平台模式依次作为后续里程碑推进。
- 一键部署不进入第一版范围，保留为后续扩展能力。

---

## 2. 用户角色

| 角色 | 描述 |
|------|------|
| **普通用户** | 注册登录后，可以创建会话、拉 Agent 进群、与 Agent 协作开发 |
| **Agent** | 系统预置的 AI 角色，每个有专属技能（前端/后端/测试/协调），在群聊中被 @ 时响应 |
| **Orchestrator** | 特殊的 Agent，负责任务拆解和调度其他 Agent，是群聊中的「项目经理」 |

---

### 2.1 Agent 技术实现模型（重要）

**每个 Agent 都不是常驻运行的进程**，而是一个「角色/平台配置」—— 被 @ 时触发一次任务，任务结束后本次执行即停止。根据任务复杂度分为两种执行模式：

- **LLM 模式**：直接调用 OpenAI / Anthropic / 自定义 OpenAI 兼容接口，适合简单问答、单文件代码片段生成。
- **平台模式**：在 Docker 沙箱中启动 Claude Code / Codex CLI，适合已有项目修改、多文件代码变更、需要工具调用的复杂开发任务。

```
Agent = 一条数据库记录（system prompt / agent_mode / platform_type / model）
       + 被 @ 时的一次任务执行（LLM API 调用或 Agent CLI 调用）
       + 对话上下文（最近 N 条消息）
```

**各组件在系统中的职责分工**：

- **Agent**：决定"谁来做、以什么身份做、用什么模型/工具做"。本质是数据库中的角色配置（system prompt、agent_mode、platform_type、model、工具权限），被 @ 时触发一次 AgentTask。
- **Java 后端**：负责识别 @Agent、查找 Agent 配置、创建结构化 AgentTask、保存消息、投递任务到 Redis、转发流式结果。
- **Python AI Harness**：负责实际执行任务——任务规格化、上下文构建、workspace 管理、沙箱隔离、patch 生成、验证反馈、流式回传和执行追踪。
- **LLM / Claude Code / Codex**：是 Python AI Harness 内部调用的执行引擎，不是系统本身的组成部分。Harness 根据 agent_mode 选择 LLM Adapter（直接调 API）或 Platform Adapter（启动 CLI 工具）。

```
用户 @Agent 发消息
       │
       ▼
Java 后端：解析 @mention → 查 Agent 配置 → 创建 AgentTask → 投递 Redis Stream
       │
       ▼
Python AI Harness：消费任务 → 构建上下文 → 选择执行模式 → 管理 workspace/沙箱
       │
       ├── LLM 模式：BaseLLMAdapter → OpenAI / Anthropic / Custom API
       │
       └── Platform 模式：PlatformAdapter → Claude Code / Codex CLI（Docker 沙箱）
       │
       ▼
Harness 输出：token 流 + FilePatch + VerificationReport → Redis → Java → 前端
```

**当用户 @前端Agent 时，系统做的事情：**

1. Java 后端解析消息中的 @mention，发现目标是「前端Agent」
2. 从数据库查出前端Agent 的配置（system prompt、agent_mode、platform_type、model）
3. 解析用户 Provider 配置，生成不含明文 API Key 的任务消息
4. 通过 Redis Stream 投递给 Python AI 后端，传入：
   - Agent 的 system prompt（角色设定）
   - 当前会话的最近 20 条消息（上下文）
   - 用户刚发的消息
   - Provider 引用、模型、Base URL
   - 平台模式所需的项目文件
5. Python 执行前通过 Java 内网接口临时解析 API Key
6. Python 根据 `agent_mode` 执行：
   - LLM 模式：通过 LLM Adapter 调用 Claude/OpenAI API
   - 平台模式：在 Docker 沙箱中启动 Claude Code / Codex CLI，由 CLI 调用大模型并修改工作区
7. 流式返回 token / 工具事件 / 文件 patch → Java WebSocket → 前端逐字展示与 Diff 展示
8. 调用结束，LLM 请求结束或沙箱容器销毁，没有 Agent 进程继续运行

**Orchestrator 也是同样的机制**，唯一区别是它的 system prompt 告诉它：
- 拆解任务
- 在回复中使用 @前端Agent @后端Agent 来分配工作
- 系统检测到它消息里的 @mention，自动触发下一个 Agent

**所以「多 Agent 协作」的本质是：**

> 多个不同角色配置的 AgentTask，通过群聊消息里的 @mention 和 Orchestrator 任务链串联起来。LLM 模式依靠 system prompt 区分角色，由 AI Harness 管理上下文和流式输出；平台模式依靠 Claude Code / Codex CLI 在沙箱工作区中完成更复杂的工具调用和文件修改，由 AI Harness 管理 workspace、生成 FilePatch、运行验证和追踪执行过程。

这与常驻 Agent Loop（Agent 在服务端长期运行并不断推理-行动-观察）不同。这里是事件驱动的单任务执行，更简单务实，也更容易做权限、成本和生命周期控制。多个 AgentTask 的串联不依赖多个 Agent 进程长期运行，而是依赖群聊 @mention 触发和 Orchestrator 任务链管理。

**Agent 之间的差异：**

| Agent | System Prompt 核心 | 表现差异 |
|-------|-------------------|---------|
| **前端Agent** | "你是前端专家，擅长 React/TS/CSS" | 输出的代码是前端组件、样式 |
| **后端Agent** | "你是后端专家，擅长 API/数据库" | 输出的代码是接口、SQL |
| **测试Agent** | "你是测试专家，写单元测试/集成测试" | 输出测试用例，Review 别人的代码 |
| **Orchestrator** | "你是项目经理，拆任务、调度团队" | 输出任务计划，@ 其他 Agent 分配工作 |

---

## 3. 功能性需求

### 3.1 用户管理

**FR-01 用户注册**
- 用户通过用户名 + 密码注册账号
- 用户名唯一，2-20 个字符

**FR-02 用户登录**
- 用户名 + 密码登录，返回 JWT Token
- Token 有效期 7 天
- 前端保存 Token，后续请求自动携带

**FR-03 用户信息**
- 支持设置显示名称（displayName）和头像 URL

**FR-04 用户模型配置（设置页）**
- 用户在设置页面配置自己对接的 LLM 模型
- 支持添加多个 Provider（至少 OpenAI 和 Anthropic）
- 每项配置包含：
  - **Provider 类型**：OpenAI / Anthropic / 自定义（OpenAI 兼容）
  - **API Key**：用户自己的 API Key，加密存储在数据库
  - **Base URL**（可选）：用于指向第三方代理或兼容接口
  - **默认模型**：如 `gpt-4o`、`claude-sonnet-4-20250514`
- 可以标记一个 Provider 为「默认」
- 系统预置 Agent 默认使用用户配置的默认 Provider
- 用户也可以为单个 Agent 单独指定使用哪个 Provider
- API Key 在后端使用 AES 加密存储，前端编辑时显示为 `****`（不回显明文）

---

### 3.2 会话管理（IM 核心）

**FR-05 会话列表**
- 左侧边栏显示用户的所有会话
- 每条会话显示：名称、最后一条消息摘要、时间
- 支持按时间倒序排列
- 未读消息数角标（可选，MVP 不做）

**FR-06 创建单聊**
- 用户选择一个 Agent，创建 1v1 会话
- 会话名称默认为 Agent 的显示名称
- 用户在该会话中直接发消息（无需 @），Agent 自动响应

**FR-07 创建群聊**
- 用户创建群聊，自定义名称
- 从 Agent 列表中勾选要加入的 Agent（至少 1 个）
- 创建后群聊中只有用户和选中的 Agent
- 群聊中必须通过 @Agent名称 来指定谁回复

**FR-08 会话成员管理**
- 群聊支持后续添加/移除 Agent
- 移除 Agent 后，该 Agent 不再响应群内消息
- 用户不能退出自己创建的群聊（但可以删除）

**FR-09 删除会话**
- 用户可以删除自己创建的会话
- 删除后消息历史也一并删除

---

### 3.3 消息系统

**FR-10 发送消息**
- 用户在聊天输入框输入文字，按 Enter 发送
- Shift + Enter 换行
- 消息通过 WebSocket 实时发送到后端
- 消息持久化到数据库

**FR-11 消息流式接收**
- Agent 的回复以流式（逐字）方式显示
- 用户看到类似 ChatGPT 的打字效果
- 流式过程中消息气泡持续增长

**FR-12 消息历史**
- 进入会话时，加载最近 50 条历史消息
- 向上滚动加载更多（分页加载）
- 新消息自动滚动到底部

**FR-13 消息类型**
- **普通文本**：默认消息类型
- **代码块**：Agent 消息中的代码，Markdown 渲染 + 语法高亮
- **系统消息**：如「Orchestrator 将 后端Agent 加入了群聊」
- **任务计划**：Orchestrator 发出的结构化任务拆解（特殊的卡片样式）

**FR-14 Agent 消息中的操作按钮**
- Agent 消息中包含代码块时，消息下方出现操作按钮：
  - 「查看 Diff」：在右侧面板打开 Monaco Diff 对比
  - 「预览」：对前端代码触发预览（见 3.6）
  - 「部署」：后续能力，MVP 不展示

---

### 3.4 Agent 系统

**FR-15 系统预置 Agent**

系统预置以下 Agent，每个有固定的角色和 system prompt：

| Agent 名称 | 标识符 | 职责 | 默认模型 |
|-----------|--------|------|---------|
| 前端Agent | `frontend_agent` | 前端开发：React、Vue、HTML/CSS/JS | Claude Sonnet 4 |
| 后端Agent | `backend_agent` | 后端开发：Spring Boot、Python、数据库 | Claude Sonnet 4 |
| 测试Agent | `test_agent` | 测试：单元测试、集成测试 | GPT-4o |
| Orchestrator | `orchestrator` | 任务拆解与调度 | Claude Sonnet 4 |

**FR-16 Agent 的 @mention 触发**
- 在群聊中，用户必须通过 `@Agent名称` 来指定谁回复
- 系统解析消息中的 @mention，路由到对应 Agent
- 单聊中不需要 @，直接发送即可
- Agent 只在被 @ 时才回复（被动响应）

**FR-17 Agent 的流式响应**
- 被 @ 的 Agent 通过适配器层调用对应 LLM
- LLM 返回的 token 通过 SSE → Java WebSocket → 前端逐字展示
- 前端显示「Agent 正在输入...」动画

**FR-18 Agent 上下文（会话记忆）**
- 每个会话保留完整消息历史
- Agent 被 @ 时，将当前会话的最近 N 条消息作为上下文传给 LLM
- N 默认为 20，可配置
- Agent 能看到之前所有人的对话，理解上下文

---

### 3.5 AI Harness 执行层

AI Harness 是 AgentHub 的工程化执行核心。它不直接等同于 LLM API 调用，而是由任务规格化、上下文构建、执行模式选择、workspace 管理、变更标准化、验证反馈、执行追踪和人工审核共同组成的执行框架。Harness 负责将用户自然语言需求转化为可执行、可追踪、可验证的软件工程任务。

**FR-19 任务规格化**
- 将用户消息或 Orchestrator 子任务转化为结构化的 AgentTask
- AgentTask 包含：taskId、sessionId、agentId、instruction、contextMessages、workspaceFiles、llmRef
- Java 后端创建 AgentTask 后投递到 Redis Stream `agent:tasks`
- Python Harness 消费后解析任务参数并初始化执行环境

**FR-20 上下文构建**
- 为 Agent 注入最近 N 条会话消息（N 默认为 20，可配置）
- 根据任务类型注入项目文件内容（workspaceFiles）
- 注入任务计划、约束条件和验收标准（来自 Orchestrator 子任务）
- 支持按文件数量或 token 总量裁剪上下文，防止超出模型上下文窗口

**FR-21 执行模式选择**
- Harness 根据 Agent 配置的 `agent_mode` 选择执行路径：
  - **LLM 模式**：通过 BaseLLMAdapter 直接调用 OpenAI / Anthropic / OpenAI-compatible API
  - **Platform 模式**：通过 PlatformAdapter 在 Docker 沙箱中启动 Claude Code / Codex CLI
- 两种模式共享 AgentTask、AgentResult、FilePatch 等统一数据结构

**FR-22 工作区管理 (Workspace Manager)**
- 为代码任务创建临时 workspace 目录
- 将 project_files 中的文件写入 workspace
- 记录执行前的文件系统快照（Workspace Snapshot）
- 任务完成后记录执行后的文件系统快照
- 通过前后快照对比生成 FilePatch 列表

**FR-23 文件变更标准化 (Patch Builder)**
- 将 Agent 输出或 workspace 文件变化转化为 FilePatch
- FilePatch 字段至少包含：
  - `filePath`：文件相对路径
  - `patchType`：CREATE / MODIFY / DELETE
  - `baseVersion`：Agent 生成 patch 时的文件版本号，Approve 时用于乐观锁校验
  - `originalContent`：修改前内容（CREATE 时为 null）
  - `newContent`：修改后内容
  - `sourceRunId`：产生此 patch 的 AgentRun ID
  - `status`：PENDING_REVIEW / APPROVED / REJECTED / APPLIED
- Markdown 代码块提取作为 MVP 简化方案保留，FilePatch 是正式代码工作流的主路径

**FR-24 验证反馈 (Verification)**
- 支持运行 build 检查（npm build、mvn package 等）
- 支持运行 lint 检查（ESLint、Pylint 等）
- 支持运行 test（单元测试、集成测试）
- 支持运行 typecheck（TypeScript、mypy 等）
- 支持预览检查（前端项目启动 dev server 或静态文件 serve）
- 验证结果统一生成为 VerificationReport，包含通过/失败状态和错误详情

**FR-25 执行追踪 (Trace Recorder)**
- 记录每次 Agent 执行的完整追踪信息：
  - token 消耗（prompt tokens + completion tokens）
  - 工具调用（tool name、input、output、耗时）
  - 文件变更（file_path、patch_type、变更前后内容摘要）
  - 命令输出（stdout、stderr、exit code）
  - 验证结果（各检查项通过/失败状态）
  - 总耗时、状态（SUCCESS / TIMEOUT / ERROR）
  - 失败原因分类（API 错误、超时、Schema 错误、测试失败、沙箱错误）
- 追踪数据写入 agent_trace_events 表，用于调试、成本统计和审计

**FR-26 人工审核 (Human Review)**
- Agent 生成的代码变更先展示在 Diff 面板，不直接写入项目文件
- 用户通过 Diff 面板逐文件审核变更
- Approve：变更写入 project_files（新文件插入 / 已有文件更新版本号）
- Reject：变更保留在聊天记录中但不应用
- FilePatch 状态流转：PENDING_REVIEW → APPROVED/REJECTED → APPLIED
- 审核记录写入 code_review_patches 或 code_reviews 表

> 通过 AI Harness，系统将非确定性的模型输出转化为可审查、可回滚、可验证的工程变更。

---

### 3.6 Orchestrator 协调器

Orchestrator 是核心的多 Agent 协作引擎。它是一个特殊的 Agent，在群聊中扮演项目经理角色。

**FR-27 任务拆解**
- 用户 @Orchestrator 提出开发需求
- Orchestrator 分析需求，拆解为有序子任务
- 拆解策略：默认真调用 LLM function calling / structured output 生成任务计划；预定义模板只作为异常兜底或后续优化
- 子任务包含：序号、描述、指定负责的 Agent、依赖关系

**FR-28 群聊可见调度（核心交互）**

Orchestrator 在群聊中以自然语言发布任务：

```
[Orchestrator]: 收到！我来拆解一下「开发登录页面」：

任务计划：
  1. 前端登录UI（React + TailwindCSS）→ @前端Agent
  2. 后端登录API（JWT认证）→ @后端Agent
  3. 前后端联调 → 我来协调

@前端Agent 你先开始，写一个登录表单组件，包含用户名、密码输入框和登录按钮。
```

- 上述消息中的 `@前端Agent` 被系统解析
- 系统自动触发前端Agent 在群里回复
- 前端Agent 回复完毕后，系统自动提示 Orchestrator 继续
- Orchestrator 继续发消息 @后端Agent
- 整个调度过程在群聊中全程可见

**FR-29 任务计划展示**
- Orchestrator 发出的任务计划以特殊卡片样式渲染
- 卡片显示子任务列表及其状态：⏳等待中 → 🔄执行中 → ✅已完成
- 状态实时更新

**FR-30 级联触发链**
- Orchestrator 消息中包含 @mention 时，系统自动解析并触发对应 Agent
- 被触发 Agent 回复完成后，系统发送信号给 Orchestrator 继续下一步
- 过程自动进行，无需用户手动干预
- 如果 Orchestrator 消息中没有 @mention（只是纯文本回复），链条结束

**FR-31 结果聚合**
- 所有子任务完成后，Orchestrator 发送总结消息
- 总结包含：完成了什么、生成的文件列表、如何预览
- 每条代码消息下方出现操作按钮

**FR-32 任务链安全限制 (maxChainDepth)**
- 限制 Orchestrator 任务链的最大深度，防止递归触发
- 默认 maxChainDepth = 5，超过深度后任务链终止并通知用户
- 深度计数在每次 Orchestrator 触发新的子任务链时递增

**FR-33 Agent 调用次数限制 (maxAgentCallsPerPlan)**
- 限制单个任务计划最多触发的 Agent 调用次数
- 默认 maxAgentCallsPerPlan = 20，防止任务计划无限扩展
- 达到上限后后续子任务自动标记为 CANCELLED

**FR-34 子任务重试预算 (retryBudget)**
- 每个子任务最多重试次数，默认 3 次
- 重试原因包括：LLM 调用超时、API 错误、验证失败
- 超过重试预算后子任务标记为 FAILED，任务链继续或终止取决于配置

**FR-35 任务链取消 (cancelTaskPlan)**
- 用户可以在任务计划卡片中点击「取消」终止整个任务链
- 已完成的子任务结果保留，未开始的子任务标记为 CANCELLED
- 正在执行中的子任务等待其完成后不再触发后续任务

**FR-36 高风险操作确认 (requiresUserApproval)**
- 对于多文件修改（超过 5 个文件）、删除文件或修改配置文件等高风险操作
- Orchestrator 在触发相关子任务前可要求用户确认
- 用户确认后任务链继续，拒绝后相关子任务跳过
- 此功能为可选增强，MVP 可先不做

**FR-37 任务链状态展示**
- 前端展示预计调用次数、已完成/失败/待执行子任务数
- 展示每个子任务的执行状态和失败原因
- 支持展开查看子任务的详细追踪信息（token 消耗、工具调用、耗时）

---

### 3.7 代码 Diff 展示

**FR-38 右侧工程面板**
- 聊天窗口右侧有一个可折叠的工程面板
- 面板包含两个 Tab：「代码对比」和「网页预览」

**FR-39 代码提取**
- Agent 消息中的 Markdown 代码块（```language ... ```）被自动提取（MVP 简化方案）
- 提取出的文件按 Agent 和语言分组
- 右侧面板显示文件树
- **正式代码工作流主路径**：通过 AI Harness 生成的 FilePatch 列表，提供精确的文件路径、修改类型和变更内容
- Markdown 代码块提取作为 LLM 模式下的快速路径保留；Platform 模式和后续正式流程以 FilePatch 为准

**FR-40 Monaco Diff 对比**
- 点击文件树中的文件，在 Monaco DiffEditor 中展示
- 左侧显示原始代码（首次生成为空），右侧显示 Agent 生成的代码
- 差异高亮：新增（绿）、修改（黄）、删除（红）
- 支持并排（side-by-side）和内联（inline）两种视图

**FR-41 代码编辑（可选，MVP 后）**
- 用户可在 DiffEditor 右侧直接编辑 Agent 生成的代码
- 编辑后可保存到项目中

---

### 3.8 网页预览

**FR-42 手动预览触发**
- Agent 生成前端代码（HTML/CSS/JS 或 React 组件）后
- 消息下方出现「预览」按钮
- 用户点击按钮触发预览

**FR-43 预览执行**
- **纯 HTML/CSS/JS**：前端直接通过 `URL.createObjectURL(blob)` 在 iframe 中渲染
- **React/Vue 项目**：后端 Docker 沙箱安装依赖 → 构建 → Nginx 提供静态文件 → 返回容器端口 → iframe 代理访问
- 右侧面板切换到「网页预览」Tab 展示结果

**FR-44 预览安全**
- Docker 沙箱使用 `--network none --cap-drop ALL --read-only` 隔离
- 超时 30 秒自动终止
- 内存限制 512MB

---

### 3.9 一键部署（后续能力，MVP 不做）

**FR-45 部署触发**
- Agent 完成项目代码后，消息下方出现「部署」按钮
- 用户点击后触发部署流程

**FR-46 部署执行**
- 静态项目：调用 Vercel CLI / Netlify CLI 部署 `dist/` 目录
- 全栈项目：生成 Dockerfile → Docker build → 推送到容器注册表
- 部署成功后返回公网可访问的 URL
- URL 显示在聊天消息中

**FR-47 部署状态**
- 部署过程中显示进度：「正在构建...」「正在部署...」
- 成功后显示 URL
- 失败后显示错误信息

---

### 3.10 多会话并行

**FR-48 同时多个会话**
- 用户可以同时参与多个会话（多个群聊/单聊）
- 在左侧会话列表切换，右侧聊天内容随之切换
- 不同会话的消息互不干扰
- 后台 Agent 仍在其他会话中响应时，不影响当前会话操作

---

## 4. 非功能性需求

**NFR-01 性能**
- WebSocket 消息延迟 < 200ms
- 首屏加载时间 < 3 秒
- 支持同时 100 个 WebSocket 连接

**NFR-02 安全**
- 密码 bcrypt 加密存储
- 使用轻量自研 JWT 鉴权所有 API 和 WebSocket 连接，不引入 Spring Security
- Agent API Key 加密存储
- Docker 沙箱严格隔离（禁网络、禁提权、只读文件系统）

**NFR-03 可用性**
- WebSocket 断线自动重连（指数退避）
- LLM API 调用失败时展示友好错误消息
- Agent 执行超时分档：
  - LLM 模式超时：60s
  - Orchestrator 规划超时：60s
  - Platform CLI 模式超时：180s
  - npm install / build 超时：300s
  - runtime preview sandbox 超时：30s
- 超时后自动终止并通知用户

**NFR-04 可扩展性**
- 适配器层支持新增 LLM Provider（只需实现 BaseLLMAdapter 接口 + 注册）
- 平台模式支持新增 CLI 工具（只需实现 PlatformAdapter 接口 + 注册）
- Agent 可通过数据库配置新增（无需改代码）
- AI Harness 各模块（context_builder、policy、verification、patch_builder）可独立替换或增强
- Orchestrator 可通过提示词和结构化输出 Schema 演进，后续可增加模板兜底

---

## 5. 核心用户场景

### 场景 1：单 Agent 对话

```
1. 用户点击「新建单聊」→ 选择「前端Agent」
2. 进入聊天窗口，输入：「帮我写一个导航栏组件，要有 Logo 和菜单」
3. 前端Agent 开始流式回复，逐字显示：
   「好的，这是一个 React 导航栏组件：```tsx\n...```」
4. 代码块渲染出来，消息下方出现 [查看Diff] [预览] 按钮
5. 用户点击「预览」→ 右侧面板展开，iframe 中显示导航栏效果
```

### 场景 2：Orchestrator 群聊协作

```
1. 用户创建群聊「TodoApp 开发」
2. 勾选加入：前端Agent、后端Agent、Orchestrator
3. 用户发送：「@Orchestrator 帮我开发一个简单的待办事项应用，支持增删改查」
4. Orchestrator 开始回复（流式）：
   
   [Orchestrator]: 收到！我来规划一下「待办事项 CRUD 应用」的开发：

   📋 任务计划：
     1. ⏳ 前端 Todo UI 组件（列表+表单）→ 前端Agent
     2. ⏳ 后端 CRUD API 接口           → 后端Agent
     3. ⏳ 前后端数据对接               → 我来协调

   我们按顺序来。@前端Agent 你先写前端的 Todo 组件，
   包括：列表展示、添加输入框、删除按钮、勾选完成。
   用 React + TailwindCSS 实现。

5. 系统检测到 Orchestrator 消息中的 @前端Agent
   自动触发前端Agent，前端Agent 在群里流式回复代码
   任务计划卡片中「1. 前端 Todo UI」状态变为 🔄执行中 → ✅已完成

6. 前端Agent 回复完毕 → 系统自动通知 Orchestrator 继续
   Orchestrator 继续发消息：

   [Orchestrator]: @前端Agent 做得不错！
   接下来 @后端Agent 请实现待办事项的 CRUD REST API：
   - POST /api/todos 创建
   - GET /api/todos 列表
   - PUT /api/todos/:id 更新
   - DELETE /api/todos/:id 删除
   用 Python FastAPI 实现，数据先存内存。

7. 后端Agent 流式回复代码，任务卡片更新

8. 后端Agent 完成后，Orchestrator 发送总结：

   [Orchestrator]: ✅ 待办事项应用开发完成！
   前端：React Todo 组件 (1个文件)
   后端：FastAPI CRUD API (1个文件)
   点击下方按钮预览效果。

9. 用户点击「预览」→ 看到完整的 Todo 应用
```

---

## 6. 界面布局草图

```
┌──────────────────────────────────────────────────────────────────┐
│  AgentHub 顶栏（用户信息、设置、退出）                              │
├────────────┬─────────────────────────┬───────────────────────────┤
│            │                        │                           │
│  [新建会话] │  [群聊: TodoApp开发]     │  工程面板                 │
│            │                        │  [代码对比] [网页预览]      │
│  ────────  │  ┌─────────────────┐  │                           │
│  会话列表   │  │ [Orchestrator]  │  │  ┌── 文件树 ────────────┐ │
│            │  │ 任务计划卡片...   │  │  │ ◉ TodoApp/          │ │
│  ▸ TodoApp │  └─────────────────┘  │  │   ├─ TodoList.tsx  +3 │ │
│    开发     │  ┌─────────────────┐  │  │   └─ TodoItem.tsx +1 │ │
│             │  │ [前端Agent]     │  │  └────────────────────┘ │ │
│    前端Agent│  │ ```tsx          │  │                           │
│            │  │ const Todo = ()  │  │  ┌── Diff 对比 ────────┐ │ │
│    后端Agent│  │ ...              │  │  │ 原代码 │ AI生成代码  │ │ │
│            │  └─────────────────┘  │  │        │ + const    │ │ │
│  ▸ 登录页   │  ┌─────────────────┐  │  │        │ + TodoList │ │ │
│    开发     │  │ [后端Agent]     │  │  │        │ ...        │ │ │
│            │  │ ```python       │  │  └────────────────────┘ │ │
│            │  │ @app.get("/api")│  │                           │
│            │  │ ...              │  │  ┌── 网页预览 ────────┐ │ │
│            │  └─────────────────┘  │  │ │  ┌─────────────┐ │ │ │
│            │                        │  │ │  │  Todo App   │ │ │ │
│            │  ┌─────────────────┐  │  │ │  │  [添加] [x] │ │ │ │
│            │  │ 输入框 (@mention) │  │  │ │  │  ☐ 买菜    │ │ │ │
│            │  │ [发送]          │  │  │ │  │  ☑ 写代码  │ │ │ │
│            │  └─────────────────┘  │  │ │  └─────────────┘ │ │ │
│            │                        │  │ └────────────────────┘ │ │
└──────────────────────────────────────────────────────────────────┘
```

### 面板说明

| 区域 | 占比 | 内容 |
|------|------|------|
| **左侧会话列表** | ~20% 宽度 | 会话列表，支持搜索，当前选中高亮 |
| **中间聊天窗口** | ~45% 宽度 | 消息列表 + 输入框，核心交互区 |
| **右侧工程面板** | ~35% 宽度 | 代码 Diff 对比 / 网页预览，可折叠 |

---

## 7. 技术约束

1. **前端**：React 18 + TypeScript + Vite + TailwindCSS
2. **后端 (IM)**：Java Spring Boot 3
3. **后端 (AI)**：Python FastAPI
4. **数据库**：MySQL 8.0（持久数据）
5. **数据访问**：纯 MyBatis（Mapper 接口 + XML SQL），不使用 JPA
6. **鉴权**：轻量自研 JWT，不使用 Spring Security
7. **缓存/队列**：Redis（WebSocket session、Redis Streams、Pub/Sub）
8. **沙箱**：Docker
9. **部署方式**：Docker Compose 一键编排本地服务
10. **LLM**：通过统一适配器层对接 OpenAI、Anthropic 和自定义 OpenAI-compatible 协议
11. **项目存储**：MVP 阶段项目文件存 MySQL `project_files` 表，但业务代码必须通过 `ProjectStorageService` 接口访问，禁止直接操作 `project_files` 表，以便后续替换为 Git / 文件系统 / 对象存储

---

## 8. 不做的（明确边界）

| 不做什么 | 原因 |
|---------|------|
| Agent 自主发言（不被 @ 也说话） | 用户选了被动响应模式 |
| 多个前端Agent 实例（如 React前端、Vue前端） | 用户选了固定角色 |
| 语音/视频通话 | 超出比赛范围 |
| 文件上传/图片发送 | MVP 不做，后续可加 |
| Zip 上传 / 拖拽文件夹导入 | MVP 先只支持 GitHub URL |
| 一键部署 | MVP 不做，后续再接 Vercel/Netlify 或容器部署 |
| 消息撤回/编辑/删除 | MVP 不做 |
| 消息已读/未读状态 | MVP 不做 |
| 移动端适配 | 先做桌面端 |

---

## 9. 术语表

| 术语 | 含义 |
|------|------|
| **Agent** | 系统预置的 AI 角色配置（system prompt + agent_mode + platform_type + model + 工具权限），被 @ 时触发一次 AgentTask |
| **AgentTask** | Java 后端创建的结构化任务，包含 taskId、sessionId、agentId、instruction、上下文消息、workspace 文件引用等，投递到 Redis Stream |
| **AgentRun** | 一次 Agent 执行的运行记录，包含 runId、taskId、状态、开始/结束时间、追踪信息 |
| **AI Harness** | Python 后端的工程化执行层，负责任务规格化、上下文构建、workspace 管理、沙箱隔离、patch 生成、验证反馈、流式回传和执行追踪 |
| **Orchestrator** | 特殊 Agent，负责任务拆解与调度，通过任务链串联多个 AgentTask |
| **LLM Mode** | Agent 执行模式之一：Python Harness 通过 BaseLLMAdapter 直接调用 OpenAI / Anthropic / OpenAI-compatible API |
| **Platform Mode** | Agent 执行模式之一：Python Harness 通过 PlatformAdapter 在 Docker 沙箱中启动 Claude Code / Codex CLI |
| **PlatformAdapter** | 平台模式适配器抽象接口，封装 CLI 启动、输出解析和事件回调 |
| **BaseLLMAdapter** | LLM 模式适配器抽象接口，封装统一的 chat/completions 流式调用 |
| **Workspace Snapshot** | 执行前后的文件系统快照，用于生成 FilePatch |
| **FilePatch** | 文件变更的标准表示，包含 filePath、patchType、originalContent、newContent、sourceRunId、status |
| **VerificationReport** | build/lint/test/typecheck/preview 的验证结果报告 |
| **Human Review** | 用户通过 Diff 面板审核 Agent 生成的代码变更，Approve 后写入 project_files |
| **单聊** | 用户和 1 个 Agent 的 1v1 对话，不需要 @ |
| **群聊** | 用户和多个 Agent 的对话，通过 @ 指定谁回复 |
| **适配器层** | 统一的 LLM Provider 抽象接口，支持切换不同模型 |
| **级联触发** | Orchestrator 消息中的 @mention 自动触发对应 Agent 回复 |
| **工程面板** | 右侧可折叠面板，包含代码 Diff 和网页预览 |
| **沙箱** | Docker 隔离环境，按用途分为 build_sandbox（可出站）、runtime_sandbox（禁网只读）、verification_sandbox（临时可写） |
