# AgentHub 概要设计文档

---

## 1. 架构概述

### 1.1 系统定位

AgentHub 是一个多 Agent 协作的 IM 聊天平台。用户通过类飞书/微信的群聊界面，与多个 AI Agent（前端、后端、测试、Orchestrator）交互完成软件开发任务。

### 1.2 系统架构图

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           前端 (React 18 + Vite)                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐ │
│  │ 会话列表  │ │ 聊天窗口  │ │ 工程面板  │ │ 设置页面  │ │ WebSocket    │ │
│  │ Session  │ │ ChatArea │ │Workspace │ │ Settings │ │ Client        │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └───────┬───────┘ │
└──────────────────────────────────────────────────────────────┼──────────┘
                                                               │
              REST (HTTPS) ────────────────────────────────────┤
              WebSocket (WSS) ─────────────────────────────────┘
                                                               │
┌──────────────────────────────────────────────────────────────┼──────────┐
│                     Java Spring Boot 3 (IM 后端)              │          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────────────────┐  │
│  │ 用户模块  │ │ 会话模块  │ │ 消息模块  │ │  WebSocket 模块           │  │
│  │ Auth     │ │ Session  │ │ Message  │ │  WS Handler               │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────┬───────────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┴───────────────┐  │
│  │ Agent   │ │ Provider │ │Orchestr- │ │ 消息队列模块                │  │
│  │ 配置模块 │ │ 配置模块  │ │ ator模块 │ │ Redis Streams Client       │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────┬───────────────┘  │
└──────────────────────────────────────────────────────┼──────────────────┘
                                                       │
                    Redis Streams / Pub/Sub             │
                                                       │
┌──────────────────────────────────────────────────────┼──────────────────┐
│                     Python FastAPI (AI 后端)          │                  │
│  ┌──────────────────────────────────────────────────┴─────────────────┐ │
│  │                      消息队列消费者 (Redis Consumer)                │ │
│  └──────────────────────────────────┬─────────────────────────────────┘ │
│  ┌──────────┐ ┌──────────┐ ┌───────┴────────┐ ┌──────────────────────┐ │
│  │ 适配器层  │ │ 执行器   │ │  流式输出      │ │  沙箱模块             │ │
│  │ Adapter  │ │ Executor │ │  Streamer      │ │  Sandbox (Docker)    │ │
│  └──────────┘ └──────────┘ └────────────────┘ └──────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                            数据层                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────────┐  │
│  │ MySQL      │  │ Redis        │  │ Docker (沙箱/预览)            │  │
│  │ 持久数据     │  │ 缓存/消息队列 │  │ 隔离执行环境                  │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.3 关键设计决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 后端拆分 | Java + Python 双后端 | Java 擅长 WebSocket/IM 场景；Python 是 LLM SDK 的一等公民 |
| 后端间通信 | Redis Streams + Pub/Sub（非 Kafka） | 项目已部署 Redis 做缓存/会话，复用为消息队列可省去 Kafka 的 Broker+KRaft 部署成本。当前并发量低（100 WS 连接），Redis Streams 完全够用，后续有高吞吐需求再迁 Kafka |
| Agent 模型 | 单任务触发，非常驻 Agent 进程 | LLM 模式是一次性 API 调用；平台模式是一次 CLI 任务执行，执行结束即销毁沙箱 |
| 代码安全 | Docker 沙箱隔离 | `--network none --cap-drop ALL --read-only`，杜绝任意代码执行风险 |
| 流式输出 | Python Adapter/CLI 事件流 → Redis Pub/Sub → Java WS → 前端 | 全链路流式，用户可感知 Agent "正在输入" |

---

## 2. 技术选型评估

### 2.1 选型总览

| 组件 | 选型 | 版本 | 评估 |
|------|------|------|------|
| 前端框架 | React + TypeScript | 18.x | 生态成熟，并发特性适合实时更新场景 |
| 构建工具 | Vite | 5.x | HMR 极快，TypeScript 开箱即用 |
| UI 样式 | TailwindCSS | 3.x | 适合快速构建聊天界面，组件级样式隔离 |
| IM 后端 | Java Spring Boot | 3.x | WebSocket 支持完善，JPA 操作数据库便捷 |
| AI 后端 | Python FastAPI | 0.100+ | 异步原生支持好，Anthropic/OpenAI SDK 均为 Python 优先 |
| 数据库 | MySQL | 8.0 | ACID 事务保障消息/会话一致性 |
| 缓存/队列 | Redis | 7.x | 同时承担缓存、会话存储、消息队列三种角色 |
| 容器化 | Docker + Docker Compose | 最新稳定版 | 一键编排所有服务，沙箱复用 Docker 基础设施 |

> **为什么用 MySQL 而非需求文档中的 PostgreSQL？**
> - 项目中 Spring Boot + JPA 搭配 MySQL 是更常见的国内技术栈组合，社区资料丰富
> - MySQL 8.0 的功能性索引、JSON 类型、CHECK 约束已满足设计需求
> - Docker Compose 镜像体积更小（MySQL 8.0 ~150MB vs PostgreSQL 16 ~250MB）
> - 后续如需迁回 PostgreSQL，仅需替换 JDBC Driver + 调整部分 DDL（如 `JSONB` → `JSON`），成本可控

### 2.2 选型风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| Redis Streams 消息可靠性不如 RabbitMQ | 极端情况下消息丢失 | Java 端增加消息确认+重试机制；关键消息写 MySQL 做审计 |
| 双后端增加运维复杂度 | 部署/调试成本高 | Docker Compose 统一编排；统一日志收集 |
| Redis Streams 无内置死信队列 | 失败任务无法自动重试 | Python 消费者实现指数退避重试；超过 3 次失败写 MySQL 告警 |
| Docker 沙箱逃逸 | 安全风险 | 严格限制 `--network none --cap-drop ALL --read-only`；内存限制 512MB；超时 30s |

### 2.3 备选方案对比

| 方案 | 优点 | 缺点 | 结论 |
|------|------|------|------|
| 纯 Java 后端 | 单一技术栈，运维简单 | Anthropic/OpenAI SDK 官方不支持 Java；LLM 流式处理不自然 | 不可取 |
| 纯 Python 后端 | AI 集成最自然 | WebSocket 大规模连接管理不如 Java；ORM 生态不如 JPA | 不可取 |
| Java + Python (REST HTTP) | 实现简单 | 同步调用阻塞；流式 token 需要额外 SSE 代理层 | 可选但不如消息队列解耦 |
| **Java + Python (Redis Streams)** | **解耦彻底；天然支持异步；流式 token 走 Pub/Sub** | **依赖 Redis 稳定性** | **当前选择** |

**消息队列选型对比（为什么是 Redis Streams 而不是 RabbitMQ/Kafka）：**

| | Redis Streams | RabbitMQ | Kafka |
|------|-------------|----------|-------|
| **额外部署成本** | 无（复用 Redis） | 1 个容器（~200MB 内存） | Broker + KRaft（~1GB 内存） |
| **消息确认** | XACK（手动确认） | 内置 ACK/NACK/Requeue | Offset Commit |
| **死信队列** | 需要自建 | 内置 Dead Letter Exchange | 无内置，需自行实现 |
| **持久化保证** | AOF/RDB（可能丢最后几秒） | 消息落盘，默认持久 | 天然持久化 |
| **路由能力** | Consumer Group 按 Stream | Topic/Fanout/Direct 多种 | Partition 级分发 |
| **运维复杂度** | 零额外 | 需关注内存/磁盘告警 | 需关注 Broker/Partition 均衡 |
| **适合场景** | 轻量任务队列（当前场景） | 需要可靠投递的关键业务 | 大规模事件流/日志收集 |

**结论**：当前场景是「用户发消息 → Python 执行 Agent 任务 → 调用 LLM API 或 Agent CLI」，消息丢失的最坏代价是用户重发一次（不是金融交易，不需要 at-least-once 保证）。因此选择运营成本最低的 Redis Streams（零额外部署）。如果后续有高吞吐/高可靠性需求，再迁到 RabbitMQ 或 Kafka。

---

## 3. 模块划分

### 3.1 前端模块

```
src/
├── auth/                  # 认证模块
│   ├── AuthContext.tsx     #   JWT 状态管理、登录/注册/登出
│   ├── LoginPage.tsx       #   登录页面
│   └── RegisterPage.tsx    #   注册页面
├── chat/                   # 聊天核心模块
│   ├── ChatArea.tsx        #   消息列表 + 输入框
│   ├── MessageBubble.tsx   #   单条消息气泡（文本/代码/任务计划）
│   ├── MessageInput.tsx    #   输入框（Enter 发送、Shift+Enter 换行）
│   ├── AgentMention.tsx    #   @mention 自动补全下拉
│   └── StreamRenderer.tsx  #   流式 token 逐字渲染
├── session/                # 会话模块
│   ├── SessionList.tsx     #   左侧会话列表（搜索、排序）
│   └── CreateSession.tsx   #   创建单聊/群聊弹窗
├── workspace/              # 工程面板模块
│   ├── WorkspacePanel.tsx  #   右侧面板容器（可折叠）
│   ├── FileTree.tsx        #   代码文件树展示
│   ├── DiffViewer.tsx      #   Monaco DiffEditor 封装
│   └── Preview.tsx         #   iframe 网页预览（纯HTML走本地 blob URL，React/Vue 项目走沙箱）
├── orchestrator/           # 协调器 UI 模块
│   └── TaskPlanCard.tsx    #   任务计划卡片（子任务状态）
├── settings/               # 设置模块
│   ├── SettingsPage.tsx    #   设置入口
│   └── ProviderConfig.tsx  #   LLM Provider 配置表单
├── shared/                 # 共享 infrastructure
│   ├── WebSocketClient.ts  #   WebSocket 连接管理（自动重连、心跳）
│   ├── api.ts              #   REST API 封装（axios）
│   └── types.ts            #   共享类型定义
└── App.tsx                 # 路由 + 顶层布局
```

**模块职责与对外接口：**

