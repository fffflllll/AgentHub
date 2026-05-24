# Batch 5: Python AI 后端 P0（LLM 模式端到端）

**依赖**: Batch 4（Java WebSocket + Redis Stream + 内网凭据接口 全部可用）
**产出**: 消费 AgentTask → 解析凭据 → 调用 LLM → 流式返回 token

---

## 1. 现状

已有文件:
- `app/models.py` — AgentTask, LLMRef, ResolvedLLMConfig, AgentResult, ChatMessage, FilePatch 数据类 ✅
- `app/core/config.py` — Settings (redis_url, java_internal_url, internal_service_token) ✅
- `app/consumer/task_consumer.py` — 占位函数 `raise NotImplementedError`
- `app/main.py` — FastAPI app + /health

**需要在现有基础上实现，而不是重写。**

---

## 2. 新建文件清单

```
backend-python/app/
├── adapter/
│   └── llm/
│       ├── __init__.py
│       ├── base.py              # BaseLLMAdapter 抽象类
│       ├── openai_adapter.py    # OpenAI chat/completions 流式
│       ├── anthropic_adapter.py # Anthropic messages 流式
│       ├── custom_adapter.py    # OpenAI 兼容接口（自定义 base_url）
│       └── registry.py          # Provider → Adapter 映射
├── executor/
│   ├── __init__.py
│   ├── executor.py              # 消费 task → 解析凭据 → 调 adapter → 组装 AgentResult
│   └── credential_client.py     # HTTP 调 Java /internal/providers/{id}/credentials:resolve
├── streamer/
│   ├── __init__.py
│   └── redis_streamer.py        # token/status/error 发布到 Redis Pub/Sub + agent:results
└── consumer/
    └── task_consumer.py         # 重写：Redis Streams 消费者组（替换占位符）
```

**本次不做**：harness/、workspace/、verification/、sandbox/、platform adapter、import 等模块 — 这些是 P1/P2 内容。

---

## 3. adapter/llm/base.py — BaseLLMAdapter

```python
from abc import ABC, abstractmethod
from typing import AsyncIterator, Optional

class BaseLLMAdapter(ABC):
    @abstractmethod
    async def chat(
        self,
        messages: list[dict[str, str]],
        model: str,
        api_key: str,
        base_url: Optional[str] = None,
    ) -> AsyncIterator[str]:
        """流式返回 token 字符串，每个 yield 是一个文本增量"""
        ...
```

**关键**: 不要求所有 adapter 支持 `stream=False`（MVP 只用流式）。

---

## 4. adapter/llm/openai_adapter.py — OpenAI Adapter

```
依赖: openai SDK (pip install openai)

async def chat(messages, model, api_key, base_url):
    client = AsyncOpenAI(api_key=api_key, base_url=base_url or "https://api.openai.com/v1")
    stream = await client.chat.completions.create(
        model=model or "gpt-4o",
        messages=messages,
        stream=True,
        timeout=60.0,
    )
    async for chunk in stream:
        delta = chunk.choices[0].delta
        if delta.content:
            yield delta.content
```

**错误处理**: 捕获 `openai.APIError` 等 → 转为结构化 error event 发布（不在这层，由 executor 统一处理）。

---

## 5. adapter/llm/anthropic_adapter.py — Anthropic Adapter

```
依赖: anthropic SDK (pip install anthropic)

async def chat(messages, model, api_key, base_url):
    # 1. 提取 system 消息
    system_msg = next((m["content"] for m in messages if m["role"] == "system"), None)
    chat_messages = [m for m in messages if m["role"] != "system"]

    client = AsyncAnthropic(api_key=api_key, base_url=base_url or "https://api.anthropic.com")
    async with client.messages.stream(
        model=model or "claude-sonnet-4-20250514",
        max_tokens=4096,
        system=system_msg,
        messages=chat_messages,
        timeout=60.0,
    ) as stream:
        async for text in stream.text_stream:
            yield text
```

**注意**: Anthropic API 不支持 `base_url` 参数，但自定义 Anthropic 兼容接口（如代理）可能需要。对标准 Anthropic API 忽略 base_url 即可。

---

## 6. adapter/llm/custom_adapter.py — 自定义 OpenAI 兼容 Adapter

```
行为与 OpenaiAdapter 完全一致，区别是 base_url 为必填。
用于用户对接自己的 OpenAI 兼容代理（如 OneAPI, LiteLLM 等）。

async def chat(messages, model, api_key, base_url):
    # 与 openai_adapter 相同逻辑，但 base_url 不为空
    client = AsyncOpenAI(api_key=api_key, base_url=base_url)
    ...
```

---

## 7. adapter/llm/registry.py — Adapter 注册表

