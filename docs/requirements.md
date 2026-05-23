# AgentHub 需求文档

## 1. 项目概述

AgentHub 是一个 IM 聊天式的多 Agent 协作平台。用户在一个类似飞书/微信的聊天界面中，与多个 AI Agent（前端Agent、后端Agent、测试Agent、Orchestrator 等）进行群聊协作，完成软件开发任务。

**两大核心场景**：
1. **从零开发**：用户像产品经理一样在群里提需求，Orchestrator（项目经理 Agent）自动拆解任务并在群里 @ 对应 Agent，各 Agent 在群里回复代码，用户全程可见协作过程。
2. **已有项目修改**：用户导入现有项目（GitHub URL / 拖拽文件夹 / Zip 上传），在群里 @ Agent 让它分析代码、修 bug、加功能，Agent 的修改通过 Diff 对比展示，用户审核后应用到项目中。

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

> 多个不同角色配置或 Agent 平台任务，通过群聊消息里的 @mention 串联起来。LLM 模式依靠 system prompt 区分角色；平台模式依靠 Claude Code / Codex CLI 在沙箱工作区中完成更复杂的工具调用和文件修改。

这与常驻 Agent Loop（Agent 在服务端长期运行并不断推理-行动-观察）不同。这里是事件驱动的单任务执行，更简单务实，也更容易做权限、成本和生命周期控制。

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

**FR-04 会话列表**
- 左侧边栏显示用户的所有会话
- 每条会话显示：名称、最后一条消息摘要、时间
- 支持按时间倒序排列
- 未读消息数角标（可选，MVP 不做）

**FR-05 创建单聊**
- 用户选择一个 Agent，创建 1v1 会话
- 会话名称默认为 Agent 的显示名称
- 用户在该会话中直接发消息（无需 @），Agent 自动响应

**FR-06 创建群聊**
- 用户创建群聊，自定义名称
- 从 Agent 列表中勾选要加入的 Agent（至少 1 个）
- 创建后群聊中只有用户和选中的 Agent
- 群聊中必须通过 @Agent名称 来指定谁回复

**FR-07 会话成员管理**
- 群聊支持后续添加/移除 Agent
- 移除 Agent 后，该 Agent 不再响应群内消息
- 用户不能退出自己创建的群聊（但可以删除）

**FR-08 删除会话**
- 用户可以删除自己创建的会话
- 删除后消息历史也一并删除

---

### 3.3 消息系统

**FR-09 发送消息**
- 用户在聊天输入框输入文字，按 Enter 发送
- Shift + Enter 换行
- 消息通过 WebSocket 实时发送到后端
- 消息持久化到数据库

**FR-10 消息流式接收**
- Agent 的回复以流式（逐字）方式显示
- 用户看到类似 ChatGPT 的打字效果
- 流式过程中消息气泡持续增长

**FR-11 消息历史**
- 进入会话时，加载最近 50 条历史消息
- 向上滚动加载更多（分页加载）
- 新消息自动滚动到底部

**FR-12 消息类型**
- **普通文本**：默认消息类型
- **代码块**：Agent 消息中的代码，Markdown 渲染 + 语法高亮
- **系统消息**：如「Orchestrator 将 后端Agent 加入了群聊」
- **任务计划**：Orchestrator 发出的结构化任务拆解（特殊的卡片样式）

**FR-13 Agent 消息中的操作按钮**
- Agent 消息中包含代码块时，消息下方出现操作按钮：
  - 「查看 Diff」：在右侧面板打开 Monaco Diff 对比
  - 「预览」：对前端代码触发预览（见 3.6）
  - 「部署」：触发一键部署（见 3.7）

---

### 3.4 Agent 系统

**FR-14 系统预置 Agent**

系统预置以下 Agent，每个有固定的角色和 system prompt：

| Agent 名称 | 标识符 | 职责 | 默认模型 |
|-----------|--------|------|---------|
| 前端Agent | `frontend_agent` | 前端开发：React、Vue、HTML/CSS/JS | Claude Sonnet 4 |
| 后端Agent | `backend_agent` | 后端开发：Spring Boot、Python、数据库 | Claude Sonnet 4 |
| 测试Agent | `test_agent` | 测试：单元测试、集成测试 | GPT-4o |
| Orchestrator | `orchestrator` | 任务拆解与调度 | Claude Sonnet 4 |

**FR-15 Agent 的 @mention 触发**
- 在群聊中，用户必须通过 `@Agent名称` 来指定谁回复
- 系统解析消息中的 @mention，路由到对应 Agent
- 单聊中不需要 @，直接发送即可
- Agent 只在被 @ 时才回复（被动响应）

**FR-16 Agent 的流式响应**
- 被 @ 的 Agent 通过适配器层调用对应 LLM
- LLM 返回的 token 通过 SSE → Java WebSocket → 前端逐字展示
- 前端显示「Agent 正在输入...」动画

**FR-17 Agent 上下文（会话记忆）**
- 每个会话保留完整消息历史
- Agent 被 @ 时，将当前会话的最近 N 条消息作为上下文传给 LLM
- N 默认为 20，可配置
- Agent 能看到之前所有人的对话，理解上下文

---

### 3.5 Orchestrator 协调器

Orchestrator 是核心的多 Agent 协作引擎。它是一个特殊的 Agent，在群聊中扮演项目经理角色。

**FR-18 任务拆解**
- 用户 @Orchestrator 提出开发需求
- Orchestrator 分析需求，拆解为有序子任务
- 拆解策略：先匹配预定义模板，未命中则调用 LLM function calling 拆解
- 子任务包含：序号、描述、指定负责的 Agent、依赖关系