| 模块 | 职责 | 对外暴露 |
|------|------|---------|
| auth | JWT 管理、登录态维护 | `useAuth()` hook → `{ user, token, login, logout }` |
| chat | 消息展示与发送 | `<ChatArea sessionId={...} />` |
| session | 会话列表与创建 | `<SessionList onSelect={...} />` |
| workspace | 代码对比与预览 | `<WorkspacePanel sessionId={...} />` |
| orchestrator | 任务计划卡片 | `<TaskPlanCard plan={...} />` |
| settings | 用户/Provider 配置 | `<SettingsPage />` |
| shared | 基础设施 | `wsClient`, `api`, 通用类型 |

### 3.2 Java 后端模块（Spring Boot 3 标准分层架构）

```
com.agenthub
├── controller/                    # REST 控制器层
│   ├── AuthController.java        #   POST /api/auth/register, /login
│   ├── UserController.java        #   GET/PUT /api/users/me
│   ├── ProviderController.java    #   CRUD /api/providers
│   ├── SessionController.java     #   CRUD /api/sessions, /members
│   ├── MessageController.java     #   GET /api/sessions/{id}/messages
│   ├── AgentController.java       #   GET /api/agents, /agents/{id}/provider
│   ├── SandboxController.java     #   POST import/preview 触发
│   ├── DeployController.java      #   POST /api/sessions/{id}/deploy, GET /api/deploy/{id}
│   └── InternalCredentialController.java # POST /internal/providers/{id}/credentials:resolve
│
├── service/                       # 业务逻辑层（面向接口编程）
│   ├── AuthService.java           #   注册/登录、JWT 签发
│   ├── UserService.java           #   用户 CRUD
│   ├── ProviderService.java       #   Provider 配置 + API Key AES 加解密
│   ├── SessionService.java        #   会话/成员管理
│   ├── MessageService.java        #   消息持久化 + 游标分页查询 + 代码块提取
│   ├── AgentService.java          #   Agent 配置 + Provider 覆盖解析（查 agent_provider_overrides → 回退默认）
│   ├── CredentialService.java     #   内网凭据解析：校验任务归属 + 解密 Provider API Key
│   ├── OrchestratorService.java   #   级联触发引擎 + 任务链编排
│   ├── TaskChainManager.java      #   任务链状态机（PENDING→IN_PROGRESS→COMPLETED）+ 并行执行控制
│   ├── TaskPublisher.java         #   发布任务到 Redis Stream（agent:tasks / sandbox:*）
│   ├── StreamSubscriber.java      #   订阅 Redis Pub/Sub token 流 → 转发 WebSocket
│   └── DeployService.java         #   部署流程编排
│
├── repository/                    # 数据访问层（Spring Data JPA / MyBatis-Plus）
│   ├── UserRepository.java
│   ├── UserProviderRepository.java
│   ├── AgentRepository.java
│   ├── AgentProviderOverrideRepository.java
│   ├── SessionRepository.java
│   ├── SessionMemberRepository.java
│   ├── MessageRepository.java
│   ├── MessageCodeBlockRepository.java
│   ├── TaskPlanRepository.java
│   ├── TaskItemRepository.java
│   ├── ProjectFileRepository.java
│   └── DeploymentRepository.java
│
├── entity/                        # 数据库实体（JPA Entity，一一对应数据库表）
│   ├── User.java                  #   → users 表
│   ├── UserProvider.java          #   → user_providers 表
│   ├── Agent.java                 #   → agents 表
│   ├── AgentProviderOverride.java #   → agent_provider_overrides 表
│   ├── Session.java               #   → sessions 表
│   ├── SessionMember.java         #   → session_members 表
│   ├── Message.java               #   → messages 表
│   ├── MessageCodeBlock.java      #   → message_code_blocks 表
│   ├── TaskPlan.java              #   → task_plans 表
│   ├── TaskItem.java              #   → task_items 表
│   ├── ProjectFile.java           #   → project_files 表
│   └── Deployment.java            #   → deployments 表
│
├── dto/                           # 数据传输对象（与 Entity 分离，不暴露数据库字段）
│   ├── request/                   # 前端请求体
│   │   ├── RegisterRequest.java   #   {username, password}
│   │   ├── LoginRequest.java      #   {username, password}
│   │   ├── UpdateUserRequest.java #   {displayName?, avatarUrl?}
│   │   ├── ProviderRequest.java   #   {type, apiKey, baseUrl?, defaultModel, isDefault?}
│   │   ├── CreateSessionRequest.java  #   {name, type, agentIds[]}
│   │   ├── ImportRequest.java     #   {sourceType, url}
│   │   └── DeployRequest.java     #   {files[]}
│   └── response/                  # 后端返回体（不含敏感字段如 password_hash）
│       ├── AuthResponse.java      #   {token, user}
│       ├── UserResponse.java      #   {id, username, displayName, avatarUrl}
│       ├── SessionResponse.java   #   {id, name, type, lastMessage, updatedAt}
│       ├── MessageResponse.java   #   {id, senderType, senderId, content, type, createdAt}
│       └── AgentResponse.java     #   {id, identifier, name, roleDescription}
│
├── websocket/                     # WebSocket 处理
│   ├── ChatWebSocketHandler.java  #   连接管理、消息路由（DIRECT 自动路由 / GROUP @mention 路由）
│   ├── WebSocketAuthInterceptor.java  #   JWT 鉴权（连接时验证 token）
│   └── SessionSubscriptionManager.java #   会话订阅管理（用户订阅了哪些会话，用于精准推送）
│
├── config/                        # Spring 配置类
│   ├── SecurityConfig.java        #   Spring Security + 路径白名单 + CORS
│   ├── RedisStreamConfig.java     #   Redis Streams 消费者组 + Pub/Sub 配置
│   └── WebSocketConfig.java       #   WebSocket endpoint 注册 + 拦截器链
│
├── security/                      # 安全组件
│   ├── JwtTokenProvider.java      #   JWT 签发（7天有效期）+ 验证 + 过期处理
│   └── JwtAuthFilter.java         #   OncePerRequestFilter：从 Authorization Header 提取 token → 注入 SecurityContext
│
├── common/                        # 公共组件
│   ├── GlobalExceptionHandler.java    #   @RestControllerAdvice：统一异常 → 标准错误响应
│   ├── MentionParser.java         #   @mention 正则解析（提取消息中 @Agent名称 的位置和 ID）
│   └── ApiResponse.java           #   统一响应包装 {code, message, data}
│
└── enums/                         # 枚举常量
    ├── ProviderType.java          #   OPENAI, ANTHROPIC, CUSTOM
    ├── SessionType.java           #   DIRECT, GROUP
    ├── MessageType.java           #   TEXT, CODE, TASK_PLAN, SYSTEM
    ├── MemberType.java            #   USER, AGENT
    ├── TaskStatus.java            #   PENDING, IN_PROGRESS, COMPLETED
    ├── SenderType.java            #   USER, AGENT, SYSTEM
    └── DeployStatus.java          #   PENDING, BUILDING, DEPLOYING, SUCCESS, FAILED
```

**分层调用规则：**

```
                    ┌──────────┐
         HTTP/WSS   │ Websocket│
                    └────┬─────┘
                         │
                    ┌────▼─────┐
                    │Controller│  ← DTO 转换（Request → Service 参数，返回值 → Response）
                    └────┬─────┘
                         │
                    ┌────▼─────┐
                    │ Service  │  ← 业务逻辑、事务边界（@Transactional）
                    └────┬─────┘
                         │
              ┌──────────┼──────────┐
              │                     │
         ┌────▼─────┐         ┌─────▼──────┐
         │Repository│         │TaskPublisher│  → Redis Streams
         └────┬─────┘         └────────────┘
              │
         ┌────▼─────┐
         │  Entity  │  ← 与数据库表一一映射
         └──────────┘
```

**严格规则：**
- Controller 只做参数校验和 DTO 转换，**禁止**包含业务逻辑
- Service 处理所有业务逻辑，调用 Repository 和外部依赖（Redis、TaskPublisher）
- Repository 封装数据访问，**禁止**在 Service 中直接写 SQL/JPA Query
- Entity 是纯数据对象，**禁止**包含业务逻辑（贫血模型）
- DTO 与 Entity 分离：前端绝不直接接收/返回 Entity（防止字段泄漏、循环引用）
- 跨层调用统一走 Service，Controller 不直接调 Repository

### 3.3 Python 后端模块（Agent 平台适配 + LLM 适配双路径架构）

```
agenthub_ai/
├── consumer/                     # 消息队列消费者
│   ├── task_consumer.py          #   消费 Redis Stream: agent:tasks → 解析 agent_mode 分发
│   └── sandbox_consumer.py       #   消费: sandbox:import, sandbox:preview, sandbox:deploy
├── adapter/                      # 适配器层（双路径架构：Agent 平台 / LLM Provider）
│   ├── platform/                 #   Agent 平台适配器（上层：抽象 CLI/Runtime）
│   │   ├── base.py               #     PlatformAdapter 抽象接口
│   │   ├── claude_code.py        #     Claude Code CLI 适配器
│   │   ├── codex.py              #     OpenAI Codex CLI 适配器
│   │   └── registry.py           #     平台注册表（platform_type → Adapter 实例）
│   ├── llm/                      #   LLM Provider 适配器（下层：抽象模型 API）
│   │   ├── base.py               #     BaseLLMAdapter 抽象接口
│   │   ├── openai_adapter.py     #     OpenAI API 适配
│   │   ├── anthropic_adapter.py  #     Anthropic API 适配
│   │   ├── custom_adapter.py     #     自定义 OpenAI 兼容适配
│   │   └── registry.py           #     Provider → Adapter 映射
│   └── models.py                 #     共享数据模型（AgentTask, AgentResult, FilePatch 等）
├── executor/                     # Agent 执行器
│   ├── executor.py               #   根据 agent_mode 分发执行路径，组装 AgentResult
│   └── context_builder.py        #   从消息历史构建上下文
├── streamer/                     # 流式输出模块
│   └── redis_streamer.py         #   stream_message / stream_patch 逐条发布到 Redis Pub/Sub
├── importer/                     # 项目导入模块
│   └── git_cloner.py             #   GitHub URL 浅克隆（--depth 1）→ 过滤无关文件
├── sandbox/                      # 沙箱模块（构建/运行时分离）
│   ├── sandbox_manager.py        #   Docker 容器生命周期 + 网络策略管理
│   ├── preview.py                #   代码预览（纯HTML本地 / 前端项目沙箱构建+serve）
│   └── deploy.py                 #   一键部署（Vercel CLI / Docker build + push）
└── main.py                       # FastAPI 应用入口 + 消费者启动
```