```python
from .base import BaseLLMAdapter
from .openai_adapter import OpenaiAdapter
from .anthropic_adapter import AnthropicAdapter
from .custom_adapter import CustomAdapter

LLM_ADAPTER_REGISTRY: dict[str, BaseLLMAdapter] = {
    "OPENAI":    OpenaiAdapter(),
    "ANTHROPIC": AnthropicAdapter(),
    "CUSTOM":    CustomAdapter(),
}

def get_llm_adapter(provider_type: str) -> BaseLLMAdapter:
    adapter = LLM_ADAPTER_REGISTRY.get(provider_type)
    if not adapter:
        raise ValueError(f"Unknown provider type: {provider_type}")
    return adapter
```

---

## 8. executor/credential_client.py — 凭据解析客户端

```python
import httpx
from app.core.config import settings
from app.models import ResolvedLLMConfig

async def resolve_credentials(llm_ref) -> ResolvedLLMConfig:
    """通过 Java 内网接口解析 API Key"""
    url = f"{settings.java_internal_url}/internal/providers/{llm_ref.provider_id}/credentials:resolve"
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            url,
            json={
                "taskId": "...",    # 从 AgentTask 获取
                "sessionId": "...",
                "agentId": "...",
            },
            headers={
                "X-Service-Token": settings.internal_service_token,
                "Content-Type": "application/json",
            },
        )
        resp.raise_for_status()
        data = resp.json()["data"]
        return ResolvedLLMConfig(
            provider_id=llm_ref.provider_id,
            provider_type=data["providerType"],
            model=data["model"],
            base_url=data.get("baseUrl"),
            api_key=data["apiKey"],
        )
```

**安全**: 不打印 apiKey；日志只记录 providerId 和 model。

---

## 9. executor/executor.py — 执行器

```python
async def execute_llm_task(task: AgentTask, on_event):
    """
    1. 调 credential_client 解析 API Key → ResolvedLLMConfig
    2. 调 get_llm_adapter(config.provider_type).chat(...)
    3. 逐 token 回调 on_event("token", token)
    4. 组装 AgentResult 返回
    """
    # 1. 解析凭据
    llm_config = await resolve_credentials(task.llm_ref)

    # 2. 构建 messages: [{"role": "system", "content": task.system_prompt}] + task.messages
    messages = [{"role": "system", "content": task.system_prompt}] + task.messages

    # 3. 获取 adapter
    adapter = get_llm_adapter(llm_config.provider_type)

    # 4. 流式调用
    collected_content = []
    try:
        async for token in adapter.chat(
            messages=messages,
            model=llm_config.model,
            api_key=llm_config.api_key,
            base_url=llm_config.base_url,
        ):
            collected_content.append(token)
            await on_event("token", token)
    except Exception as e:
        return AgentResult(task_id=task.task_id, status="ERROR", error=str(e))

    # 5. 返回结果
    full_text = "".join(collected_content)
    return AgentResult(
        task_id=task.task_id,
        status="SUCCESS",
        messages=[ChatMessage(role="assistant", content=full_text, message_type="TEXT")],
    )
```

---

## 10. streamer/redis_streamer.py — Redis 流式发布

```python
import json
import redis.asyncio as aioredis
from app.core.config import settings

class RedisStreamer:
    def __init__(self):
        self.redis = aioredis.from_url(settings.redis_url)

    async def stream_token(self, task_id: str, run_id: str, token: str, sequence: int):
        """发布单个 token 到 Pub/Sub"""
        msg = json.dumps({
            "taskId": task_id, "runId": run_id,
            "eventType": "token", "token": token, "sequence": sequence,
        })
        await self.redis.publish(f"agent:stream:{task_id}", msg)

    async def stream_status(self, task_id: str, run_id: str, status: str, is_complete: bool):
        """发布状态事件"""
        msg = json.dumps({
            "taskId": task_id, "runId": run_id,
            "eventType": "status", "status": status, "isComplete": is_complete, "sequence": 0,
        })
        await self.redis.publish(f"agent:stream:{task_id}", msg)

    async def publish_result(self, task_id: str, result):
        """发布完整结果到 agent:results Stream（持久化，前端兜底数据源）"""
        await self.redis.xadd("agent:results", {
            "taskId": result.task_id,
            "runId": result.run_id,
            "status": result.status,
            "messages": json.dumps([...]),  # 序列化 ChatMessage 列表
            "codeBlocks": json.dumps([]),
            "patches": json.dumps([]),
            "error": result.error or "",
        })
```

**关键**: token 通过 Pub/Sub 发布（非持久），完整结果通过 Stream 发布（持久）。

---

## 11. consumer/task_consumer.py — 重写（替换占位符）

