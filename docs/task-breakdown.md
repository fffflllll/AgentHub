# AgentHub 任务拆解

本文从 [high-level-design.md](./high-level-design.md) 拆分实现任务，按前端、Java 后端、Python AI 后端、数据库、Docker 五个模块组织。优先级含义如下：

| 优先级 | 含义 |
|--------|------|
| P0 | MVP 必须完成，支撑第一条端到端链路 |
| P1 | 核心体验增强，支撑完整课题要求 |
| P2 | 扩展能力或工程优化，可在 MVP 稳定后推进 |

## 里程碑

| 阶段 | 目标 | 覆盖能力 |
|------|------|----------|
| M1 | 跑通单 Agent LLM 流式闭环 | 登录、Provider 配置、单聊、WebSocket、LLM 流式响应、基础 AgentTask/AgentResult 协议 |
| M2 | 跑通 @mention 与群聊多 Agent 路由 | 群聊、@mention、多 Agent 路由、Orchestrator 任务计划与任务链 |
| M3 | 跑通代码工作流闭环 | Markdown 代码块提取、FilePatch 生成、Diff 面板、审核应用（Approve/Reject）、项目文件管理 |
| M4 | 跑通轻量 AI Harness 闭环 | AgentRun 运行记录、TraceEvent 流式事件、Workspace Snapshot、VerificationReport、Human Review |
| M5 | 跑通项目导入和预览闭环 | GitHub URL 导入、沙箱构建、网页预览 |
| M6 | 引入 Platform 模式 | Claude Code / Codex CLI 沙箱执行、PlatformAdapter、patch 标准化 |
| M7 | 一键部署扩展 | Vercel/Netlify 或容器部署，MVP 不做 |

## 前端

| 优先级 | 任务 | 依赖 | 产出 |
|--------|------|------|------|
| P0 | 搭建 React 18 + TypeScript + Vite + TailwindCSS 工程 | 无 | `frontend/` 项目骨架、路由、基础布局 |
| P0 | 实现认证页面和登录态管理 | Java 认证 API | `AuthContext`、登录页、注册页、Token 持久化 |
| P0 | 实现三栏 IM 主布局 | 前端骨架 | 顶栏、会话列表、聊天区、右侧工程面板占位 |
| P0 | 实现会话列表与会话切换 | 会话 API | `SessionList`、当前会话状态、空状态 |
| P0 | 实现聊天消息列表 | 消息 API | `ChatArea`、`MessageBubble`、文本/系统消息展示 |
| P0 | 实现消息输入框 | WebSocket 协议 | Enter 发送、Shift+Enter 换行、发送中状态 |
| P0 | 实现 WebSocket Client | Java WS | 鉴权连接、自动重连、心跳、消息分发 |
| P0 | 实现流式消息渲染 | WebSocket `chat.stream` | `StreamRenderer`、Agent 正在输入状态 |
| P0 | 实现 Provider 设置页 | Provider API | Provider 列表、添加、更新、删除、默认 Provider |
| P1 | 实现 @mention 输入体验 | Agent API | Agent 自动补全、mention payload、群聊触发 |
| P1 | 实现群聊创建和成员管理 | 会话成员 API | 创建群聊、添加/移除 Agent |
| P1 | 实现 Orchestrator 任务计划卡片 | `task.update` WS | 子任务列表、状态更新、确认/取消入口 |
| P1 | 实现代码块展示和操作按钮 | Agent 结果消息 | Markdown 渲染、语法高亮、Diff/预览按钮 |
| P1 | 实现右侧文件树和 Diff 面板 | 代码块/审核 API | 文件树、Monaco DiffEditor、Approve/Reject |
| P1 | 实现 AgentRun 状态展示 | `agent:stream` WS | 状态标识：排队中、执行中、验证中、等待审核、完成、失败 |
| P1 | 实现工具事件展示 | `agent:stream` WS | 工具调用事件：读取文件、写入文件、运行命令、生成 patch |
| P1 | 实现 VerificationReport 展示 | `agent:results` | 验证状态：build/test/lint/typecheck 通过/失败标识 |
| P1 | 实现 FilePatch Diff 面板 | 审核 API | Diff 面板支持 FilePatch 数据结构，不止 Markdown 代码块 |
| P1 | 实现审核按钮 | 审核 API | Approve / Reject / Apply 按钮，支持批量操作 |
| P1 | 实现失败原因展示 | `agent:results` | 区分展示：超时、API 错误、测试失败、沙箱错误 |
| P1 | 实现网页预览面板 | 预览 API | iframe 预览、构建中/失败状态 |
| P2 | 实现部署状态展示 | 部署 API | 部署进度、成功 URL、失败错误 |
| P2 | 增加多会话后台状态提示 | WS 订阅 | 会话级进行中标记、未读角标 |
| P2 | 增加移动端或窄屏适配 | 基础布局 | 响应式折叠侧栏和工程面板 |