**模块职责：**

| 模块 | 职责 | 输入 | 输出 |
|------|------|------|------|
| consumer | 从 Redis Stream 拉取任务，解析 `agent_mode` 分发到 Executor | Redis Stream 消息 | 内部函数调用 |
| adapter/platform | 抽象 Agent CLI/Runtime：启动 CLI、注入 workspace、捕获输出 | `(AgentTask, workspace_path, llm_config)` | `AgentResult` |
| adapter/llm | 抽象 LLM Provider API：统一的 chat/completions 接口 | `(messages, model, api_key, stream)` | `Iterator[token]` |
| adapter/models | 共享数据模型 | — | `AgentTask`, `AgentResult`, `FilePatch` |
| executor | 根据 `agent_mode` 选择执行路径 → 组装 AgentResult | `(agent_config, session_context, message)` | `AgentResult` |
| streamer | 将 AgentResult 中的 messages/patches 逐条推送到 Redis | `AgentResult` | Redis Pub/Sub 消息 |
| importer | GitHub URL 克隆项目 → 提取文件列表 | `(url, session_id)` | `[{path, content}]` |
| sandbox | Docker 容器管理，按用途区分网络策略 | `(code_files, sandbox_policy)` | `(preview_url \| deploy_url \| error)` |

### 3.4 适配器层设计（双路径架构，关键扩展点）

#### 3.4.1 架构总览

```
                        ┌──────────────────────┐
  agent:tasks 消息      │     Executor          │
  含 agent_mode ───────→│  根据 agent_mode 分发  │
  (PLATFORM / LLM)      └──────┬───────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
     agent_mode = PLATFORM     │     agent_mode = LLM
              │                │                │
    ┌─────────▼─────────┐      │    ┌───────────▼───────────┐
    │ PlatformAdapter   │      │    │ BaseLLMAdapter        │
    │ (Agent 平台适配)  │      │    │ (LLM Provider 适配)   │
    │                   │      │    │                       │
    │ ClaudeCodeAdapter │      │    │ OpenaiAdapter         │
    │ CodexAdapter      │      │    │ AnthropicAdapter      │
    └────────┬──────────┘      │    └───────────┬───────────┘
             │                 │                │
             │ Docker Sandbox  │                │ HTTP/SSE
             │ (CLI 执行环境)  │                │
             ▼                 │                ▼
    ┌────────────────┐         │    ┌───────────────────┐
    │ claude-code CLI│         │    │ api.openai.com    │
    │ codex CLI      │         │    │ api.anthropic.com │
    └────────┬───────┘         │    └─────────┬─────────┘
             │                 │              │
             └─────────┬───────┘              │
                       │                      │
                       └──────────┬───────────┘
                                  │
                         ┌────────▼────────┐
                         │   AgentResult   │
                         │   统一输出格式   │
                         └─────────────────┘
```

#### 3.4.2 Agent 执行模式

| 模式 | `agent_mode` | 执行方式 | 适用场景 |
|------|-------------|---------|---------|
| **平台模式** | `PLATFORM` | Docker 沙箱中启动 Claude Code / Codex CLI，Agent 拥有完整的文件系统、tool calling 和自主规划能力 | 复杂开发任务、多文件修改、需要工具链的项目 |
| **LLM 模式** | `LLM` | 直接调用 LLM API（OpenAI / Anthropic），通过 system prompt 设定角色行为 | 简单问答、单一代码片段生成、轻量任务 |

**agent:tasks 消息中追加的字段：**

```json
{
  "agentMode": "PLATFORM",           // PLATFORM 或 LLM
  "platformType": "CLAUDE_CODE",     // 仅 PLATFORM 模式：CLAUDE_CODE / CODEX
  "providerId": "provider-uuid",     // Java 端已校验权限的 Provider 引用
  "providerType": "ANTHROPIC",       // OPENAI / ANTHROPIC / CUSTOM
  "model": "claude-sonnet-4-20250514",
  "baseUrl": "https://api.anthropic.com",
  "workspaceFiles": [...],           // 仅 PLATFORM 模式：挂载到沙箱的项目文件
  ...
}
```

#### 3.4.3 PlatformAdapter 接口（Agent 平台路径）

```python
# adapter/platform/base.py
from dataclasses import dataclass, field
from typing import Optional, List, AsyncIterator, Callable
from abc import ABC, abstractmethod

@dataclass
class AgentTask:
    task_id: str
    session_id: str
    agent_id: str
    instruction: str                    # 用户消息 / Orchestrator 分配的任务描述
    context_messages: List[dict]        # 会话最近 N 条消息
    workspace_files: List[dict]         # [{path, content}] 项目文件（仅 PLATFORM 模式）
    llm_ref: LLMRef                    # Provider 引用，不包含明文 API Key

@dataclass
class LLMRef:
    provider_id: str                   # Java 已校验过归属权的 Provider ID
    provider_type: str                  # OPENAI / ANTHROPIC
    model: str
    base_url: Optional[str]

@dataclass
class ResolvedLLMConfig(LLMRef):
    api_key: str                       # Python 执行前通过 Java 内网接口临时解析

@dataclass
class AgentResult:
    """统一的 Agent 执行结果，无论平台模式还是 LLM 模式都返回此结构"""
    task_id: str
    status: str                         # SUCCESS / TIMEOUT / ERROR
    messages: List[ChatMessage] = field(default_factory=list)
    patches: List[FilePatch] = field(default_factory=list)
    artifacts: List[FileArtifact] = field(default_factory=list)
    error: Optional[str] = None

@dataclass
class ChatMessage:
    role: str                           # assistant / tool
    content: str                        # Markdown 文本
    message_type: str                   # TEXT / CODE / TASK_PLAN

@dataclass
class FilePatch:
    """文件变更的标准化表示（统一 diff 模型）"""
    file_path: str                      # 相对路径
    original_content: Optional[str]     # None 表示新文件
    new_content: str
    patch_type: str                     # CREATE / MODIFY / DELETE

@dataclass
class FileArtifact:
    """完整的生成文件"""
    file_path: str
    content: str
    language: str

class PlatformAdapter(ABC):
    """Agent 平台适配器抽象接口"""

    @abstractmethod
    async def execute(
        self,
        task: AgentTask,
        workspace_dir: str,                    # 挂载到沙箱的工作目录
        llm_config: ResolvedLLMConfig,          # 含明文 API Key，仅在内存中短暂存在
        on_message: Callable[[ChatMessage], None],  # 实时消息回调 → streamer
        on_patch: Callable[[FilePatch], None],       # 实时 patch 回调 → streamer
    ) -> AgentResult:
        """在沙箱中启动 Agent CLI，实时回调消息和文件变更，最终返回 AgentResult"""
        ...

# adapter/platform/registry.py
PLATFORM_REGISTRY = {
    "CLAUDE_CODE": ClaudeCodeAdapter(),
    "CODEX":       CodexAdapter(),
}
```

#### 3.4.4 ClaudeCodeAdapter 实现概要

```python
# adapter/platform/claude_code.py
class ClaudeCodeAdapter(PlatformAdapter):
    async def execute(self, task, workspace_dir, llm_config, on_message, on_patch):
        # 1. 构建 Claude Code CLI 命令
        #    claude --print --output-format stream-json
        cmd = build_claude_code_command(task.instruction)

        # 2. Docker 沙箱启动 CLI（build_sandbox 策略：允许网络访问 npm registry）
        container = await sandbox_manager.create(
            image="agenthub/claude-code:latest",  # 预装 Claude Code CLI 的镜像
            workspace=workspace_dir,
            network="build_sandbox",               # 允许出站（npm/API），禁止入站
            memory="1024m",
            timeout=180,                            # CLI 模式超时更长
            environment=build_cli_env(llm_config)   # ANTHROPIC_API_KEY / OPENAI_API_KEY
        )

        # 3. 流式读取 CLI 输出，逐行解析 JSON 事件
        async for event in container.exec_stream(cmd):
            if event["type"] == "assistant":
                msg = ChatMessage(role="assistant", content=event["message"])
                await on_message(msg)

            elif event["type"] == "tool_use":
                msg = ChatMessage(role="tool", content=f"调用工具: {event['tool']}")
                await on_message(msg)

            elif event["type"] == "file_change":
                patch = FilePatch(
                    file_path=event["path"],
                    original_content=event.get("original"),
                    new_content=event["content"],
                    patch_type=event["action"]      # CREATE / MODIFY / DELETE
                )
                await on_patch(patch)

        # 4. 收集执行结果
        return AgentResult(
            task_id=task.task_id,
            status="SUCCESS",
            messages=collected_messages,
            patches=collected_patches,
            artifacts=collected_artifacts
        )
```

#### 3.4.5 BaseLLMAdapter 接口（LLM 直连路径，现有接口保持不变）

```python
# adapter/llm/base.py
class BaseLLMAdapter(ABC):
    @abstractmethod
    async def chat(
        self,
        messages: List[Dict[str, str]],
        model: str,
        api_key: str,
        base_url: Optional[str],
        stream: bool = True
    ) -> AsyncIterator[str]:              # token 迭代器
        ...

# adapter/llm/registry.py
LLM_ADAPTER_REGISTRY = {
    ProviderType.OPENAI:     OpenaiAdapter(),
    ProviderType.ANTHROPIC:  AnthropicAdapter(),
    ProviderType.CUSTOM:     CustomAdapter(),
}
```

**两条调用路径的关系**：
- `PlatformAdapter` 和 `BaseLLMAdapter` 是并列执行路径，由 `Executor` 根据 `agentMode` 选择
- `PLATFORM` 模式启动 Claude Code / Codex CLI，CLI 自己读取环境变量并调用对应的大模型 API
- `LLM` 模式不启动 CLI，由 `BaseLLMAdapter` 直接调用 OpenAI / Anthropic / OpenAI-compatible API
- 两条路径共用 `LLMRef`、`ResolvedLLMConfig` 和 `AgentResult`，上层 Java 不感知具体执行细节
- 新增 Agent 平台只需实现 `PlatformAdapter`；新增模型服务商只需实现 `BaseLLMAdapter`

