# Batch 4: Java WebSocket 与 Redis 任务通道

**依赖**: Batch 3（Session、Message API 全部可用）
**产出**: WebSocket 实时聊天、Redis Stream 任务投递与结果订阅、内网凭据接口
**这是打通 M1 端到端闭环的关键批次**

---

## 1. WebSocket 配置与认证

### WebSocketConfig
注册 `/ws/chat` endpoint，注入 `ChatWebSocketHandler` 和 `WebSocketAuthHandler`

### WebSocketAuthHandler
连接建立后不鉴权，客户端必须在 5 秒内发 `auth.init`:
```json
{ "type": "auth.init", "payload": { "token": "jwt-token" } }
```
- 校验 JWT → 将 userId 绑定到 WebSocket session attributes
- 5 秒未鉴权或 token 无效 → 关闭连接 (CloseStatus 4001)

---

## 2. ChatWebSocketHandler（核心）

### 2.1 上行消息处理

收到客户端文本帧 → 解析 JSON → 按 type 路由:

**chat.send（群聊）**:
```json
{
  "type": "chat.send",
  "payload": {
    "sessionId": "uuid",
    "content": "消息文本",
    "mentions": [{"agentId": "uuid", "displayName": "前端Agent", "startPos": 0, "endPos": 6}]
  }
}
```

**chat.send（单聊）**:
```json
{
  "type": "chat.send",
  "payload": {
    "sessionId": "uuid",
    "content": "帮我写导航栏",
    "mentions": []
  }
}
```

**路由规则**:
- `sessionType = DIRECT`: 忽略 mentions，消息自动路由到该会话中唯一的 AGENT 成员
- `sessionType = GROUP`: 必须含 mentions，否则只存消息不触发 Agent
- 任何情况下都需校验 sender 是该会话成员

**处理流程**:
```
1. 校验用户是该 session 的成员
2. 持久化用户消息 → messages 表 (sender_type=USER)
3. 根据路由规则确定目标 Agent(s)
4. 对每个目标 Agent:
   a. AgentService.resolveProvider(agentId, userId) → 拿到 providerId/providerType/model/baseUrl
   b. 构建 AgentTask (taskId=UUID, sessionId, agentId, agentMode, systemPrompt, instruction=content, messages=最近20条上下文, llmRef={providerId, providerType, model, baseUrl})
   c. TaskPublisher.publish(agentTask) → XADD agent:tasks
   d. 发送 WS 下行: { type: "chat.stream", payload: { messageId, sessionId, agentId, token: "", isComplete: false } }
      （前端收到后显示 "Agent 正在输入..."）
```

### 2.2 SessionSubscriptionManager

```
- subscribe(userId, sessionId, wsSession): 用户订阅某会话 → Map<sessionId, Set<wsSession>>
- unsubscribe(userId, sessionId): 取消订阅
- getSubscribers(sessionId): 获取某会话的所有 WS 连接
- onDisconnect(wsSession): 清理该连接的所有订阅
```

---

## 3. TaskPublisher

```java
public class TaskPublisher {
    // 注入 RedisTemplate<String, String>
    void publish(AgentTask task) {
        Map<String, String> fields = Map.of(
            "taskId", task.taskId,
            "sessionId", task.sessionId,
            "agentId", task.agentId,
            "agentMode", task.agentMode,
            "platformType", task.platformType != null ? task.platformType : "",
            "providerId", task.llmRef.providerId,
            "providerType", task.llmRef.providerType,
            "model", task.llmRef.model,
            "baseUrl", task.llmRef.baseUrl != null ? task.llmRef.baseUrl : "",
            "systemPrompt", task.systemPrompt,
            "instruction", task.instruction,
            "messages", toJson(task.contextMessages),
            "workspaceFiles", toJson(task.workspaceFiles),
            "contextLimit", String.valueOf(task.contextLimit)
        );
        // XADD agent:tasks * field1 value1 field2 value2 ...
        redisTemplate.opsForStream().add("agent:tasks", fields);
    }
}
```

**关键**: agent:tasks 消息中**不包含** apiKey，只传 providerId。Python 自己调内网接口解析。

---

