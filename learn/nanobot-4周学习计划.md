# nanobot 4周每日学习计划

## 学习目标

这份计划面向从 0 开始学习 nanobot 项目的同学。4 周后，你应该能够：

- 本地启动 nanobot，并理解基本使用方式。
- 看懂从用户消息到模型响应的核心链路。
- 理解 Tool、Provider、Channel、Config、Session、WebUI 的职责。
- 独立实现一个小功能，并补充测试。
- 整理出一个可以写进简历的扩展项目。

核心主线：

```text
Channel -> MessageBus -> AgentLoop -> AgentRunner -> Provider/Tools -> OutboundMessage
```

每天建议学习时间：1.5 到 2 小时。

- 30 分钟读代码。
- 30 分钟跑命令或测试。
- 30 到 45 分钟做笔记或小改动。
- 15 分钟复盘当天收获。

注意：不要一开始就试图读完整个项目。先抓主链路，再看扩展点。

---

## 第 1 周：跑起来，建立项目地图

本周目标：知道 nanobot 是什么，如何启动，核心目录分别负责什么。

### 第 1 天：认识项目

目标：知道项目定位和整体能力。

阅读文件：

- `README.md`
- `.agent/design.md`
- `.agent/gotchas.md`
- `AGENTS.md`

任务：

- 用自己的话写下 nanobot 是什么。
- 整理项目支持哪些能力：WebUI、Channel、Provider、Tool、Memory、MCP、Session。
- 记录你暂时看不懂的关键词。

产出：

- 一篇笔记：`nanobot 是什么`
- 一句话总结：这个项目解决了什么问题。

### 第 2 天：本地安装和启动

目标：能在本地启动项目。

命令：

```bash
pip install -e .
nanobot --help
nanobot onboard
nanobot gateway
```

任务：

- 观察 CLI 有哪些命令。
- 找到配置文件位置。
- 记录启动过程中出现的日志。

阅读文件：

- `nanobot/cli/commands.py`
- `nanobot/config/schema.py`
- `nanobot/config/loader.py`

产出：

- 一篇笔记：`nanobot 如何启动`

### 第 3 天：认识目录结构

目标：建立项目地图。

重点目录：

```text
nanobot/agent/       Agent 核心逻辑
nanobot/bus/         消息总线
nanobot/channels/    聊天平台适配
nanobot/providers/   大模型 Provider
nanobot/agent/tools/ 工具系统
nanobot/config/      配置系统
nanobot/session/     会话和上下文
nanobot/webui/       WebUI 后端辅助逻辑
webui/               React 前端
tests/               测试
```

任务：

- 每个目录写一句中文说明。
- 不需要深入代码，只要知道职责。

产出：

- 一张项目目录说明表。

### 第 4 天：理解消息事件

目标：知道消息在系统中如何表示。

阅读文件：

- `nanobot/bus/events.py`
- `nanobot/bus/queue.py`
- `tests/bus/test_runtime_events.py`

任务：

- 找到 `InboundMessage` 和 `OutboundMessage`。
- 理解 MessageBus 为什么要存在。
- 写出消息流转的第一版流程图。

命令：

```bash
pytest tests/bus/test_runtime_events.py -v
```

产出：

- 一张简单流程图：Channel 如何把消息交给 Agent。

### 第 5 天：看第一个 Channel

目标：理解外部聊天平台如何接入。

阅读文件：

- `nanobot/channels/base.py`
- `nanobot/channels/websocket.py`
- `nanobot/channels/manager.py`
- `tests/channels/test_websocket_channel.py`

任务：

- 找到 Channel 的基础接口。
- 理解 WebSocket Channel 如何接收和发送消息。
- 记录 Channel 和 MessageBus 的关系。

命令：

```bash
pytest tests/channels/test_websocket_channel.py -v
```

产出：

- 一篇笔记：`Channel 的职责是什么`

### 第 6 天：配置系统入门

目标：理解配置如何定义和加载。

阅读文件：

- `nanobot/config/schema.py`
- `nanobot/config/loader.py`
- `tests/config/test_env_interpolation.py`
- `tests/config/test_config_paths.py`

任务：

- 找出 provider、channel、tool 相关配置。
- 理解 `${VAR}` 环境变量替换。
- 注意配置必须显式写在 Pydantic schema 中。

命令：

```bash
pytest tests/config/test_env_interpolation.py -v
pytest tests/config/test_config_paths.py -v
```

产出：

- 一篇笔记：`nanobot 配置系统如何工作`

### 第 7 天：第 1 周复盘

目标：把散点知识串起来。

任务：

- 重新画一遍主链路：