### 3.5 沙箱实现细节

#### 3.5.1 镜像预构建

每次请求都 `docker build` 会非常慢（分钟级），所以把 CLI 环境提前打包成镜像：

```dockerfile
# sandbox/Dockerfile.claude-code — 预装 Claude Code CLI 的沙箱镜像
FROM node:20-slim

RUN npm install -g @anthropic-ai/claude-code
WORKDIR /workspace
```

部署时构建一次：`docker build -t agenthub/sandbox:claude-code -f sandbox/Dockerfile.claude-code .`

#### 3.5.2 运行时流程

Python 使用 `docker-py` 库管理容器，每次 Agent 调用执行以下步骤：

```
executor.py
  │
  │ 1. 把项目文件写入临时目录 /tmp/workspace/{task_id}/
  │ 2. 调用 Java 内网凭据接口解析 Provider，得到 ResolvedLLMConfig
  │ 3. 调用 sandbox_manager.create(policy="build_sandbox", workspace=...)
  │
  ▼
sandbox_manager.py
  │
  │ 4. docker_client.containers.run(
  │       image="agenthub/sandbox:claude-code",
  │       command="claude --print --output-format stream-json -p '任务描述'",
  │       volumes={"/tmp/workspace/{task_id}": {"bind": "/workspace", "mode": "rw"}},
  │       environment=build_cli_env(llm_config),  # CLI 内部调 API 用的 key
  │       network="bridge",     # build_sandbox：允许访问外网（npm/LLM API）
  │       cap_drop=["ALL"],     # 禁止容器内提权
  │       mem_limit="1024m",
  │       auto_remove=True,
  │       detach=True,
  │    )
  │
  │ 5. 流式读 container.logs(stdout=True, stderr=True, stream=True)
  │    → 逐行 yield JSON 事件
  │
  │ 6. 命令结束 → container.remove(force=True)
  │ 7. shutil.rmtree(临时目录)
  │
  ▼
executor.py 收齐事件 → 组装 AgentResult{ messages, patches, artifacts } → 返回
```

#### 3.5.3 两种沙箱策略

| | build_sandbox | runtime_sandbox |
|------|-------------|--------------|
| **用途** | Claude Code CLI 运行、npm install、git clone | 预览模式 serve 静态文件 |
| **网络** | `--network=bridge`（需要访问 npm registry + LLM API） | `--network=none`（完全断网） |
| **文件系统** | 可读写（Agent 要创建/修改文件） | `--read-only`（仅提供已构建产物） |
| **capabilities** | `--cap-drop=ALL`（禁止容器内提权） | `--cap-drop=ALL` |
| **内存** | 1024m | 512m |
| **超时** | 180s | 30s |
| **镜像** | `agenthub/sandbox:claude-code` | `nginx:alpine`（轻量静态文件服务） |

#### 3.5.4 Claude Code CLI 输出事件类型

`claude --print --output-format stream-json` 输出的每一行是一个 JSON 事件：

| 事件类型 | 含义 | 映射到 AgentResult |
|---------|------|-------------------|
| `assistant` | Claude Code 说的话（文本+代码） | `ChatMessage` → 推到聊天 |
| `tool_use` | 执行的工具（读文件、写文件、跑命令等） | `ChatMessage(role="tool")` → 展示工具调用 |
| `file_change` | 文件变更（创建/修改/删除） | `FilePatch` → 推到 Diff 面板 |
| `result` | 任务完成，包含最终状态 | `AgentResult.status` |

#### 3.5.5 LLM 调用与 API Key 解析链路

AgentHub 不在 Redis Stream 中传递明文 API Key。Java 只把 `providerId`、`providerType`、`model`、`baseUrl` 等非密钥配置写入 `agent:tasks`；Python 在真正执行任务前，通过 Java 的内网凭据接口临时解析密钥。

```
用户设置页面 → 填 API Key → AES-256-GCM 加密存入 user_providers 表
                                        │
用户 @Agent 发消息                        │
        │                               │
        ▼                               │
Java AgentService.resolveProvider():     │
  1. 查 agent_provider_overrides        │
     → 有覆盖？用覆盖的 provider_id      │
     → 无覆盖？用 is_default=1 的        │
  2. 校验 provider 属于当前用户          │
  3. 填入 agent:tasks 消息:
     { "providerId": "provider-uuid",
       "providerType": "ANTHROPIC",
       "model": "claude-sonnet-4-20250514",
       "baseUrl": "https://api.anthropic.com",
       ... }
        │
        │  Redis Stream（内网，AOF 可持久化，但不含明文 API Key）
        ▼
Python executor.py:
  4. 读取 agent:tasks
  5. 调用 Java 内网接口:
     POST /internal/providers/{providerId}/credentials:resolve
     Header: X-Service-Token
     Body: {taskId, sessionId, agentId}
        │
        ▼
Java CredentialService:
  6. 校验 service token + 任务归属
  7. 读取 user_providers.api_key_enc
  8. AES 解密 → 返回一次性明文 api_key（仅 Docker 内网响应）
        │
        │
        ▼
Python executor.py:
  9. 组装 ResolvedLLMConfig(providerId, providerType, model, baseUrl, apiKey)
  10. 根据 agentMode 选择调用路径:
      - LLM 模式：BaseLLMAdapter.chat(..., api_key=apiKey)
      - PLATFORM 模式：docker run -e ANTHROPIC_API_KEY=... / OPENAI_API_KEY=...
  
LLM Provider / Agent CLI:
  11. OpenAI / Anthropic / Claude Code / Codex 返回流式输出
  12. Python 将 token、工具事件、文件 patch 推到 Redis Pub/Sub / Stream
  13. Java 转发到 WebSocket，前端逐字渲染并展示 Diff
```

**不同平台的认证方式：**

| Agent 平台 | 环境变量 | 值来源 |
|-----------|---------|--------|
| Claude Code | `ANTHROPIC_API_KEY` | 用户的 Anthropic Provider 的 `api_key` |
| Codex | `OPENAI_API_KEY` | 用户的 OpenAI Provider 的 `api_key` |

**安全保证：**
- 数据库存储的是密文（AES-256-GCM），AES 密钥通过 Docker Compose 环境变量 `AES_KEY` 注入，不写死在代码里
- Redis Stream 中只保存 `providerId` 等引用信息，不保存明文 API Key，避免 Redis AOF/RDB 将密钥落盘
- 明文 API Key 只存在于 Java 解密响应、Python 进程内存和单次沙箱容器环境变量中，不返回前端
- 容器销毁后环境变量随之消失，不会泄漏到其他请求
- 前端编辑 Provider 时，API Key 字段始终显示为 `****`，不回显明文

---

## 4. 模块间接口

### 4.1 REST API（前端 ↔ Java 后端）

#### 4.1.1 认证

| 方法 | 路径 | 说明 | 请求体 | 响应 |
|------|------|------|--------|------|
| POST | `/api/auth/register` | 注册 | `{username, password}` | `{token, user}` |
| POST | `/api/auth/login` | 登录 | `{username, password}` | `{token, user}` |

#### 4.1.2 用户

| 方法 | 路径 | 说明 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/api/users/me` | 获取当前用户 | — | `{id, username, displayName, avatarUrl}` |
| PUT | `/api/users/me` | 更新当前用户 | `{displayName?, avatarUrl?}` | `{...}` |

#### 4.1.3 Provider 配置

| 方法 | 路径 | 说明 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/api/providers` | 用户的所有 Provider | — | `[{id, type, baseUrl, defaultModel, isDefault}]` |
| POST | `/api/providers` | 添加 Provider | `{type, apiKey, baseUrl?, defaultModel}` | `{id, ...}` |
| PUT | `/api/providers/{id}` | 更新 Provider | `{apiKey?, baseUrl?, defaultModel?, isDefault?}` | `{...}` |
| DELETE | `/api/providers/{id}` | 删除 Provider | — | `204` |

#### 4.1.4 会话

| 方法 | 路径 | 说明 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/api/sessions` | 会话列表 | — | `[{id, name, type, lastMessage, updatedAt}]` |
| POST | `/api/sessions` | 创建会话 | `{name, type, agentIds[]}` | `{id, name, ...}` |
| DELETE | `/api/sessions/{id}` | 删除会话 | — | `204` |
| GET | `/api/sessions/{id}/members` | 成员列表 | — | `[{id, memberType, memberId, name}]` |
| POST | `/api/sessions/{id}/members` | 添加成员 | `{agentIds[]}` | `[{...}]` |
| DELETE | `/api/sessions/{id}/members/{memberId}` | 移除成员 | — | `204` |

#### 4.1.5 消息

| 方法 | 路径 | 说明 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/api/sessions/{id}/messages` | 历史消息（游标分页） | `?before={createdAt}&limit=50` | `[{id, senderType, senderId, content, type, createdAt}]` |

> **游标格式**：`before` 参数为 ISO 8601 时间戳字符串（如 `2026-05-24T10:30:00Z`），表示取该时间之前的消息。首次请求不传 `before`，返回最新的 50 条；后续用返回列表最后一条的 `createdAt` 作为下一页的 `before`。游标分页替代传统 offset 分页，避免新增消息导致翻页错位。

#### 4.1.6 Agent

