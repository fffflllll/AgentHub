# Day 01 源码追踪笔记

## 搜索了什么

这次使用的关键词：

```bash
Agent
run
messages
tool_calls
provider
```

比较高信号的 grep 命令：

```bash
rg -n "\b(Agent|run|messages|tool_calls|provider)\b" nanobot/agent nanobot/session tests/agent -S
rg -n "async def run|async def _dispatch|AgentRunSpec|runner.run|publish_outbound|publish_inbound" nanobot/agent/loop.py nanobot/bus nanobot/channels nanobot/cli nanobot/nanobot.py
rg -n "async def run|def _request_model|def _execute_tools|should_execute_tools|tools.execute|chat_with_retry|chat_stream_with_retry" nanobot/agent/runner.py
```

## 已标记的关键文件

`nanobot/bus/queue.py`

这个文件很小，但它是主链路的关键边界。Channel 把用户输入发布到 `inbound`，Agent 把回复发布到 `outbound`。

`nanobot/channels/base.py`

通用 Channel 路径会创建 `InboundMessage(channel, sender_id, chat_id, content, media, metadata)`，然后调用 `bus.publish_inbound()`。

`nanobot/cli/commands.py`

CLI 路径读取终端输入，发布带 streaming 元数据的 `InboundMessage`。这是“本地用户输入”的渠道版本。

`nanobot/agent/loop.py`

主编排器。需要重点理解：

- `AgentLoop.run()` 消费 inbound messages。
- `_dispatch()` 给每个 session 加锁，并处理 streaming/outbound 发布。
- `_process_message()` 驱动状态机。
- `_state_build()` 组装上下文，并提前持久化用户消息。
- `_state_run()` 委托给 `_run_agent_loop()`。
- `_run_agent_loop()` 创建 `AgentRunSpec` 并调用 `AgentRunner.run()`。
- `_state_save()` 和 `_save_turn()` 持久化结果。

`nanobot/agent/context.py`

构造 provider input。它从历史、当前用户内容、运行时上下文、媒体、memory、skills 和 bootstrap 文件生成最终 `messages` 列表。

`nanobot/session/manager.py`

保存和回放 session history。`Session.get_history()` 很重要，因为它决定模型能看到哪些旧消息，包括时间戳、图片占位和合法 tool-call 边界。

`nanobot/agent/runner.py`

核心模型/工具循环。它反复执行：

1. 准备经过治理的 `messages_for_model`。
2. 调用 provider。
3. 如果有可执行 tool calls，追加一条 assistant tool-call message。
4. 执行工具。
5. 追加 tool result messages。
6. 再次调用 provider。
7. 遇到最终 assistant answer、失败或迭代限制时停止。

`nanobot/providers/base.py`

定义统一的 provider 数据结构：`LLMResponse`、`ToolCallRequest` 和 `should_execute_tools`。具体 provider 靠这个契约接入 runner。

`nanobot/agent/tools/registry.py`

提供模型可见的工具定义，并执行 tool calls。它是从模型选中的 function name 到 Python tool object 的窄桥。

`tests/agent/test_runner_core.py`

这是理解 runner 的优秀可执行示例。第一次 provider call 返回 `tool_calls`；工具执行；第二次 provider call 收到 tool result；最终 content 成为回答。

## 主要数据形态

`InboundMessage`

面向渠道的输入。包含 channel、chat id、sender id、文本内容、媒体路径、metadata 和可选 session override。

`Session.messages`

持久化对话历史。包含 user、assistant、tool 消息。它不完全等于模型输入，因为持久化时媒体和 runtime metadata 可能会被清洗。

`messages`

面向 provider 的对话列表。通常以 system prompt 开头，包含筛选后的 session history，最后是当前轮用户内容和 runtime metadata。

`LLMResponse`

Provider 输出。可能包含最终文本、tool calls、usage、finish reason、reasoning content 或错误元数据。

`ToolCallRequest`

一条标准化后的模型工具调用请求。Runner 会把它序列化成 OpenAI 风格的 assistant `tool_calls`，执行工具，并用 `tool_call_id` 配对工具结果。

`AgentRunResult`

Runner 返回给 `AgentLoop` 的结果：final content、完整本轮 messages、tools used、usage、stop reason、tool events 和 injection 状态。

## 单轮对话叙事

1. CLI 或 Channel 发布 inbound message。
2. `AgentLoop.run()` 消费消息并启动 `_dispatch()`。
3. `_dispatch()` 锁定 session，然后调用 `_process_message()`。
4. `_process_message()` 恢复 session 状态、必要时 compact、检查 command、构造上下文、运行 agent、保存并响应。
5. `_state_build()` 从 session 取近期历史，并让 `ContextBuilder` 生成 provider-ready messages。
6. `_state_run()` 调用 `_run_agent_loop()`。
7. `_run_agent_loop()` 绑定 request context、workspace scope、file state，然后调用 `AgentRunner.run()`。
8. `AgentRunner.run()` 携带 `messages` 和工具定义调用 provider。
9. 如果模型返回 tool calls，runner 通过 `ToolRegistry` 执行工具，并追加 tool result messages。
10. Runner 回到 provider，直到拿到最终 content。
11. `AgentLoop._save_turn()` 把本轮新消息写入 session，`SessionManager.save()` 写 JSONL。
12. `AgentLoop._assemble_outbound()` 返回 `OutboundMessage`。
13. `_dispatch()` 发布 outbound message，Channel 或 CLI 渲染给用户。

## 下一步建议读的测试

`tests/agent/test_runner_core.py`

先读它，理解模型/工具循环。

`tests/agent/test_loop_runner_integration.py`

再读它，理解 `AgentLoop` 和 `AgentRunner` 的边界。

`tests/agent/test_context_builder.py`

读它理解 system prompt、runtime metadata、history 和 media 行为。

`tests/agent/test_loop_save_turn.py`

读它理解持久化规则：什么会保存、什么会跳过，以及 tool calls 在取消/中断时怎么保留下来。

`tests/agent/test_runner_injections.py`

主链路看懂后再读。它解释后续用户消息如何在当前 turn 中途被注入，而不是完全等下一轮处理。

## 3 个还没看懂的问题

1. `turn_continuation` 到底如何判断一轮对话应该内部继续，而不是立即返回给用户？

2. `AutoCompact`、`Consolidator` 和 `Dream` 之间如何分工？它们分别负责 session summary、长期记忆和近期历史的哪一部分？

3. 具体 provider 实现在哪里把各家不同的 function/tool-call 格式归一化成 `LLMResponse`？Anthropic thinking blocks、OpenAI-compatible extra fields 这类边界情况分别在哪里处理？

## 明天继续阅读的方法

选一个行为，只追一个变量。

对于主链路，建议追 `messages`：

```text
Session.messages -> Session.get_history() -> ContextBuilder.build_messages()
-> AgentRunSpec.initial_messages -> AgentRunner.run()
-> messages_for_model -> provider -> tool messages / final assistant
-> AgentRunResult.messages -> AgentLoop._save_turn() -> Session.messages
```

不要一上来读所有 helper。先把 helper 分成三类：

- 主链路必需：现在读。
- 错误恢复行为：先略读，之后再细看。
- streaming、progress、compaction、subagents 等运行时增强：先标记，暂时推后。

这一天的目标不是记住每个函数，而是讲清楚所有权：Channel 管传输，Bus 管解耦，Loop 管一轮对话编排，Context 管 prompt 组装，Runner 管模型/工具迭代，Registry 管工具执行，Session 管持久化历史。