## Java 后端

| 优先级 | 任务 | 依赖 | 产出 |
|--------|------|------|------|
| P0 | 搭建 Spring Boot 3 工程 | 无 | `backend-java/` 项目骨架、健康检查 |
| P0 | 配置轻量 JWT 鉴权 | 用户表 | 注册、登录、MVC Interceptor、WebSocket `auth.init` 首包鉴权 |
| P0 | 配置纯 MyBatis 数据访问 | 数据库迁移 | Mapper 接口、XML SQL、下划线转驼峰 |
| P0 | 实现用户模块 | 数据库迁移 | `AuthController`、`UserController`、`UserService` |
| P0 | 实现 Provider 配置模块 | Provider 表 | Provider CRUD、AES-256-GCM 加密存储 |
| P0 | 实现 Agent 配置读取 | Agent 表 | Agent 列表、Provider 覆盖解析 |
| P0 | 实现会话模块 | Session 表 | 创建单聊、会话列表、删除会话 |
| P0 | 实现消息模块 | Message 表 | 消息持久化、历史分页、代码块提取入口 |
| P0 | 实现 WebSocket 聊天协议 | 用户/会话/消息模块 | `chat.send`、`chat.stream`、`chat.message`、错误消息 |
| P0 | 实现 Redis Stream 任务发布 | Redis | `TaskPublisher`、`agent:tasks` 写入 |
| P0 | 实现 Redis Pub/Sub 流式订阅 | Redis | `StreamSubscriber`、token 转发到 WS |
| P0 | 实现内部凭据解析接口 | Provider 模块 | `/internal/providers/{id}/credentials:resolve`、`CredentialService`、校验 taskId/sessionId/agentId/providerId 归属 |
| P0 | 创建 agent_task_runs 表及运行记录 | AgentTask 协议 | Java 创建 AgentTask 时生成 runId/taskId/traceId |
| P0 | Redis 任务投递不携带明文 API Key | CredentialService | `agent:tasks` 消息只含 providerId，不含 apiKey |
| P0 | 定义 ProjectStorageService 接口 | 项目文件表 | loadWorkspace / applyPatches / getFile / importFiles 接口抽象，MysqlProjectStorageService 实现 |
| P1 | 实现群聊成员管理 | SessionMember 表 | 添加/移除 Agent、成员列表 |
| P1 | 实现 @mention 路由 | Agent/会话模块 | `MentionParser`、单聊自动路由、群聊指定 Agent |
| P1 | 实现 OrchestratorService | Task 表 | 任务拆解、Schema 校验、任务链创建 |
| P1 | 实现 TaskChainManager | OrchestratorService | 依赖检查、并发上限、状态推进、`task.update`、maxDepth/maxAgentCalls/retryBudget/cancel |
| P1 | 实现 Agent 结果消费 | Redis `agent:results` | AgentResult 持久化（含 runId、FilePatch、VerificationReport、tokenUsage） |
| P1 | 实现 AgentRun 状态更新 API | agent_task_runs 表 | run.update WebSocket 推送、状态变更通知 |
| P1 | 实现代码审核 API | code_reviews + code_review_patches 表 | Approve/Reject、逐 patch 乐观锁校验（baseVersion vs project_files.version）、状态流转 PENDING_REVIEW→APPROVED/REJECTED→APPLIED |
| P1 | 实现项目文件乐观锁更新 | ProjectStorageService | 通过 `WHERE version = baseVersion` 校验，不一致则拒绝并提示"文件已被修改，请重新生成变更" |
| P1 | 实现项目导入 API | Python importer | `/api/sessions/{id}/import`、写入 `project_files` |
| P1 | 实现预览 API | Python sandbox | `/api/sessions/{id}/preview`、`/api/preview/{id}` |
| P2 | 实现部署 API | Python deploy | `/api/sessions/{id}/deploy`、`/api/deploy/{id}` |
| P2 | 实现限流和背压 | Redis | Agent 调用频率限制、任务积压保护 |
| P2 | 实现多节点 WS 路由 | Redis Pub/Sub | session-node 映射、跨节点广播 |

