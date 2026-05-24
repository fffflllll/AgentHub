# Batch 3: Java 会话与消息 API

**依赖**: Batch 2（Auth、User、Provider、Agent API 全部可用）
**产出**: 可创建会话、查消息、发消息（WebSocket 除外）

---

## 1. SessionController + SessionService

```
GET /api/sessions
  查当前用户的全部会话 → List<SessionResponse>
  排序: updated_at DESC
  每条含 lastMessage（该会话最新一条消息的 content 摘要，取前 50 字）

POST /api/sessions
  Request:  { name, type(DIRECT|GROUP), agentIds[] }
  逻辑:
    1. sessions 表 insert (owner_id = currentUserId)
    2. session_members 表 insert:
       - 当前用户 (member_type=USER)
       - 每个 agentId (member_type=AGENT)
    3. 若 type=DIRECT: 自动 name = 那个 Agent 的 name（忽略传入 name）
    4. 若 type=GROUP: 至少要 1 个 Agent
  返回:     SessionResponse

DELETE /api/sessions/{id}
  校验 owner_id == currentUserId → 删除（CASCADE 删消息和成员）

GET /api/sessions/{id}/members
  返回 List<SessionMemberResponse>（含 memberType, memberId, name）

POST /api/sessions/{id}/members
  Request:  { agentIds[] }
  校验当前用户是该会话 owner → 添加 Agent 成员（去重处理）

DELETE /api/sessions/{id}/members/{memberId}
  校验 owner → 移除成员
```

**约束**:
- 删除会话前必须校验 `owner_id == currentUserId`
- DIRECT 会话创建时确认该 Agent 存在
- 成员查重: 先 SELECT (session_id, COALESCE(user_id,''), COALESCE(agent_id,'')) 是否已有

---

## 2. MessageController + MessageService

```
GET /api/sessions/{id}/messages?before={ISO8601}&limit=50
  校验当前用户是该会话成员
  游标分页: WHERE session_id=? AND created_at < ? ORDER BY created_at DESC LIMIT ?
  首次请求不传 before → 取最新 50 条
  返回: List<MessageResponse>
    每条 MessageResponse 需包含:
      - 基本字段 (id, senderType, senderId, content, type, createdAt)
      - senderName: 查 users.display_name 或 agents.name
      - codeBlocks[]: 从 message_code_blocks 表 JOIN
      - taskPlan: 若 messageType=TASK_PLAN，JOIN task_plans + task_items
```

**消息持久化**（此处只定义接口，Batch 4 的 WebSocket handler 会调用）:
- MessageService.saveMessage(sessionId, senderType, senderId, content, messageType, metadata)
- MessageService.extractCodeBlocks(messageId, content): 解析 Markdown ``` 代码块 → 写入 message_code_blocks

---

## 3. 代码块提取逻辑（MessageService.extractCodeBlocks）

解析 Agent 回复中的 Markdown 代码块:

```
正则可参考: /```(\w+)?(?::(\S+))?\n([\s\S]*?)```/g

文件名推断优先级:
  1. Agent 显式声明: ```tsx:src/components/TodoList.tsx → 用声明文件名
  2. 自动推断:
     tsx/jsx  → Component_{N}.tsx
     ts/js    → module_{N}.ts
     py       → module_{N}.py
     css/scss → style_{N}.css
     html     → page_{N}.html
     其他     → file_{N}.{ext}
  N = 该会话中同语言的递增计数器
```

---

## 4. ReviewService（骨架，完整实现在 M3 做）

本次只需写入 `code_reviews` 表的基本方法:
- `createReview(projectId, taskId, messageId, reviewerId)`: 插入 PENDING 状态
- `getReviewByMessageId(messageId)`: 查审核状态

Agent 消息生成后自动调用 createReview（由 MessageService 或 WebSocket handler 触发）。

---

## 验收标准

- [ ] 创建 DIRECT 会话 → 自动添加用户+Agent 为成员
- [ ] 创建 GROUP 会话 → 可勾选多个 Agent
- [ ] 会话列表按更新时间降序，含最后消息摘要
- [ ] 消息历史游标分页正确（首次最新 50 条，翻页不重复/不漏）
- [ ] 非成员访问会话消息返回 403
- [ ] 代码块提取：含文件名的代码块正确解析
- [ ] 删除会话后消息和成员一并清理