```text
Channel -> MessageBus -> AgentLoop -> AgentRunner -> Provider/Tools -> OutboundMessage
```

- 写出每一段的职责。
- 标出你最不理解的 3 个问题。

产出：

- 一篇复盘：`第 1 周我理解的 nanobot 架构`

---

## 第 2 周：读懂 Agent 核心链路

本周目标：理解一条用户消息如何进入 Agent，又如何得到模型响应和工具调用结果。

### 第 8 天：AgentLoop 入门

目标：理解 AgentLoop 的职责。

阅读文件：

- `nanobot/agent/loop.py`
- `tests/agent/test_loop_runner_integration.py`
- `tests/agent/test_loop_save_turn.py`

任务：

- 找到处理 inbound message 的入口。
- 理解 session key 如何生成。
- 理解 AgentLoop 为什么不直接负责所有细节。

命令：

```bash
pytest tests/agent/test_loop_runner_integration.py -v
```

产出：

- 一篇笔记：`AgentLoop 负责什么`

### 第 9 天：AgentRunner 入门

目标：理解 LLM 对话循环。

阅读文件：

- `nanobot/agent/runner.py`
- `tests/agent/test_runner_core.py`
- `tests/agent/test_runner_tool_execution.py`

任务：

- 找到发送消息给 provider 的位置。
- 找到处理 tool call 的位置。
- 理解一次模型调用可能产生多轮工具调用。

命令：

```bash
pytest tests/agent/test_runner_core.py -v
pytest tests/agent/test_runner_tool_execution.py -v
```

产出：

- 一篇笔记：`AgentRunner 如何驱动模型和工具`

### 第 10 天：上下文构建

目标：理解发给模型的上下文从哪里来。

阅读文件：

- `nanobot/agent/context.py`
- `nanobot/agent/memory.py`
- `tests/agent/test_context_builder.py`
- `tests/agent/test_memory_store.py`

任务：

- 找到 system prompt、session history、skills、tool descriptions 的来源。
- 理解为什么上下文污染会影响后续对话。

命令：

```bash
pytest tests/agent/test_context_builder.py -v
pytest tests/agent/test_memory_store.py -v
```

产出：

- 一篇笔记：`模型上下文由哪些部分组成`

### 第 11 天：Session 和历史记录

目标：理解会话如何保存。

阅读文件：

- `nanobot/session/manager.py`
- `nanobot/session/turn_continuation.py`
- `nanobot/agent/memory.py`
- `tests/session/test_turn_continuation.py`
- `tests/agent/test_session_atomic.py`

任务：

- 理解 session history 的保存方式。
- 注意 atomic write 的原因。
- 记录 session、memory、context 三者的区别。

命令：

```bash
pytest tests/session/test_turn_continuation.py -v
pytest tests/agent/test_session_atomic.py -v
```

产出：

- 一篇笔记：`Session、Memory、Context 的区别`

### 第 12 天：Provider 基础

目标：知道模型服务如何被抽象。

阅读文件：

- `nanobot/providers/base.py`
- `nanobot/providers/factory.py`
- `nanobot/providers/openai_compat_provider.py`
- `tests/providers/test_provider_retry.py`

任务：

- 找到 provider 的统一接口。
- 理解 factory 如何创建 provider。
- 找出 streaming、retry、timeout 相关逻辑。

命令：

```bash
pytest tests/providers/test_provider_retry.py -v
```

产出：

- 一篇笔记：`如何接入一个新的 LLM Provider`

### 第 13 天：工具调用链路

目标：理解模型如何调用工具。

阅读文件：

- `nanobot/agent/tools/base.py`
- `nanobot/agent/tools/registry.py`
- `nanobot/agent/tools/schema.py`
- `tests/tools/test_tool_registry.py`
- `tests/tools/test_tool_validation.py`

任务：

- 找到工具的输入 schema。
- 理解工具如何注册和发现。
- 理解工具执行结果如何回到 AgentRunner。

命令：

```bash
pytest tests/tools/test_tool_registry.py -v
pytest tests/tools/test_tool_validation.py -v
```

产出：

- 一篇笔记：`Tool 从注册到执行的完整流程`

### 第 14 天：第 2 周复盘

目标：能口头讲清楚主链路。

任务：

- 用中文写一篇完整说明：`一次用户消息在 nanobot 中如何流转`
- 必须包含这些关键词：
  - Channel
  - MessageBus
  - AgentLoop
  - AgentRunner
  - Provider
  - Tool
  - Session
  - OutboundMessage

产出：

- 一篇 800 字以内的主链路说明。

---

## 第 3 周：动手实现第一个扩展