## Python AI 后端

| 优先级 | 任务 | 依赖 | 产出 |
|--------|------|------|------|
| P0 | 搭建 FastAPI 工程 | 无 | `backend-python/` 项目骨架、健康检查 |
| P0 | 实现 Redis Stream consumer | Redis | `task_consumer.py`、消费者组、ACK/重试 |
| P0 | 定义共享数据模型 | 协议文档 | `AgentTask`、`LLMRef`、`ResolvedLLMConfig`、`AgentResult`、`FilePatch` |
| P0 | 实现 Java 内部凭据客户端 | Java 内部接口 | `CredentialClient`、`X-Service-Token`、错误处理 |
| P0 | 实现 LLM Provider Adapter 基类 | 无 | `BaseLLMAdapter`、统一流式接口 |
| P0 | 实现 OpenAI Adapter | Provider 配置 | OpenAI chat/completions 流式调用 |
| P0 | 实现 Anthropic Adapter | Provider 配置 | Anthropic messages 流式调用 |
| P0 | 实现 Custom OpenAI-compatible Adapter | Provider 配置 | 自定义 Base URL 调用 |
| P0 | 实现 Executor 的 LLM 模式 | Adapter + CredentialClient | 构建上下文、调用模型、组装 `AgentResult` |
| P0 | 实现 Redis Streamer | Redis Pub/Sub | token 流、tool_use 事件、file_change 事件、verification 事件、status 事件 |
| P1 | 实现 AI Harness 基础层 | 共享数据模型 | `task_spec` 任务规格化、`context_builder` 上下文注入、`policy` 权限策略、`run_state` 状态机 |
| P1 | 实现 workspace_manager | Docker 临时目录 | 创建临时 workspace、写入 project_files、清理 |
| P1 | 实现 workspace snapshot | workspace_manager | 执行前后文件系统快照、文件列表和内容摘要 |
| P1 | 实现 patch_builder | workspace snapshot | 对比快照生成 FilePatch（filePath、patchType、baseVersion、originalContent、newContent） |
| P1 | 实现 Verification 模块 | workspace + Docker | `command_runner` 运行 build/lint/test/typecheck、生成 VerificationReport |
| P1 | 实现 failure_classifier | trace_recorder | 区分 API 错误、超时、Schema 错误、测试失败、沙箱错误 |
| P1 | 实现 Human Review patch 流转 | Java 审核 API | FilePatch 状态 PENDING_REVIEW → APPROVED/REJECTED → APPLIED |
| P1 | 实现 Markdown 代码块解析 | AgentResult | `codeBlocks` 提取、语言和文件名解析（MVP 简化方案） |
| P1 | 实现 Orchestrator JSON 解析辅助 | Orchestrator prompt | taskPlan JSON 提取、校验错误返回 |
| P1 | 实现项目导入 importer | Docker/git | GitHub 浅克隆、文件过滤、结果回传 |
| P1 | 实现沙箱构建预览 | Docker | React/Vue 安装依赖、构建、产物服务 |
| P2 | 实现 repair_loop 自修复 | Harness + Verification | 验证失败后允许 Agent 重试一次 |
| P2 | 实现 sandbox worker 隔离 | Docker | 独立 sandbox worker 进程，避免与主进程共享 Docker socket |
| P2 | 实现成本统计和限流 | trace_recorder | token 统计、调用次数、任务积压保护 |
| P2 | 实现部署模块 | 部署 Token | 静态项目 Vercel/Netlify、失败信息回传 |
| P1 | 实现 PlatformAdapter 基类 | Docker sandbox | CLI 执行接口、消息和 patch 回调 |
| P1 | 实现 Claude Code Adapter | Claude Code 镜像 | 启动 CLI、解析输出、生成 `FilePatch` |
| P1 | 实现 Codex Adapter | Codex 镜像 | 启动 CLI、解析输出、生成 `FilePatch` |
| P1 | 实现 workspace 快照 Diff | PlatformAdapter | 执行前后文件对比、标准化 patch |
| P2 | 实现死信队列和告警记录 | MySQL/Redis | 超过重试次数记录失败任务 |
| P2 | 实现沙箱池化 | Docker | 预热容器、降低预览冷启动 |

