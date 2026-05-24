# AgentHub Process

本文档用于跟踪 AgentHub 的小步执行进度。所有任务以当前本地仓库为准，不主动同步或覆盖远程仓库状态。

## 状态图例

| 状态 | 含义 |
| --- | --- |
| TODO | 尚未开始 |
| DOING | 正在执行 |
| REVIEW | 已完成实现，等待人工 review |
| DONE | 已 review 通过 |
| BLOCKED | 被外部条件或关键决策阻塞 |

## 执行原则

- 每次只做一个最小可 review 模块。
- 单个模块尽量只覆盖一个主题，避免跨前端、Java、Python、数据库同时大改。
- 提交前检查 `git status`，只提交本模块相关文件。
- 代码模块优先配套最小验证；文档模块说明无需运行测试的原因。
- 后续计划如与本地代码冲突，以本地代码实际状态为准调整。

## 当前阶段

| 阶段 | 目标 | 状态 |
| --- | --- | --- |
| M0 | 建立执行基线，修正文档和基础设施一致性 | REVIEW |
| M1 | 跑通认证和 Provider 配置 | DOING |
| M2 | 跑通单 Agent 流式对话闭环 | TODO |
| M3 | 完成前端 IM MVP | TODO |
| M4 | 支持群聊、@mention 和 Orchestrator | TODO |
| M5 | 支持代码块解析、Diff 和审核应用 | TODO |
| M6 | 支持项目导入和预览 | TODO |
| M7 | 支持 Claude Code / Codex 平台模式 | TODO |
| M8 | 支持部署闭环 | TODO |

## 任务清单

| ID | 模块 | 范围 | 状态 | 验收标准 |
| --- | --- | --- | --- | --- |
| M0.1 | 建立进度追踪 | 新建根目录 `process.md`，记录执行原则、阶段、任务和验收方式 | DONE | 只新增 `process.md`，不修改业务代码 |
| M0.2 | 文档一致性修正 | 修正 docs 中数据库口径、FR 编号、沙箱网络策略等明显冲突 | REVIEW | 文档与本地 Compose、迁移、代码骨架一致 |
| M0.3 | 数据库迁移基线检查 | 对照设计补齐或明确延后缺失表/约束 | REVIEW | Flyway 迁移在空库可执行，缺失项有明确状态 |
| M0.4 | 本地启动基线 | 验证 Compose 配置、健康检查和 README 指令 | REVIEW | `docker compose config` 通过，健康检查路径清晰 |
| M1.1 | Java Auth 骨架 | 增加用户实体、仓库、JWT 工具和 Auth API 的最小闭环 | REVIEW | 可注册、登录并返回 JWT |
| M1.1.5 | 前端认证闭环 | 增加 `/api/users/me`、前端登录/注册页、Token 持久化、路由守卫、退出登录、Agent 列表和空会话列表兜底 | REVIEW | 可从前端登录/注册，刷新后恢复登录态，未登录访问主页面跳转登录页，登录后工作台不因缺少 `/api/agents` 或 `/api/sessions` 报 500 |
| M1.2 | Provider 配置 | 增加 Provider CRUD、默认 Provider 和 API Key 加密存储 | TODO | API Key 不回显，默认 Provider 约束生效 |
| M2.1 | 会话与消息基础 | 增加单聊创建、会话列表、消息持久化和历史查询 | TODO | 用户可创建单聊并查询历史消息 |
| M2.2 | WebSocket 最小协议 | 实现鉴权连接、`chat.send`、`chat.message` 和错误返回 | TODO | 前端或脚本可通过 WS 发送并收到持久化消息 |
| M2.3 | LLM 流式闭环 | Java 发布 Redis task，Python 调 LLM/mock LLM 并流式返回 | TODO | 单 Agent 消息可通过 WS 流式展示 |

## 验证记录

| 日期 | 模块 | 验证 | 结果 |
| --- | --- | --- | --- |
| 2026-05-24 | M0.1 | 文档-only 变更，无需运行测试 | 通过 |
| 2026-05-24 | M0.2 | `rg` 检查数据库旧口径、重复 FR-04、预览状态存储旧口径 | 通过 |
| 2026-05-24 | M0.3 | 临时 MySQL 空库执行 `V1__init_schema.sql` + `V2__add_task_and_review_tables.sql` + `V3__audit_preview_and_constraints.sql`，并 `SHOW TABLES` | 通过 |
| 2026-05-24 | M0.4 | `docker compose config` | 通过 |
| 2026-05-24 | M1.1 | `mvn test` | 通过 |
| 2026-05-24 | M1.1 | 临时 MySQL 启动 Java API，curl 验证注册、登录、错误密码 401 | 通过 |
| 2026-05-24 | M1.1 安全硬化 | `mvn test`，显式 `JWT_SECRET` 启动 Java API，curl 验证弱密码 400、注册/登录成功、未鉴权 401 | 通过 |
| 2026-05-24 | M1.1.5 | `backend-java` 执行 `mvn test` | 通过（无测试源，编译通过） |
| 2026-05-24 | M1.1.5 | `frontend` 执行 `npm install` 后 `npm run build` | 通过 |
| 2026-05-24 | M1.1.5 | 本地 Java API + MySQL，curl 验证注册、登录、`/api/users/me`、未鉴权 401 | 通过 |
| 2026-05-24 | M1.1.5 | Vite dev server 浏览器验收 `/` 路由守卫、`/login`、`/register`、登录进入工作台 | 通过 |
| 2026-05-24 | M1.1.5 | 补齐 `GET /api/agents`、`GET /api/sessions` 空列表兜底和静态资源 404 处理后执行 `mvn test` | 通过（无测试源，编译通过） |

## 阻塞项

暂无。