```python
import json
import uuid
import asyncio
import redis.asyncio as aioredis
from app.core.config import settings
from app.models import AgentTask, LLMRef
from app.executor.executor import execute_llm_task
from app.streamer.redis_streamer import RedisStreamer

STREAM_KEY = "agent:tasks"
GROUP_NAME = "python-ai-workers"
CONSUMER_NAME = f"worker-{uuid.uuid4().hex[:8]}"

streamer = RedisStreamer()

async def process_task(msg_id: str, msg_data: dict):
    """处理单条 AgentTask"""
    # 1. 解析 AgentTask
    task = AgentTask(
        task_id=msg_data["taskId"],
        session_id=msg_data["sessionId"],
        agent_id=msg_data["agentId"],
        agent_mode=msg_data["agentMode"],
        instruction=msg_data["instruction"],
        system_prompt=msg_data.get("systemPrompt", ""),
        messages=json.loads(msg_data.get("messages", "[]")),
        workspace_files=json.loads(msg_data.get("workspaceFiles", "[]")),
        llm_ref=LLMRef(
            provider_id=msg_data["providerId"],
            provider_type=msg_data["providerType"],
            model=msg_data["model"],
            base_url=msg_data.get("baseUrl") or None,
        ),
    )

    run_id = str(uuid.uuid4())

    # 2. 通知 Java 开始执行
    await streamer.stream_status(task.task_id, run_id, "RUNNING", False)

    # 3. 执行
    seq = 0
    async def on_event(event_type: str, payload):
        nonlocal seq
        if event_type == "token":
            await streamer.stream_token(task.task_id, run_id, payload, seq)
            seq += 1

    result = await execute_llm_task(task, on_event)
    result.run_id = run_id  # type: ignore

    # 4. 通知完成
    await streamer.stream_status(task.task_id, run_id, result.status, True)
    await streamer.publish_result(task.task_id, result)

    return result

async def run_task_consumer():
    """启动 Redis Streams 消费者组，持续轮询 agent:tasks"""
    redis = aioredis.from_url(settings.redis_url)

    # 创建消费者组（幂等）
    try:
        await redis.xgroup_create(STREAM_KEY, GROUP_NAME, id="0", mkstream=True)
    except aioredis.ResponseError:
        pass  # 组已存在

    while True:
        try:
            # 每次读 1 条消息，block 5s
            results = await redis.xreadgroup(
                GROUP_NAME, CONSUMER_NAME,
                {STREAM_KEY: ">"}, count=1, block=5000,
            )
            for stream_name, messages in results:
                for msg_id, msg_data in messages:
                    try:
                        await process_task(msg_id, msg_data)
                        await redis.xack(STREAM_KEY, GROUP_NAME, msg_id)
                    except Exception as exc:
                        # 失败暂不 ACK，留下 pending 供排查
                        print(f"Task {msg_data.get(b'taskId', b'?')} failed: {exc}")
        except Exception as e:
            print(f"Consumer error: {e}")
            await asyncio.sleep(2)
```

**设计要点**:
- 消费者组 `python-ai-workers`，支持多 worker 实例并行消费
- 每次取 1 条 → 处理 → ACK，简单可控
- 失败不 ACK，消息留在 PEL 中便于排查（后续 P2 做死信队列）
- block 5s 避免空轮询

---

## 12. main.py 修改

在现有 FastAPI app 的 startup 事件中启动 consumer:

```python
import asyncio
from contextlib import asynccontextmanager
from app.consumer.task_consumer import run_task_consumer

@asynccontextmanager
async def lifespan(app: FastAPI):
    consumer_task = asyncio.create_task(run_task_consumer())
    yield
    consumer_task.cancel()

app = FastAPI(title="AgentHub AI", version="0.1.0", lifespan=lifespan)
```

保留现有 `/health` 接口不变。

---

## 13. requirements 新增依赖

```
# requirements.txt 或 pyproject.toml
openai>=1.0.0
anthropic>=0.30.0
httpx>=0.27.0
redis>=5.0.0
```

---

## 验收标准

- [ ] `task_consumer` 从 `agent:tasks` 持续轮询，收到消息后能解析为 AgentTask
- [ ] `credential_client` 能调通 Java 内网凭据接口（需 Java Batch 4 先可用）
- [ ] OpenAI adapter: 传入 messages + model + apiKey → 流式返回 token
- [ ] Anthropic adapter: 同上，正确处理 system prompt 分离
- [ ] Custom adapter: 用自定义 base_url 调用 OpenAI 兼容 API
- [ ] `executor` 整合: credential_client → adapter.chat() → 逐 token 回调
- [ ] `RedisStreamer` 的 token 发布到 `agent:stream:{taskId}` Pub/Sub
- [ ] 完整结果发布到 `agent:results` Stream
- [ ] 异常时返回 `AgentResult(status="ERROR", error="...")`
- [ ] Java 侧能收到 token 流并转发到前端 WS（需 Java Batch 4 联调验证）