## 数据库

| 优先级 | 任务 | 依赖 | 产出 |
|--------|------|------|------|
| P0 | 建立迁移工具 | Java 工程 | Flyway 或 Liquibase 配置 |
| P0 | 创建用户和认证相关表 | 无 | `users` |
| P0 | 创建 Provider 相关表 | 用户表 | `user_providers`、默认 Provider 约束 |
| P0 | 创建 Agent 配置表和初始化数据 | 无 | `agents`、预置前端/后端/测试/Orchestrator/Claude Code Agent |
| P0 | 创建会话相关表 | 用户/Agent 表 | `sessions`、`session_members` |
| P0 | 创建消息相关表 | 会话表 | `messages`、`message_code_blocks` |
| P0 | 创建项目文件表 | 项目表 | `project_files`：project_id（MVP = session_id）、file_path、content（MEDIUMTEXT）、version、is_deleted |
| P1 | 创建任务计划表 | 消息/Agent 表 | `task_plans`、`task_items`，`depends_on` JSON |
| P2 | 创建部署记录表 | 会话表 | `deployments` |
| P1 | 创建代码审核表 | 项目/任务表 | `code_reviews`：project_id、task_id、status、reviewer_id |
| P1 | 创建代码审核变更明细表 | code_reviews | `code_review_patches`：review_id、file_path、patch_type、base_version、original_content、new_content、diff_hunk、status |
| P0 | 创建 Agent 执行运行记录表 | Java/Python 协议 | `agent_task_runs`：runId、taskId、agentId、sessionId、status、promptTokens、completionTokens、startedAt、completedAt、durationMs、errorCode、errorMessage |
| P1 | 创建 Agent 执行追踪事件表 | agent_task_runs | `agent_trace_events`：runId、sequence、eventType（TOKEN/TOOL_USE/FILE_CHANGE/COMMAND/ERROR/VERIFICATION/STATUS）、payload JSON |
| P1 | 创建验证报告表 | agent_task_runs | `verification_reports`：runId、overallStatus（PASSED/FAILED）、checks_json（build/lint/test/typecheck 各检查项结果）、summary |
| P1 | 补充预览状态存储 | 预览 API | `previews` 表或 Redis 状态结构 |
| P2 | 优化索引和分页性能 | 压测数据 | 消息游标索引、会话更新时间索引 |
| P2 | 评估文件存储扩容 | 大项目场景 | MinIO/S3 迁移方案 |

## Docker