| 方法 | 路径 | 说明 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/api/agents` | 可用 Agent 列表 | — | `[{id, identifier, name, roleDescription}]` |
| GET | `/api/agents/{id}/provider` | 查询 Agent 的 Provider 覆盖 | — | `{providerId, providerName}` 或 `null`（未覆盖时使用默认） |
| PUT | `/api/agents/{id}/provider` | 为 Agent 指定 Provider | `{providerId}` | `{providerId}` |
| DELETE | `/api/agents/{id}/provider` | 取消覆盖（恢复默认） | — | `204` |

#### 4.1.7 项目导入与预览

| 方法 | 路径 | 说明 | 请求体 | 响应 |
|------|------|------|--------|------|
| POST | `/api/sessions/{id}/import` | 导入项目 | `{sourceType: "github", url: "https://..."}` | `{fileCount, files: [{path, content}]}` |
| POST | `/api/sessions/{id}/preview` | 触发预览 | `{files: [{path, content}], type: "html"\|"react"\|"vue"}` | `{previewId, status: "building"}` |
| GET | `/api/preview/{id}` | 查询预览状态 | — | `{id, status, url?, error?}` |

**导入流程**：Java 发布任务到 Redis Stream `sandbox:import` → Python `importer/git_cloner.py` 消费 → 克隆仓库（浅克隆，`--depth 1`）→ 过滤 `.git`/`node_modules`/`.DS_Store` 等 → 返回文件列表 → Java 写入 `project_files` 表。

**预览流程**：
- `type = "html"` → 前端直接 `URL.createObjectURL(blob)` + iframe 本地渲染（不经过后端）
- `type = "react"|"vue"` → Java → Redis `sandbox:preview` → Python Docker 沙箱 `npm install` → `npm run build` → Nginx serve → 返回端口 URL

#### 4.1.8 部署

| 方法 | 路径 | 说明 | 请求体 | 响应 |
|------|------|------|--------|------|
| POST | `/api/sessions/{id}/deploy` | 触发部署 | `{files[]}` | `{deployId, status: "building"}` |
| GET | `/api/deploy/{id}` | 查询部署状态 | — | `{id, status, url?, error?}` |

#### 4.1.9 代码审核（Diff 闭环）

Agent 生成的代码块先展示在 Diff 面板，用户审核后才应用到项目文件。

| 方法 | 路径 | 说明 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/api/messages/{id}/review` | 查询审核状态 | — | `{reviewId, status, createdAt}` |
| POST | `/api/messages/{id}/review` | 执行审核 | `{action: "approve"\|"reject"}` | `{reviewId, status, reviewedAt}` |

**审核流程**：
1. Agent 消息生成 → Java 自动创建 `code_reviews` 记录（status=PENDING）
2. 前端展示 Diff 面板 + `[Approve]` `[Reject]` 按钮
3. 用户点击 Approve → 代码块写入 `project_files`（新文件插入 / 已有文件更新版本号）
4. 用户点击 Reject → 代码块保留在聊天记录中但不应用

#### 4.1.10 内部凭据接口（Python AI 后端 ↔ Java 后端）

该接口只允许 Docker 内部网络访问，并要求 `X-Service-Token`。前端不能调用。

| 方法 | 路径 | 说明 | 请求体 | 响应 |
|------|------|------|--------|------|
| POST | `/internal/providers/{providerId}/credentials:resolve` | Python 执行 Agent 任务前解析一次性 API Key | `{taskId, sessionId, agentId}` | `{providerType, model, baseUrl?, apiKey}` |

**校验规则**：
1. `X-Service-Token` 必须匹配服务间共享密钥
2. `taskId/sessionId/agentId/providerId` 必须与 Java 发布的任务记录一致
3. `providerId` 必须属于该会话 owner 或该 Agent 的用户级覆盖配置
4. 接口响应不缓存、不写日志；日志中只记录 `providerId` 和脱敏后的模型信息

### 4.2 WebSocket 协议（前端 ↔ Java 后端）

**连接：** `ws://host/ws/chat?token=<JWT>`

**上行消息（前端 → 后端）：**

**群聊消息（需要 @mention 指定 Agent）：**

```json
{
  "type": "chat.send",
  "payload": {
    "sessionId": "uuid",
    "content": "消息文本，可能包含 @前端Agent",
    "mentions": [
      {"agentId": "uuid", "displayName": "前端Agent", "startPos": 0, "endPos": 6}
    ]
  }
}
```

**单聊消息（无需 @mention，自动路由到会话中唯一的 Agent）：**

```json
{
  "type": "chat.send",
  "payload": {
    "sessionId": "uuid",
    "content": "帮我写一个导航栏组件"
  }
}
```

**路由规则**（Java `ChatWebSocketHandler` 中实现）：
- 会话类型为 `DIRECT` → 忽略 `mentions` 字段，消息自动路由到该会话中唯一的 Agent 成员
- 会话类型为 `GROUP` → 必须包含 `mentions`，提取所有被 @ 的 Agent 依次触发；若 `mentions` 为空则仅存储消息不触发 Agent

**下行消息（后端 → 前端）：**

```json
// 普通文本消息
{
  "type": "chat.message",
  "payload": {
    "messageId": "uuid",
    "sessionId": "uuid",
    "senderType": "AGENT",
    "senderId": "agent-uuid",
    "senderName": "前端Agent",
    "content": "好的，这是代码...",
    "messageType": "TEXT"
  }
}

// 流式 token 块
{
  "type": "chat.stream",
  "payload": {
    "messageId": "uuid",
    "sessionId": "uuid",
    "agentId": "agent-uuid",
    "token": "const",
    "isComplete": false
  }
}

// 流式完成
{
  "type": "chat.stream",
  "payload": {
    "messageId": "uuid",
    "sessionId": "uuid",
    "agentId": "agent-uuid",
    "isComplete": true
  }
}

// Agent 操作按钮
{
  "type": "chat.actions",
  "payload": {
    "messageId": "uuid",
    "actions": ["diff", "preview", "deploy"],
    "codeBlocks": [
      {"language": "tsx", "fileName": "TodoList.tsx", "content": "..."}
    ]
  }
}

// 系统通知
{
  "type": "chat.system",
  "payload": {
    "sessionId": "uuid",
    "content": "前端Agent 已加入群聊"
  }
}

// 任务计划状态更新
{
  "type": "task.update",
  "payload": {
    "taskPlanId": "uuid",
    "items": [
      {"sequence": 1, "status": "IN_PROGRESS", "assignedAgent": "前端Agent"}
    ]
  }
}

// 错误
{
  "type": "chat.error",
  "payload": {
    "messageId": "uuid",
    "sessionId": "uuid",
    "error": "LLM 调用超时，请重试"
  }
}
```

**WebSocket 重连策略：**

| 场景 | 策略 |
|------|------|
| 意外断线 | 指数退避重连：1s → 2s → 4s → 8s → 16s（最大 30s） |
| 重连成功 | 自动重新订阅之前的会话；拉取断线期间的消息 |
| JWT 过期 | 返回 4001 → 前端跳转登录页 |
| 心跳 | 每 30s 发送 `ping`，60s 无响应视为断线 |

### 4.3 消息队列接口（Java ↔ Python）

**Redis Streams 定义：**

| Stream | 方向 | 说明 | 消息格式 |
|--------|------|------|---------|
| `agent:tasks` | Java → Python | Agent 调用任务 | `{taskId, sessionId, agentId, agentMode, platformType?, providerId, providerType, model, baseUrl?, instruction, messages, workspaceFiles?}` |
| `agent:results` | Python → Java | Agent 调用完成 | `{taskId, status, messages, codeBlocks, patches, artifacts, error?}` |
| `sandbox:import` | Java → Python | GitHub 项目导入 | `{taskId, sessionId, sourceType, url}` |
| `sandbox:preview` | Java → Python | 代码预览请求 | `{taskId, sessionId, files:[{path, content}], type}` |
| `sandbox:deploy` | Java → Python | 一键部署请求 | `{taskId, sessionId, files:[{path, content}]}` |
| `sandbox:results` | Python → Java | 沙箱/导入执行结果 | `{taskId, status, url?, files?, error?}` |

**Redis Pub/Sub Channels（流式 token 实时推送）：**

| Channel | 方向 | 说明 |
|---------|------|------|
| `agent:stream:{taskId}` | Python → Java | 逐 token 推送，Java 订阅后转发 WebSocket |

**消息格式规范（JSON）：**

> **Provider 解析逻辑**（Java 发布消息前执行）：
> 1. 查 `agent_provider_overrides(user_id, agent_id)` → 有则用指定的 Provider
> 2. 无覆盖 → 用该用户的默认 Provider（`user_providers.is_default = 1`）
> 3. Java 只把 `providerId`、`providerType`、`model`、`baseUrl` 填入 `agent:tasks`
> 4. Python 消费任务后，通过 Java 内网凭据接口临时解析 API Key，避免明文密钥进入 Redis Stream

```json
// agent:tasks
{
  "taskId": "uuid",
  "sessionId": "uuid",
  "agentId": "uuid",
  "agentMode": "PLATFORM",
  "platformType": "CLAUDE_CODE",
  "providerId": "provider-uuid",
  "providerType": "ANTHROPIC",
  "systemPrompt": "你是前端专家...",
  "model": "claude-sonnet-4-20250514",
  "baseUrl": "https://api.anthropic.com",
  "instruction": "实现一个待办事项应用",
  "messages": [
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "..."}
  ],
  "workspaceFiles": [
    {"path": "package.json", "content": "..."}
  ],
  "contextLimit": 20
}

// agent:stream:{taskId} — Pub/Sub 逐 token
{
  "taskId": "uuid",
  "sessionId": "uuid",
  "agentId": "uuid",
  "token": "const",
  "sequence": 42
}

// agent:results
{
  "taskId": "uuid",
  "status": "SUCCESS",
  "messages": [
    {"role": "assistant", "content": "完整的 Agent 回复...", "messageType": "TEXT"}
  ],
  "codeBlocks": [
    {"language": "tsx", "fileName": "TodoList.tsx", "content": "import React..."}
  ],
  "patches": [
    {
      "filePath": "src/components/TodoList.tsx",
      "patchType": "CREATE",
      "originalContent": null,
      "newContent": "import React..."
    }
  ],
  "artifacts": [
    {"filePath": "dist/index.html", "content": "...", "language": "html"}
  ],
  "error": null
}
```

**失败处理：**

| 场景 | 处理 |
|------|------|
| LLM API 超时（60s） | Python 返回 `status: TIMEOUT`，Java 发送系统错误消息到前端 |
| LLM API 鉴权失败 | Python 返回 `status: AUTH_ERROR`，前端提示用户检查 API Key |
| Redis Stream 消费失败 | Python 消费者指数退避重试，超过 3 次写入死信 MySQL 表 |
| Redis Pub/Sub 消息丢失 | 最终 `agent:results` 包含 `messages/codeBlocks/patches/artifacts`，前端以完整结果兜底渲染 |

### 4.4 模块交互时序