## 4. StreamSubscriber（Redis Pub/Sub 订阅）

```
订阅模式: agent:stream:{taskId} （每个任务一条 Pub/Sub channel）
收到消息后:
  1. 解析 JSON → 根据 eventType 处理
     - "token":     → WS 转发 chat.stream { token: "xxx", isComplete: false }
     - "status":    → WS 转发 chat.stream { isComplete: true/false }
     - "file_change": → WS 转发 chat.actions { codeBlocks: [...] }
     - "verification": → WS 转发 verification 状态
  2. 通过 SessionSubscriptionManager 找到订阅该会话的 WS 连接
  3. 发送下行消息

同时订阅: agent:results Stream (XREADGROUP)
  收到完整 AgentResult 后:
    1. 持久化 Agent 消息到 messages 表
    2. 提取代码块 → message_code_blocks
    3. 自动创建 code_reviews 记录 (PENDING)
    4. WS 转发 chat.actions + chat.stream(isComplete=true)
    5. XACK 确认消费
```

**兜底**: Pub/Sub token 可能丢失，`agent:results` 包含完整内容，前端可用它做最终渲染。

---

## 5. CredentialService + InternalCredentialController

### CredentialService
```java
ResolvedCredential resolveCredential(String providerId, String taskId, String sessionId, String agentId) {
    1. 校验 service token（从配置注入）
    2. 查 agent:tasks 发布时的记录校验 taskId/sessionId/agentId 归属
    3. UserProviderMapper.findById(providerId) → 校验属于该会话 owner
    4. AES 解密 apiKeyEnc → 返回 ResolvedCredential
}
```

### InternalCredentialController
```
POST /internal/providers/{providerId}/credentials:resolve
  Header: X-Service-Token: {INTERNAL_SERVICE_TOKEN}
  Request:  { taskId, sessionId, agentId }
  Response: { providerType, model, baseUrl, apiKey }
  安全:
    - 仅 Docker 内网可访问（Nginx 层不代理 /internal/*）
    - 不记录 apiKey 到日志
    - 不缓存响应
```

---

## 6. WebSocket 下行消息格式

```
chat.stream:
  { type: "chat.stream", payload: { messageId, sessionId, agentId, token, isComplete } }

chat.actions:（Agent 回复完成后发送，含 Diff/预览按钮 + 代码块）
  { type: "chat.actions", payload: { messageId, actions: ["diff","preview"], codeBlocks: [...] } }

chat.error:
  { type: "chat.error", payload: { messageId, sessionId, error: "错误描述" } }

chat.system:
  { type: "chat.system", payload: { sessionId, content: "某某已加入群聊" } }
```

**前端重连策略**（WebSocket 客户端侧实现，本批次只需后端支持）:
- 心跳: 每 30s ping，60s 无 pong 视为断线
- 重连: 指数退避 1s→2s→4s→8s→16s（最大 30s）
- 重连后重新 auth.init + 拉断线期间消息

---

## 7. WebMvcConfig（CORS + Interceptor）

```
WebMvcConfig implements WebMvcConfigurer:
  addInterceptors: 注册 JwtAuthInterceptor，排除 /api/auth/**, /api/health, /internal/**
  addCorsMappings: 开发阶段允许 localhost:5173（Vite dev server）
```

---

## 验收标准

- [ ] WebSocket 连接 → 5 秒内不 auth.init → 被断开 (4001)
- [ ] auth.init 后可在 DIRECT 会话发送消息 → 消息持久化 → AgentTask 发布到 Redis
- [ ] Python consumer 能从 `agent:tasks` 读到消息
- [ ] Python 发布 token 到 `agent:stream:{taskId}` → Java 收到 → WS 转发到前端
- [ ] Python 发布 `agent:results` → Java 持久化 Agent 回复 + 提取代码块
- [ ] `/internal/providers/{id}/credentials:resolve` 返回明文 API Key
- [ ] 无 X-Service-Token 访问内网接口返回 403
- [ ] GROUP 会话不带 mentions 的消息只存储不触发 Agent
- [ ] 整个流程: 前端 → WS → Java → Redis → Python → LLM → Redis → Java → WS → 前端 可跑通