**FR-19 群聊可见调度（核心交互）**

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

**FR-20 任务计划展示**
- Orchestrator 发出的任务计划以特殊卡片样式渲染
- 卡片显示子任务列表及其状态：⏳等待中 → 🔄执行中 → ✅已完成
- 状态实时更新

**FR-21 级联触发链**
- Orchestrator 消息中包含 @mention 时，系统自动解析并触发对应 Agent
- 被触发 Agent 回复完成后，系统发送信号给 Orchestrator 继续下一步
- 过程自动进行，无需用户手动干预
- 如果 Orchestrator 消息中没有 @mention（只是纯文本回复），链条结束

**FR-22 结果聚合**
- 所有子任务完成后，Orchestrator 发送总结消息
- 总结包含：完成了什么、生成的文件列表、如何预览/部署
- 每条代码消息下方出现操作按钮

---

### 3.6 代码 Diff 展示

**FR-23 右侧工程面板**
- 聊天窗口右侧有一个可折叠的工程面板
- 面板包含两个 Tab：「代码对比」和「网页预览」

**FR-24 代码提取**
- Agent 消息中的 Markdown 代码块（```language ... ```）被自动提取
- 提取出的文件按 Agent 和语言分组
- 右侧面板显示文件树

**FR-25 Monaco Diff 对比**
- 点击文件树中的文件，在 Monaco DiffEditor 中展示
- 左侧显示原始代码（首次生成为空），右侧显示 Agent 生成的代码
- 差异高亮：新增（绿）、修改（黄）、删除（红）
- 支持并排（side-by-side）和内联（inline）两种视图

**FR-26 代码编辑（可选，MVP 后）**
- 用户可在 DiffEditor 右侧直接编辑 Agent 生成的代码
- 编辑后可保存到项目中

---

### 3.7 网页预览

**FR-27 手动预览触发**
- Agent 生成前端代码（HTML/CSS/JS 或 React 组件）后
- 消息下方出现「预览」按钮
- 用户点击按钮触发预览

**FR-28 预览执行**
- **纯 HTML/CSS/JS**：前端直接通过 `URL.createObjectURL(blob)` 在 iframe 中渲染
- **React/Vue 项目**：后端 Docker 沙箱安装依赖 → 构建 → Nginx 提供静态文件 → 返回容器端口 → iframe 代理访问
- 右侧面板切换到「网页预览」Tab 展示结果

**FR-29 预览安全**
- Docker 沙箱使用 `--network none --cap-drop ALL --read-only` 隔离
- 超时 30 秒自动终止
- 内存限制 512MB

---

### 3.8 一键部署

**FR-30 部署触发**
- Agent 完成项目代码后，消息下方出现「部署」按钮
- 用户点击后触发部署流程

**FR-31 部署执行**
- 静态项目：调用 Vercel CLI / Netlify CLI 部署 `dist/` 目录
- 全栈项目：生成 Dockerfile → Docker build → 推送到容器注册表
- 部署成功后返回公网可访问的 URL
- URL 显示在聊天消息中

**FR-32 部署状态**
- 部署过程中显示进度：「正在构建...」「正在部署...」
- 成功后显示 URL
- 失败后显示错误信息

---

### 3.9 多会话并行

**FR-33 同时多个会话**
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
- JWT Token 鉴权所有 API 和 WebSocket 连接
- Agent API Key 加密存储
- Docker 沙箱严格隔离（禁网络、禁提权、只读文件系统）

**NFR-03 可用性**
- WebSocket 断线自动重连（指数退避）
- LLM API 调用失败时展示友好错误消息
- Agent 超时（60s）自动终止并通知用户

**NFR-04 可扩展性**
- 适配器层支持新增 LLM Provider（只需实现接口 + 注册）
- Agent 可通过数据库配置新增（无需改代码）
- Orchestrator 模板可通过配置文件新增

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
   点击下方按钮预览效果，或一键部署到线上。

9. 用户点击「预览」→ 看到完整的 Todo 应用
   用户点击「部署」→ 得到线上 URL
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
4. **数据库**：PostgreSQL（持久数据）
5. **缓存**：Redis（WebSocket session）
6. **沙箱**：Docker
7. **部署**：Docker Compose 一键编排
8. **LLM**：通过统一适配器层对接，支持 OpenAI 和 Anthropic 协议

---

## 8. 不做的（明确边界）

| 不做什么 | 原因 |
|---------|------|
| Agent 自主发言（不被 @ 也说话） | 用户选了被动响应模式 |
| 多个前端Agent 实例（如 React前端、Vue前端） | 用户选了固定角色 |
| 语音/视频通话 | 超出比赛范围 |
| 文件上传/图片发送 | MVP 不做，后续可加 |
| 消息撤回/编辑/删除 | MVP 不做 |
| 消息已读/未读状态 | MVP 不做 |
| 移动端适配 | 先做桌面端 |

---

## 9. 术语表

| 术语 | 含义 |
|------|------|
| **Agent** | 系统预置的 AI 角色，有特定的 system prompt 和技能领域 |
| **Orchestrator** | 特殊 Agent，负责任务拆解与调度 |
| **单聊** | 用户和 1 个 Agent 的 1v1 对话，不需要 @ |
| **群聊** | 用户和多个 Agent 的对话，通过 @ 指定谁回复 |
| **适配器层** | 统一的 LLM Provider 抽象接口，支持切换不同模型 |
| **级联触发** | Orchestrator 消息中的 @mention 自动触发对应 Agent 回复 |
| **工程面板** | 右侧可折叠面板，包含代码 Diff 和网页预览 |
| **沙箱** | Docker 隔离环境，用于安全执行 Agent 生成的代码 |
