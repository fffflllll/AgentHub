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
| M1 | 跑通单 Agent 对话闭环 | 登录、Provider 配置、单聊、WebSocket、LLM 流式响应 |
| M2 | 跑通群聊协作闭环 | 群聊、@mention、多 Agent 路由、Orchestrator 任务计划 |
| M3 | 跑通代码工作流闭环 | 代码块提取、Diff、审核应用、项目文件管理 |
| M4 | 跑通预览和部署闭环 | 项目导入、沙箱构建、网页预览、一键部署 |
| M5 | 引入 Agent 平台模式 | Claude Code / Codex CLI 沙箱执行、patch 标准化 |

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
| P1 | 实现代码块展示和操作按钮 | Agent 结果消息 | Markdown 渲染、语法高亮、Diff/预览/部署按钮 |
| P1 | 实现右侧文件树和 Diff 面板 | 代码块/审核 API | 文件树、Monaco DiffEditor、Approve/Reject |
| P1 | 实现网页预览面板 | 预览 API | iframe 预览、构建中/失败状态 |
| P1 | 实现部署状态展示 | 部署 API | 部署进度、成功 URL、失败错误 |
| P2 | 增加多会话后台状态提示 | WS 订阅 | 会话级进行中标记、未读角标 |
| P2 | 增加移动端或窄屏适配 | 基础布局 | 响应式折叠侧栏和工程面板 |

## Java 后端

| 优先级 | 任务 | 依赖 | 产出 |
|--------|------|------|------|
| P0 | 搭建 Spring Boot 3 工程 | 无 | `backend-java/` 项目骨架、健康检查 |
| P0 | 配置 Spring Security + JWT | 用户表 | 注册、登录、JWT 鉴权过滤器 |
| P0 | 实现用户模块 | 数据库迁移 | `AuthController`、`UserController`、`UserService` |
| P0 | 实现 Provider 配置模块 | Provider 表 | Provider CRUD、AES-256-GCM 加密存储 |
| P0 | 实现 Agent 配置读取 | Agent 表 | Agent 列表、Provider 覆盖解析 |
| P0 | 实现会话模块 | Session 表 | 创建单聊、会话列表、删除会话 |
| P0 | 实现消息模块 | Message 表 | 消息持久化、历史分页、代码块提取入口 |
| P0 | 实现 WebSocket 聊天协议 | 用户/会话/消息模块 | `chat.send`、`chat.stream`、`chat.message`、错误消息 |
| P0 | 实现 Redis Stream 任务发布 | Redis | `TaskPublisher`、`agent:tasks` 写入 |
| P0 | 实现 Redis Pub/Sub 流式订阅 | Redis | `StreamSubscriber`、token 转发到 WS |
| P0 | 实现内部凭据解析接口 | Provider 模块 | `/internal/providers/{id}/credentials:resolve`、`CredentialService` |
| P1 | 实现群聊成员管理 | SessionMember 表 | 添加/移除 Agent、成员列表 |
| P1 | 实现 @mention 路由 | Agent/会话模块 | `MentionParser`、单聊自动路由、群聊指定 Agent |
| P1 | 实现 OrchestratorService | Task 表 | 任务拆解、Schema 校验、任务链创建 |
| P1 | 实现 TaskChainManager | OrchestratorService | 依赖检查、并发上限、状态推进、`task.update` |
| P1 | 实现 Agent 结果消费 | Redis `agent:results` | Agent 消息持久化、codeBlocks/patches/artifacts 处理 |
| P1 | 实现代码审核 API | CodeReview 表 | 查询审核状态、Approve/Reject、写入 `project_files` |
| P1 | 实现项目导入 API | Python importer | `/api/sessions/{id}/import`、写入 `project_files` |
| P1 | 实现预览 API | Python sandbox | `/api/sessions/{id}/preview`、`/api/preview/{id}` |
| P1 | 实现部署 API | Python deploy | `/api/sessions/{id}/deploy`、`/api/deploy/{id}` |
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
| P0 | 实现 Redis Streamer | Redis Pub/Sub | token 流、完成事件、错误事件 |
| P1 | 实现 Markdown 代码块解析 | AgentResult | `codeBlocks` 提取、语言和文件名解析 |
| P1 | 实现 Orchestrator JSON 解析辅助 | Orchestrator prompt | taskPlan JSON 提取、校验错误返回 |
| P1 | 实现项目导入 importer | Docker/git | GitHub 浅克隆、文件过滤、结果回传 |
| P1 | 实现沙箱构建预览 | Docker | React/Vue 安装依赖、构建、产物服务 |
| P1 | 实现部署模块 | 部署 Token | 静态项目 Vercel/Netlify、失败信息回传 |
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
| P0 | 创建项目文件表 | 会话表 | `project_files` |
| P1 | 创建任务计划表 | 消息/Agent 表 | `task_plans`、`task_items`，`depends_on` JSON |
| P1 | 创建部署记录表 | 会话表 | `deployments` |
| P1 | 创建代码审核表 | 消息/用户表 | `code_reviews`、审核状态索引 |
| P1 | 补充预览状态存储 | 预览 API | `previews` 表或 Redis 状态结构 |
| P1 | 补充任务执行审计表 | Java/Python 协议 | `agent_task_runs`，用于凭据接口校验任务归属 |
| P2 | 优化索引和分页性能 | 压测数据 | 消息游标索引、会话更新时间索引 |
| P2 | 评估文件存储扩容 | 大项目场景 | MinIO/S3 迁移方案 |