本周目标：实现一个小型 Agent Tool，完成代码、测试和说明。

建议项目：新增 `datetime` 工具。

功能目标：

- 查询当前时间。
- 支持指定时区。
- 支持自定义输出格式。
- 参数错误时返回清晰错误。

### 第 15 天：研究已有工具

目标：模仿项目现有风格。

阅读文件：

- `nanobot/agent/tools/filesystem.py`
- `nanobot/agent/tools/message.py`
- `nanobot/agent/tools/search.py`
- `nanobot/agent/tools/base.py`

任务：

- 找出工具类如何命名。
- 找出 schema 如何定义。
- 找出错误如何返回。
- 找出测试如何写。

产出：

- 一份 `datetime` 工具设计草稿。

### 第 16 天：设计 datetime 工具接口

目标：先设计，再写代码。

建议接口：

```text
tool name: datetime

参数：
- timezone: 可选，默认使用本地时区
- format: 可选，默认 ISO 格式

返回：
- timezone
- formatted_time
- unix_timestamp
```

任务：

- 明确输入参数。
- 明确返回结构。
- 明确异常场景。

产出：

- 一份工具接口说明。

### 第 17 天：实现工具代码

目标：完成最小可用版本。

可能新增文件：

- `nanobot/agent/tools/datetime.py`

任务：

- 实现基础时间查询。
- 使用标准库，优先避免额外依赖。
- 保持代码简单。

注意：

- 不要修改 `AgentLoop` 或 `AgentRunner`。
- 新能力优先放在 `tools/` 边界内。

产出：

- 可运行的 `datetime` 工具。

### 第 18 天：写工具测试

目标：用测试保护功能。

可能新增文件：

- `tests/tools/test_datetime_tool.py`

测试场景：

- 默认时区可返回当前时间。
- 指定合法时区可返回结果。
- 指定非法时区有清晰错误。
- 自定义格式可生效。

命令：

```bash
pytest tests/tools/test_datetime_tool.py -v
pytest tests/tools/test_tool_registry.py -v
```

产出：

- 一组通过的单元测试。

### 第 19 天：补充边界和错误处理

目标：让功能更像真实项目代码。

任务：

- 检查非法参数。
- 检查空字符串。
- 检查格式化失败场景。
- 保证错误信息对用户友好。

命令：

```bash
pytest tests/tools/test_datetime_tool.py -v
ruff check nanobot/ tests/
```

产出：

- 更稳定的工具实现。

### 第 20 天：写开发说明

目标：把代码经验沉淀成文档。

建议新增笔记：

- `learn/datetime_tool_开发笔记.md`

内容：

- 为什么选择做 Tool。
- 这个 Tool 如何被注册。
- AgentRunner 如何执行这个 Tool。
- 测试覆盖了哪些场景。
- 还有哪些可以继续增强的点。

产出：

- 一篇开发笔记。

### 第 21 天：第 3 周复盘

目标：确认你已经跨过“只会看”到“能动手”的分界线。

任务：

- 重新阅读自己的代码和测试。
- 画出 `datetime` 工具被调用时的链路。
- 写一段简历描述草稿。

简历描述示例：

```text
基于 nanobot 开源 Agent Runtime 实现自定义 Agent Tool，支持结构化参数校验、异步执行、错误处理和单元测试覆盖；理解并实践了 AgentRunner 工具调用链路与插件化工具注册机制。
```

产出：

- 简历描述草稿。
- 功能演示截图或命令输出记录。

---

## 第 4 周：做一个简历级扩展项目

本周目标：在第 3 周小工具基础上，完成一个更像真实业务的扩展功能。

推荐项目：GitHub Issue 查询工具。

为什么推荐：

- 业务场景清楚。
- 能体现 Agent Tool 设计能力。
- 能体现 API 调用、错误处理、测试能力。
- 简历上比纯时间工具更有说服力。

功能目标：

- 输入仓库名和关键词。
- 查询相关 issue。
- 返回标题、状态、链接、更新时间。
- 支持数量限制。
- 网络/API 错误时返回清晰提示。

### 第 22 天：项目设计

目标：确定最终要做什么。

任务：

- 定义工具名，例如 `github_issues_search`。
- 定义输入参数：
  - `repo`
  - `query`
  - `state`
  - `limit`
- 定义输出字段：
  - `number`
  - `title`
  - `state`
  - `url`
  - `updated_at`

产出：

- 一份工具设计文档。

### 第 23 天：研究相关工具和安全边界

目标：避免写出不符合项目风格的代码。

阅读文件：

- `nanobot/agent/tools/web.py`
- `nanobot/agent/tools/search.py`
- `nanobot/security/network.py`
- `tests/tools/test_web_fetch_security.py`