#### 4.4.1 群聊 @Agent 消息处理流程

```
用户                     前端                   Java后端              Redis               Python后端            LLM API
 │                       │                      │                    │                     │                    │
 │ 输入 @前端Agent ...   │                      │                    │                     │                    │
 │──────────────────────→│                      │                    │                     │                    │
 │                       │ WS: chat.send        │                    │                     │                    │
 │                       │─────────────────────→│                    │                     │                    │
 │                       │                      │ 1. 解析 @mention    │                    │                     │                    │
 │                       │                      │ 2. 查 Agent 配置    │                    │                     │                    │
 │                       │                      │ 3. 查 Provider 配置 │                    │                     │                    │
 │                       │                      │ 4. 构建消息上下文   │                    │                     │                    │
 │                       │                      │ 5. 持久化用户消息   │                    │                     │                    │
 │                       │                      │                    │                    │                     │                    │
 │                       │                      │ XADD agent:tasks    │                    │                     │                    │
 │                       │                      │───────────────────→│                    │                     │                    │
 │                       │ WS: chat.stream      │                    │                    │                     │                    │
 │                       │←─────────────────────│                    │                    │                     │                    │
 │  "前端Agent 正在输入"  │                      │                    │                    │                     │                    │
 │←──────────────────────│                      │                    │                    │                     │                    │
 │                       │                      │                    │ XREAD agent:tasks  │                     │                    │
 │                       │                      │                    │←───────────────────│                     │                    │
 │                       │                      │                    │                    │ chat(messages)      │                    │
 │                       │                      │                    │                    │────────────────────→│
 │                       │                      │                    │                    │ token1              │                    │
 │                       │                      │                    │                    │←────────────────────│
 │                       │                      │                    │ PUB agent:stream    │                     │                    │
 │                       │                      │                    │←───────────────────│                     │                    │
 │                       │                      │ SUBSCRIBE 收到 token│                    │                     │                    │
 │                       │                      │←───────────────────│                    │                     │                    │
 │                       │ WS: chat.stream      │                    │                     │                    │
 │                       │←─────────────────────│                    │                     │                    │
 │  逐字显示 "const..."  │                      │                    │                     │                    │
 │←──────────────────────│                      │                    │                    │                     │                    │
 │                       │                      │                    │ ... (持续流式)     │                     │                    │
 │                       │                      │                    │                    │ token_complete      │                    │
 │                       │                      │                    │                    │←────────────────────│                    │
 │                       │                      │                    │ PUB agent:stream    │                     │                    │
 │                       │                      │                    │ (isComplete)        │                     │                    │
 │                       │                      │                    │←───────────────────│                     │                    │
 │                       │                      │                    │ XADD agent:results  │                     │                    │
 │                       │                      │                    │←───────────────────│                     │                    │
 │                       │                      │ 6. 持久化 Agent 消息│                    │                     │                    │
 │                       │                      │ 7. 提取代码块       │                    │                     │                    │
 │                       │ WS: chat.actions     │                    │                     │                    │
 │                       │←─────────────────────│                    │                     │                    │
 │  显示 [Diff] [预览]   │                      │                    │                     │                    │
 │←──────────────────────│                      │                    │                     │                    │
```

#### 4.4.2 Orchestrator 级联触发流程

```
Java OrchestratorService
 │
 │ 1. 收到 Orchestrator 的消息（包含 @前端Agent @后端Agent）
 │
 │ 2. MentionParser 解析出: [前端Agent, 后端Agent]
 │
 │ 3. TaskChainManager 创建任务链:
 │    - 子任务 1 → 前端Agent (status=PENDING)
 │    - 子任务 2 → 后端Agent (status=PENDING, dependsOn=1)
 │    - 子任务 3 → Orchestrator (status=PENDING, dependsOn=2)
 │
 │ 4. 发送任务计划 WS 消息到前端（TaskPlanCard 渲染）
 │
 │ 5. 执行第一个无依赖子任务: 子任务 1
 │    → 发布 agent:tasks → 前端Agent 回复
 │
 │ 6. 收到 agent:results (子任务 1 完成)
 │    → 更新子任务 1 status=COMPLETED
 │    → WS: task.update 通知前端更新卡片
 │
 │ 7. 检查子任务 2 的依赖: dependsOn=1 已完成 ✓
 │    → 发布 agent:tasks → 后端Agent 回复
 │
 │ 8. 收到 agent:results (子任务 2 完成)
 │    → 更新子任务 2 status=COMPLETED
 │    → WS: task.update
 │
 │ 9. 子任务 3 (Orchestrator 总结):
 │    → 如果 Orchestrator 消息中有 @mention → 回到步骤 2（递归）
 │    → 如果没有 @mention → 发送总结消息，任务链结束
```

**并行执行规则**：如果任务链中存在多个 `dependsOn = []` 的子任务（无依赖），`TaskChainManager` 将**同时**发布多个 `agent:tasks`（并行执行）。每个子任务完成后遍历所有 `dependsOn` 包含该子任务 ID 的后继任务，检查其 `dependsOn` 数组中的**所有** ID 是否都已 `COMPLETED`，满足则触发。

**并发上限**：同一会话最多同时执行 3 个 Agent 调用（通过 Redis 计数器控制），超出部分排队等待。

**任务计划 JSON Schema**（Orchestrator 输出的结构化任务协议）：

```json
{
  "taskPlan": {
    "title": "开发待办事项 CRUD 应用",
    "tasks": [
      {
        "id": "task-1",
        "sequence": 1,
        "description": "前端 Todo UI 组件（列表+表单）",
        "assignedAgent": "frontend_agent",
        "dependsOn": [],
        "acceptanceCriteria": "包含添加、删除、勾选功能，React + TailwindCSS"
      },
      {
        "id": "task-2",
        "sequence": 2,
        "description": "后端 CRUD REST API",
        "assignedAgent": "backend_agent",
        "dependsOn": ["task-1"],
        "acceptanceCriteria": "Python FastAPI，POST/GET/PUT/DELETE，内存存储"
      },
      {
        "id": "task-3",
        "sequence": 3,
        "description": "前后端联调验证",
        "assignedAgent": "orchestrator",
        "dependsOn": ["task-1", "task-2"],
        "acceptanceCriteria": "前后端数据流正常，可预览完整应用"
      }
    ]
  }
}
```

> **Schema 校验**：`TaskChainManager` 在创建任务链前校验 JSON Schema（`dependsOn` 循环依赖检测、`assignedAgent` 存在性检查、`sequence` 连续性检查）。校验失败时 Orchestrator 自动重试 1 次，仍失败则提示用户手动调整。

**人工确认点**：Orchestrator 拆解完任务后，在触发第一个 Agent 之前展示任务计划卡片，用户可以：
- 直接确认（任务链自动执行）
- 手动调整（修改子任务顺序、分配、依赖）
- 取消（Orchestrator 重新拆解）

---

## 5. 数据流

### 5.1 核心数据流

```
用户输入 → WebSocket → Java 解析 → Redis Stream → Python Executor
                                                       │
                         ┌─────────────────────────────┴─────────────────────────────┐
                         │                                                           │
                  LLM 模式：BaseLLMAdapter                                 PLATFORM 模式：Claude Code / Codex CLI
                         │                                                           │
                  OpenAI / Anthropic API                                      CLI 在沙箱内调用 LLM API
                         │                                                           │
                         └────────────── token / tool event / patch ─────────────────┘
                                                       │
                                                 Redis Pub/Sub
                                                       │
                                                    Java 订阅
                                                       │
                                                  WebSocket
                                                       │
                                           前端流式渲染 + Diff 展示
```

### 5.2 数据生命周期

| 数据 | 产生方 | 存储位置 | 消费方 | 生命周期 |
|------|--------|---------|--------|---------|
| 用户消息 | 前端 | MySQL `messages` | Agent 上下文 | 与会话同生命周期 |
| Agent 回复 | Python | MySQL `messages` | 前端展示 | 与会话同生命周期 |
| 流式 token | Python | Redis Pub/Sub（瞬态） | 前端实时展示 | 单次调用期间 |
| 代码块 | Python（Agent 回复中提取） | MySQL `message_code_blocks` | 工程面板 | 与会话同生命周期 |
| 任务计划 | Orchestrator | MySQL `task_plans` + `task_items` | 前端 TaskPlanCard | 任务链结束后归档 |
| 项目文件 | 用户审核批准后写入 | MySQL `project_files` | 预览/部署/工程面板 | 与会话同生命周期 |
| 审核记录 | Agent 消息生成时自动创建 | MySQL `code_reviews` | 前端 Diff 面板 | 与会话同生命周期 |
| WebSocket session | Java | Redis（session → node 映射） | WS 路由 | 连接断开即过期 |

### 5.3 代码块文件名推断

Agent 回复中的 Markdown 代码块需要被提取到工程面板的文件树。推断策略分两层：

**第一层：Agent 显式声明（优先）**

要求 Agent 在 system prompt 中使用带文件名的代码块语法：
````
```tsx:src/components/TodoList.tsx
const TodoList = () => { ... }
```
````
文件名直接从声明中提取。

**第二层：自动推断（兜底规则）**

| 语言 | 自动文件名 | 示例 |
|------|-----------|------|
| `tsx` / `jsx` | `Component_{N}.tsx` | `Component_1.tsx` |
| `ts` / `js` | `module_{N}.ts` | `module_2.ts` |
| `python` / `py` | `module_{N}.py` | `module_1.py` |
| `css` / `scss` | `style_{N}.css` | `style_1.css` |
| `html` | `page_{N}.html` | `page_1.html` |
| `sql` | `query_{N}.sql` | `query_1.sql` |
| 其他 / 未知 | `file_{N}.{ext}` | `file_3.txt` |

其中 `{N}` 是该会话中同语言的递增计数器。

**执行时机**：Java 后端在收到 `agent:results` 后：
1. 持久化 Agent 消息到 `messages` 表
2. 解析 `codeBlocks[]`，推断文件名，写入 `message_code_blocks` 表
3. 自动创建 `code_reviews` 记录（status=PENDING），前端展示 Diff + Approve/Reject 按钮
4. 用户批准后，`SessionService.approveReview()` 将代码块写入 `project_files` 表（新文件插入 / 已有文件更新版本号）