| 优先级 | 任务 | 依赖 | 产出 |
|--------|------|------|------|
| P0 | 编写根 `docker-compose.yml` | 三端骨架 | frontend、java-api、python-ai、mysql、redis 服务 |
| P0 | 编写前端 Dockerfile 和 Nginx 反向代理 | 前端工程 | Vite build + nginx serve，`/api` `/ws` 转发到 Java API |
| P0 | 编写 Java Dockerfile | Java 工程 | JAR 构建和运行镜像 |
| P0 | 编写 Python Dockerfile | Python 工程 | FastAPI/consumer 运行镜像 |
| P0 | 配置 MySQL 和 Redis 数据卷 | Compose | `mysqldata`、`redisdata` |
| P0 | 配置基础环境变量 | Compose | `JWT_SECRET`、`AES_KEY`、`INTERNAL_SERVICE_TOKEN`、数据库密码 |
| P1 | 配置 Python 管理 Docker socket | 沙箱模块 | `/var/run/docker.sock` 挂载和权限说明（本地 MVP 方案）；文档注明生产风险和替代方案（rootless Docker、gVisor、Firecracker） |
| P1 | 构建 Claude Code 沙箱镜像 | PlatformAdapter | `agenthub/sandbox:claude-code`，预装 Claude Code CLI |
| P1 | 构建 Codex 沙箱镜像 | PlatformAdapter | `agenthub/sandbox:codex`，预装 Codex CLI |
| P1 | 实现 build_sandbox 网络策略 | 沙箱模块 | 允许出站（npm registry + LLM API），禁止入站，可读写 workspace，内存 1024m，超时 180s（npm install 可到 300s） |
| P1 | 实现 runtime_sandbox 网络策略 | 预览模块 | `--network=none`，`--read-only`，`--cap-drop=ALL`，内存 512m，超时 30s |
| P1 | 实现 verification_sandbox 网络策略 | 验证模块 | 默认禁网可按需出站，临时可写，`--cap-drop=ALL`，内存 512m，超时 120s |
| P2 | 配置部署 Token | 部署模块 | `DEPLOY_TOKEN` 注入和脱敏日志 |
| P2 | 增加本地开发 Compose profile | 开发体验 | dev/prod profile、热更新挂载 |
| P2 | 增加日志和健康检查 | 运维 | service healthcheck、日志目录规范 |

## 推荐实现顺序

| 顺序 | 任务组 | 目标 |
|------|--------|------|
| 1 | 数据库 P0 + Docker P0 | 能启动 MySQL/Redis，Java 可连接数据库 |
| 2 | Java P0 认证/Provider/会话/消息/AgentTask | 能注册登录、配置模型、创建单聊、存消息、创建结构化 AgentTask、投递 Redis Stream |
| 3 | Python P0 LLM 模式 + AgentTask/AgentResult 协议 | 能消费 AgentTask、解析凭据、调用 LLM、流式返回 |
| 4 | 前端 P0 IM 页面 | 能在浏览器发消息并看到流式回复 |
| 5 | Java/Python/前端 P1 群聊与 Orchestrator | 能通过 @ 指令完成多 Agent 协作和任务链 |
| 6 | 代码工作流 P1 | 能提取代码块、展示 Diff、审核后写入项目文件 |
| 7 | AI Harness P1 | 实现 AgentRun/TraceEvent/Workspace/Verification/Human Review 闭环 |
| 8 | 预览 P1 | 能从工程面板预览生成项目 |
| 9 | Platform 模式 P1 | 能通过 Claude Code / Codex CLI 在沙箱中修改项目并生成 patch |
| 10 | 部署 P2 | 能一键部署静态项目或容器项目 |

## MVP 验收标准

| 编号 | 验收项 |
|------|--------|
| A1 | 用户可以注册、登录、配置 OpenAI 或 Anthropic Provider |
| A2 | 用户可以创建单聊并发送消息 |
| A3 | Java 后端可以创建结构化 AgentTask 并发布到 `agent:tasks`（不含明文 API Key） |
| A4 | Python AI Harness 可以消费 AgentTask、通过内网凭据接口解析 API Key、调用 LLM |
| A5 | Agent 回复可以通过 WebSocket 流式显示在前端 |
| A6 | Agent 生成代码块后，前端可以正确渲染 Markdown/代码块 |
| A7 | Python AI Harness 可以生成 AgentRun 记录和 TraceEvent 流式事件 |
| A8 | 前端可以展示 FilePatch Diff 面板和 Approve/Reject 审核按钮 |
| A9 | Docker Compose 可以一键启动 MVP 所需服务 |