任务：

- 理解项目如何处理外部网络访问。
- 思考 GitHub API 调用是否需要配置 token。
- 设计无 token 情况下的降级行为。

产出：

- 一份错误处理和安全边界说明。

### 第 24 天：实现最小版本

目标：完成核心查询逻辑。

可能新增文件：

- `nanobot/agent/tools/github_issues.py`

任务：

- 实现参数校验。
- 实现 GitHub issue 查询。
- 返回结构化结果。
- 不在工具里泄露 token 或敏感信息。

产出：

- 可运行的最小版本。

### 第 25 天：写测试

目标：保证功能可维护。

可能新增文件：

- `tests/tools/test_github_issues_tool.py`

测试场景：

- 参数合法时返回 issue 列表。
- `limit` 超出范围时被限制。
- 仓库名非法时返回错误。
- API 错误时返回清晰错误。
- 没有结果时返回空列表和说明。

命令：

```bash
pytest tests/tools/test_github_issues_tool.py -v
ruff check nanobot/ tests/
```

产出：

- 测试通过。

### 第 26 天：完善用户体验

目标：让工具结果更适合 LLM 使用。

任务：

- 优化返回字段。
- 控制返回数量，避免上下文过长。
- 错误信息写得明确。
- 增加必要注释，但不要过度注释。

产出：

- 更适合真实 Agent 使用的工具。

### 第 27 天：整理项目说明

目标：把功能包装成简历项目。

建议新增笔记：

- `learn/github_issue_tool_项目总结.md`

内容：

- 项目背景。
- 需求分析。
- 架构位置。
- 核心实现。
- 测试覆盖。
- 遇到的问题。
- 后续优化方向。

产出：

- 一篇完整项目总结。

### 第 28 天：最终复盘和简历整理

目标：形成可以对外表达的成果。

任务：

- 整理一段 3 到 5 句话的项目介绍。
- 整理一段简历 bullet。
- 准备面试时可以讲的技术点。

简历描述示例：

```text
参与 nanobot 开源 Agent Runtime 学习与扩展，基于其 Tool 插件机制实现 GitHub Issue 查询工具，支持结构化参数校验、外部 API 调用、异常处理、结果裁剪和 pytest 测试覆盖；深入理解 Channel、MessageBus、AgentLoop、AgentRunner、Provider 与 Tool 的端到端调用链路。
```

面试可讲技术点：

- 为什么 Tool 是合适的扩展点。
- AgentRunner 如何处理 tool call。
- 如何设计工具输入 schema。
- 如何避免工具返回过多上下文。
- 如何写可维护的测试。

产出：

- 最终学习总结。
- 简历项目描述。
- 后续学习计划。

---

## 每周检查清单

### 第 1 周检查

- 能启动项目。
- 能说清楚核心目录职责。
- 能解释 MessageBus 的作用。
- 能画出主链路第一版。

### 第 2 周检查

- 能区分 AgentLoop 和 AgentRunner。
- 能解释上下文如何构建。
- 能解释 Provider 的作用。
- 能解释 Tool 如何被调用。

### 第 3 周检查

- 完成一个小 Tool。
- 写出对应测试。
- 跑通相关 pytest。
- 能说明自己的代码改在哪里、为什么改。

### 第 4 周检查

- 完成一个更真实的扩展功能。
- 有测试、有文档、有总结。
- 能写出简历描述。
- 能用 3 分钟讲清楚项目架构和你的贡献。

---

## 推荐学习顺序总结

不要按目录从上到下读。推荐顺序是：

```text
README
-> CLI 启动
-> Config
-> Bus
-> Channel
-> AgentLoop
-> AgentRunner
-> Context / Session / Memory
-> Provider
-> Tool
-> WebUI
```

如果只想优先做出成果，顺序可以更实用：

```text
跑起来
-> 看懂 Tool
-> 实现 datetime Tool
-> 实现 GitHub Issue Tool
-> 回头补 AgentRunner 和 Provider
```

---

## 最重要的学习原则

- 不要只看代码，一定要跑测试。
- 不要一开始追求看懂所有模块。
- 不要轻易改 `AgentLoop` 和 `AgentRunner`。
- 新功能优先从 Tool、Channel、Provider、Skill 这些扩展点进入。
- 每天都写一点中文笔记。
- 每周都产出一个可展示成果。

4 周结束后，你不需要声称自己完全掌握 nanobot 的所有细节。更好的目标是：

> 我理解 nanobot 的主链路，并且能基于它的扩展机制独立实现一个可测试、可维护、可展示的 Agent 功能。