---

## 6. 数据库设计

### 6.1 ER 图

```
┌──────────┐       ┌──────────────────┐
│  users   │1─────n│ user_providers   │
└────┬─────┘       └────────┬─────────┘
     │                      │
     │1                     │1
     ├──────n┌──────────┐   │
     │       │ sessions │   │
     └──────n└────┬─────┘   │
                  │         │
                  │1        ├──────n┌──────────────────────────┐
                  ├──────n┌─┘       │ agent_provider_overrides │
                  │       │         │ (user_id, agent_id,      │
                  │       │         │  provider_id)            │
                  │       │         └──────────────────────────┘
                  │
                  │1
                  ├──────n┌─────────────────┐
                  │       │ session_members  │
                  │       │ (user_id 可空)   │
                  │       │ (agent_id 可空)  │
                  │       └─────────────────┘
                  │
                  │1
                  ├──────n┌──────────┐
                  │       │ messages │
                  └──────n└────┬─────┘
                               │1
                               ├──────n┌────────────────────┐
                               │       │ message_code_blocks│
                               └──────n└────────────────────┘
                               │1
                               ├──────1┌───────────┐
                               │       │ task_plans│
                               └──────1└─────┬─────┘
                                            │1
                                            ├──────n┌───────────┐
                                            │       │ task_items│
                                            └──────n└───────────┘

┌──────────┐
│  agents  │ (独立实体，不受用户管理)
└────┬─────┘
     │1
     └──────n┌──────────────────────────┐
             │ agent_provider_overrides │ (同时引用 users 和 user_providers)
             └──────────────────────────┘

┌────────────────┐
│ project_files  │ (session_id → sessions)
└────────────────┘

┌───────────────┐     ┌──────────────┐
│  deployments  │     │ code_reviews │ (message_id → messages)
└───────────────┘     └──────────────┘
```

### 6.2 表结构

#### 6.2.1 `users` — 用户表

```sql
CREATE TABLE users (
    id              CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    username        VARCHAR(20)  NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,          -- bcrypt hash
    display_name    VARCHAR(50),                    -- 显示名称
    avatar_url      VARCHAR(500),                   -- 头像 URL
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_users_username ON users(username);
```

#### 6.2.2 `user_providers` — LLM Provider 配置表

```sql
CREATE TABLE user_providers (
    id              CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id         CHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider_type   VARCHAR(20)  NOT NULL,          -- OPENAI / ANTHROPIC / CUSTOM
    api_key_enc     TEXT         NOT NULL,           -- AES-256-GCM 加密存储
    base_url        VARCHAR(500),                    -- 可选的自定义 Base URL
    default_model   VARCHAR(100) NOT NULL,           -- 如 gpt-4o / claude-sonnet-4-20250514
    is_default      TINYINT(1)      NOT NULL DEFAULT 0,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX idx_providers_user_id ON user_providers(user_id);
CREATE UNIQUE INDEX idx_providers_user_default ON user_providers(user_id, (CASE WHEN is_default = 1 THEN 1 ELSE NULL END));
```

#### 6.2.3 `agent_provider_overrides` — Agent-Provider 覆盖映射表

允许用户为单个 Agent 指定专用的 Provider，覆盖默认 Provider（需求 FR-04）。

```sql
CREATE TABLE agent_provider_overrides (
    id              CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id         CHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    agent_id        CHAR(36) NOT NULL REFERENCES agents(id),
    provider_id     CHAR(36) NOT NULL REFERENCES user_providers(id) ON DELETE CASCADE,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_override_user_agent ON agent_provider_overrides(user_id, agent_id);
CREATE INDEX idx_override_provider ON agent_provider_overrides(provider_id);
```

**查找逻辑**（Java AgentService 中实现）：
1. 先查 `agent_provider_overrides` 是否有该用户对该 Agent 的指定
2. 有 → 使用指定的 Provider
3. 无 → 使用用户的默认 Provider

#### 6.2.4 `agents` — Agent 配置表（系统预置）

```sql
CREATE TABLE agents (
    id              CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    identifier      VARCHAR(50)  NOT NULL,           -- frontend_agent / claude_code_agent 等
    name            VARCHAR(50)  NOT NULL,           -- 显示名称
    role_desc       VARCHAR(200) NOT NULL,           -- 简短描述
    system_prompt   TEXT         NOT NULL,           -- 角色设定 Prompt（LLM 模式使用）
    default_model   VARCHAR(100),                    -- 预置默认模型
    agent_mode      VARCHAR(10)  NOT NULL DEFAULT 'LLM',  -- LLM / PLATFORM
    platform_type   VARCHAR(30),                     -- CLAUDE_CODE / CODEX（仅 PLATFORM 模式）
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_agents_identifier ON agents(identifier);
```

**初始化数据：**

| identifier | name | role_desc | default_model | agent_mode | platform_type |
|------------|------|-----------|---------------|------------|---------------|
| `frontend_agent` | 前端Agent | 前端开发专家 | claude-sonnet-4-20250514 | LLM | — |
| `backend_agent` | 后端Agent | 后端开发专家 | claude-sonnet-4-20250514 | LLM | — |
| `test_agent` | 测试Agent | 测试专家 | gpt-4o | LLM | — |
| `orchestrator` | Orchestrator | 任务协调与调度 | claude-sonnet-4-20250514 | LLM | — |
| `claude_code_agent` | Claude Code Agent | 全栈 Agent（Claude Code CLI） | claude-sonnet-4-20250514 | PLATFORM | CLAUDE_CODE |

> `agent_mode = PLATFORM` 的 Agent 在 Docker 沙箱中启动完整的 Claude Code / Codex CLI，拥有工具调用和文件系统能力。`agent_mode = LLM` 的 Agent 直接调 LLM API，轻量快速。

#### 6.2.5 `sessions` — 会话表

```sql
CREATE TABLE sessions (
    id              CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name            VARCHAR(100) NOT NULL,           -- 会话名称
    session_type    VARCHAR(10)  NOT NULL,           -- DIRECT (单聊) / GROUP (群聊)
    owner_id        CHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX idx_sessions_owner ON sessions(owner_id);
CREATE INDEX idx_sessions_updated ON sessions(owner_id, updated_at DESC);
```

#### 6.2.6 `session_members` — 会话成员表

```sql
CREATE TABLE session_members (
    id              CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    session_id      CHAR(36) NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    user_id         CHAR(36) REFERENCES users(id) ON DELETE CASCADE,    -- 可空（Agent 成员时）
    agent_id        CHAR(36) REFERENCES agents(id),                     -- 可空（用户成员时）
    member_type     VARCHAR(10)  NOT NULL,          -- USER / AGENT
    joined_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_member_type CHECK (
        (member_type = 'USER' AND user_id IS NOT NULL AND agent_id IS NULL) OR
        (member_type = 'AGENT' AND agent_id IS NOT NULL AND user_id IS NULL)
    )
);

CREATE INDEX idx_members_session ON session_members(session_id);
-- MySQL 唯一索引不阻止多 NULL 值 → 应用层兜底：
-- SessionService.addMember() 先 SELECT 检查 (session_id, COALESCE(user_id, ''), COALESCE(agent_id, '')) 是否已存在
CREATE UNIQUE INDEX idx_members_unique ON session_members(session_id, user_id, agent_id);
```

#### 6.2.7 `messages` — 消息表

```sql
CREATE TABLE messages (
    id              CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    session_id      CHAR(36) NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    sender_type     VARCHAR(10)  NOT NULL,           -- USER / AGENT / SYSTEM
    sender_id       CHAR(36),                             -- user_id 或 agent_id
    content         TEXT         NOT NULL,            -- 消息正文
    message_type    VARCHAR(20)  NOT NULL DEFAULT 'TEXT',  -- TEXT / CODE / TASK_PLAN / SYSTEM
    metadata        JSON,                            -- 扩展元数据（mentions 等）
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_messages_session_time ON messages(session_id, created_at DESC);
CREATE INDEX idx_messages_session_cursor ON messages(session_id, created_at);  -- 分页游标
```

#### 6.2.8 `message_code_blocks` — 代码块表

```sql
CREATE TABLE message_code_blocks (
    id              CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    message_id      CHAR(36) NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    language        VARCHAR(50)  NOT NULL,            -- tsx / python / sql / ...
    file_name       VARCHAR(255),                     -- 自动推断或 Agent 指定的文件名
    code_content    TEXT         NOT NULL,            -- 代码内容
    sort_order      INT          NOT NULL DEFAULT 0   -- 同一消息中多个代码块的顺序
);

CREATE INDEX idx_code_blocks_message ON message_code_blocks(message_id);
```

#### 6.2.9 `task_plans` — 任务计划表

```sql
CREATE TABLE task_plans (
    id              CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    message_id      CHAR(36) NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    session_id      CHAR(36) NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    title           VARCHAR(200) NOT NULL,            -- 如「待办事项 CRUD 应用」
    status          VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE / COMPLETED
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_task_plans_session ON task_plans(session_id);
```

#### 6.2.10 `task_items` — 子任务表

```sql
CREATE TABLE task_items (
    id              CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    task_plan_id    CHAR(36) NOT NULL REFERENCES task_plans(id) ON DELETE CASCADE,
    sequence        INT          NOT NULL,            -- 序号 1, 2, 3
    description     VARCHAR(500) NOT NULL,            -- 子任务描述
    assigned_agent_id CHAR(36) REFERENCES agents(id),
    status          VARCHAR(20)  NOT NULL DEFAULT 'PENDING',  -- PENDING / IN_PROGRESS / COMPLETED
    depends_on      JSON,                                -- 依赖的子任务 ID 数组，如 ["uuid1", "uuid2"]，空数组 [] 表示无依赖可立即执行
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_task_items_plan ON task_items(task_plan_id);
```

#### 6.2.11 `project_files` — 项目文件表

```sql
CREATE TABLE project_files (
    id              CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    session_id      CHAR(36) NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    file_path       VARCHAR(500) NOT NULL,            -- 相对路径：src/components/TodoList.tsx
    content         TEXT         NOT NULL,            -- 文件内容
    version         INT          NOT NULL DEFAULT 1,  -- 版本号（每次 Agent 生成递增）
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_project_files_path ON project_files(session_id, file_path);
```