## Docker

| 优先级 | 任务 | 依赖 | 产出 |
|--------|------|------|------|
| P0 | 编写根 `docker-compose.yml` | 三端骨架 | frontend、java-api、python-ai、mysql、redis 服务 |
| P0 | 编写前端 Dockerfile | 前端工程 | Vite build + nginx serve |
| P0 | 编写 Java Dockerfile | Java 工程 | JAR 构建和运行镜像 |
| P0 | 编写 Python Dockerfile | Python 工程 | FastAPI/consumer 运行镜像 |
| P0 | 配置 MySQL 和 Redis 数据卷 | Compose | `mysqldata`、`redisdata` |
| P0 | 配置基础环境变量 | Compose | `JWT_SECRET`、`AES_KEY`、`INTERNAL_SERVICE_TOKEN`、数据库密码 |
| P1 | 配置 Python 管理 Docker socket | 沙箱模块 | `/var/run/docker.sock` 挂载和权限说明 |
| P1 | 构建 Claude Code 沙箱镜像 | PlatformAdapter | `agenthub/sandbox:claude-code` |
| P1 | 构建 Codex 沙箱镜像 | PlatformAdapter | `agenthub/sandbox:codex` |
| P1 | 实现 build sandbox 网络策略 | 沙箱模块 | 允许出站 npm/LLM API，禁止入站 |
| P1 | 实现 runtime preview 网络策略 | 预览模块 | 静态产物预览访问方案 |
| P1 | 配置部署 Token | 部署模块 | `DEPLOY_TOKEN` 注入和脱敏日志 |
| P2 | 增加本地开发 Compose profile | 开发体验 | dev/prod profile、热更新挂载 |
| P2 | 增加日志和健康检查 | 运维 | service healthcheck、日志目录规范 |

## 推荐实现顺序

| 顺序 | 任务组 | 目标 |
|------|--------|------|
| 1 | 数据库 P0 + Docker P0 | 能启动 MySQL/Redis，Java 可连接数据库 |
| 2 | Java P0 认证/Provider/会话/消息 | 能注册登录、配置模型、创建单聊、存消息 |
| 3 | Python P0 LLM 模式 | 能消费任务并直接调用大模型 |
| 4 | 前端 P0 IM 页面 | 能在浏览器发消息并看到流式回复 |
| 5 | Java/Python/前端 P1 群聊与 Orchestrator | 能通过 @ 指令完成多 Agent 协作 |
| 6 | 代码工作流 P1 | 能提取代码、展示 Diff、审核后写入项目文件 |
| 7 | 预览/部署 P1 | 能从工程面板预览和部署生成项目 |
| 8 | Platform 模式 P1 | 能通过 Claude Code / Codex CLI 修改项目并生成 patch |

## MVP 验收标准

| 编号 | 验收项 |
|------|--------|
| A1 | 用户可以注册、登录、配置 OpenAI 或 Anthropic Provider |
| A2 | 用户可以创建单聊并发送消息 |
| A3 | Java 后端可以把消息发布到 `agent:tasks` |
| A4 | Python AI 后端可以解析 Provider 凭据并调用 LLM |
| A5 | Agent 回复可以通过 WebSocket 流式显示在前端 |
| A6 | Agent 生成代码块后，前端可以展示代码块和操作入口 |
| A7 | Docker Compose 可以一键启动 MVP 所需服务 |