#### 6.2.12 `deployments` — 部署记录表

```sql
CREATE TABLE deployments (
    id              CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    session_id      CHAR(36) NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    status          VARCHAR(20)  NOT NULL DEFAULT 'PENDING',  -- PENDING / BUILDING / DEPLOYING / SUCCESS / FAILED
    deploy_url      VARCHAR(500),
    error_message   TEXT,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX idx_deployments_session ON deployments(session_id);
```

#### 6.2.13 `code_reviews` — 代码审核表

Agent 生成的代码块需要用户审核后才能应用到项目文件（`project_files`）。此表记录每次审核操作。

```sql
CREATE TABLE code_reviews (
    id              CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    message_id      CHAR(36) NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    session_id      CHAR(36) NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    status          VARCHAR(20)  NOT NULL DEFAULT 'PENDING',  -- PENDING / APPROVED / REJECTED
    reviewer_id     CHAR(36) NOT NULL REFERENCES users(id),
    reviewed_at     DATETIME,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_review_message ON code_reviews(message_id);
CREATE INDEX idx_review_session ON code_reviews(session_id);
```

**审核状态机：**

```
Agent 生成代码 → [PENDING] ──用户批准──→ [APPROVED] → 写入 project_files
                   │
                   └──用户拒绝──→ [REJECTED] → 代码块保留在聊天中但不应用
```

- **PENDING**：Agent 消息生成后自动创建，代码块展示在 Diff 面板等待审核
- **APPROVED**：用户点击 Approve，更新 `project_files`（新文件插入/已有文件更新版本号）
- **REJECTED**：用户点击 Reject，记录操作但不修改 `project_files`

### 6.3 索引策略总结

| 表 | 索引 | 用途 |
|----|------|------|
| users | `UNIQUE(username)` | 注册/登录查重 |
| user_providers | `(user_id)` | 查用户的全部 Provider |
| user_providers | `UNIQUE(user_id, (CASE WHEN is_default = 1 THEN 1 ELSE NULL END))` | 保证每个用户只有一个默认 Provider（MySQL 函数索引） |
| agent_provider_overrides | `UNIQUE(user_id, agent_id)` | 每个用户对每个 Agent 只能指定一个 Provider |
| agent_provider_overrides | `(provider_id)` | 删除 Provider 时清理关联的覆盖记录 |
| agents | `UNIQUE(identifier)` | 通过标识符查找 Agent |
| sessions | `(owner_id, updated_at DESC)` | 会话列表排序 |
| session_members | `UNIQUE(session_id, user_id, agent_id)` | 防止重复添加 |
| messages | `(session_id, created_at DESC)` | 消息历史倒序查询 |
| messages | `(session_id, created_at)` | 游标分页 |
| task_plans | `(session_id)` | 查会话的全部任务计划 |
| task_items | `(task_plan_id)` | 查计划下的子任务 |
| project_files | `UNIQUE(session_id, file_path)` | 文件路径唯一 + 按会话查找 |
| deployments | `(session_id)` | 查会话的部署记录 |
| code_reviews | `UNIQUE(message_id)` | 每条 Agent 消息只有一次审核 |
| code_reviews | `(session_id)` | 查会话的全部审核记录 |

---

## 7. 部署架构

### 7.1 服务编排

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Compose                           │
│                                                             │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  frontend   │  │  java-api    │  │  python-ai       │  │
│  │  (nginx)    │  │  (SpringBoot)│  │  (FastAPI)       │  │
│  │  port:80    │  │  port:8080   │  │  port:8000       │  │
│  └─────────────┘  └──────┬───────┘  └────────┬─────────┘  │
│                          │                    │             │
│                          └────────┬───────────┘             │
│                                   │                         │
│                          ┌────────┴─────────┐               │
│                          │  mysql           │               │
│                          │  port:3306       │               │
│                          └──────────────────┘               │
│                                   │                         │
│                          ┌────────┴─────────┐               │
│                          │  redis           │               │
│                          │  port:6379       │               │
│                          └──────────────────┘               │
│                                                             │
│                    ┌─────────────────────┐                  │
│                    │  docker-in-docker    │                  │
│                    │  (沙箱容器)          │                  │
│                    │  动态创建/销毁       │                  │
│                    └─────────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 服务配置

| 服务 | 镜像/构建 | 端口 | 环境变量 |
|------|----------|------|---------|
| frontend | `node:20-alpine` build → nginx serve | 80 | `VITE_API_URL`, `VITE_WS_URL` |
| java-api | `eclipse-temurin:21` + JAR | 8080 | `DB_URL`, `REDIS_URL`, `JWT_SECRET`, `AES_KEY`, `INTERNAL_SERVICE_TOKEN` |
| python-ai | `python:3.12-slim` | 8000 | `REDIS_URL`, `DOCKER_HOST`, `JAVA_INTERNAL_URL`, `INTERNAL_SERVICE_TOKEN`, `DEPLOY_TOKEN` |
| mysql | `mysql:8.0` | 3306 | `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD` |
| redis | `redis:7-alpine` | 6379 | — |

### 7.3 Docker Compose 关键配置

```yaml
# docker-compose.yml
services:
  frontend:
    build: ./frontend
    ports: ["80:80"]
    depends_on: [java-api]

  java-api:
    build: ./backend-java
    ports: ["8080:8080"]
    environment:
      SPRING_DATASOURCE_URL: jdbc:mysql://mysql:3306/agenthub
      SPRING_REDIS_HOST: redis
      JWT_SECRET: ${JWT_SECRET}
      AES_KEY: ${AES_KEY}
      INTERNAL_SERVICE_TOKEN: ${INTERNAL_SERVICE_TOKEN}
    depends_on: [mysql, redis]

  python-ai:
    build: ./backend-python
    ports: ["8000:8000"]
    environment:
      REDIS_URL: redis://redis:6379
      JAVA_INTERNAL_URL: http://java-api:8080
      INTERNAL_SERVICE_TOKEN: ${INTERNAL_SERVICE_TOKEN}
      DEPLOY_TOKEN: ${DEPLOY_TOKEN}   # Vercel/Netlify 部署 Token，系统全局配置
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock  # 管理沙箱容器
    depends_on: [redis]

  mysql:
    image: mysql:8.0
    volumes: [mysqldata:/var/lib/mysql]
    environment:
      MYSQL_DATABASE: agenthub
      MYSQL_USER: agenthub
      MYSQL_PASSWORD: ${DB_PASSWORD}
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD}

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes: [redisdata:/data]

volumes:
  mysqldata:
  redisdata:
```

### 7.4 安全边界

| 组件 | 安全措施 |
|------|---------|
| 前端 → Java | HTTPS + JWT Bearer Token |
| WebSocket | WSS + Token 鉴权（连接时验证） |
| Java → Redis | 内网通信，Docker 内部网络 |
| Python → Redis | 内网通信 |
| Python → Java 内部凭据接口 | Docker 内网 + `X-Service-Token`，只返回单次任务所需 API Key |
| Python → LLM API | HTTPS + 用户配置的 API Key |
| Python → Docker 沙箱（构建） | `--network=bridge`（允许出站：npm install / git clone / Vercel CLI），`--memory=1024m`，`--timeout=180s` |
| Python → Docker 沙箱（运行时） | `--network=none --cap-drop=ALL --read-only --memory=512m --timeout=30s`（仅 serve 静态文件） |
| Python → Vercel/Netlify CLI | 通过环境变量 `DEPLOY_TOKEN` 注入，不在前端/数据库中传输 |
| MySQL | 内网通信，密码认证 |
| API Key 存储 | MySQL 中 AES-256-GCM 加密，加密密钥通过环境变量注入 |
| 部署 Token | `DEPLOY_TOKEN` 在 docker-compose 环境变量中配置，系统全局共用，不暴露给前端 |

---

## 8. 扩展性设计

### 8.1 新增 LLM Provider

只需在 Python `adapter/` 目录下实现 `BaseAdapter` 接口并注册：

```python
# adapter/registry.py — 新增只需要改这里
ADAPTER_REGISTRY[ProviderType.GOOGLE] = GoogleAdapter()
```

Java 端无需修改——Provider 类型通过 Redis 消息传递，Python 端根据 `providerType` 查找对应适配器。

### 8.2 新增 Agent

通过数据库 INSERT 即可新增 Agent，无需改代码：

```sql
INSERT INTO agents (identifier, name, role_desc, system_prompt, default_model)
VALUES ('security_agent', '安全Agent', '安全审计专家', '你是安全专家...', 'claude-sonnet-4-20250514');
```

新增后自动出现在 Agent 列表和群聊可选列表中。

### 8.3 新增 Orchestrator 模板

Orchestrator 拆解任务时优先匹配预定义模板（需求文档 FR-18），模板存储在配置文件或数据库 `orchestrator_templates` 表中（可后续扩展）。

---

## 9. 遗留待定项

以下内容留待详细设计阶段明确：

| 待定项 | 说明 |
|--------|------|
| Agent 调用频率限制 | 防止用户短时间内大量 @Agent 发起 LLM 调用。建议基于 Redis 计数器实现令牌桶/滑动窗口限流（如每分钟 10 次）。MVP 阶段可暂不做 |
| 消息队列背压策略 | Redis Streams 消费积压时的限流机制。MVP 阶段并发低，暂不设限 |
| 多节点 WebSocket 消息路由 | 当有多个 Java 实例时，Python 返回的消息可能被实例 A 消费，但目标用户连接在实例 B。需要用 Redis Pub/Sub 做跨节点广播，找到持有该连接的节点转发消息。MVP 单实例部署不需要 |
| 沙箱容器池化 | 每次预览都要 docker run → npm install → npm build，冷启动需 10-30 秒。池化方案是预热 2-3 个已装好 Node.js 的容器，用时注入代码即可，可将延迟降到 4-16 秒。MVP 不做 |
| 文件存储扩容 | 项目文件当前存 MySQL，大项目时是否需要对象存储（如 MinIO/S3） |
| Orchestrator 模板存储 | 预定义任务模板存储在配置文件还是新建 `orchestrator_templates` 表 |
