# Batch 6: 前端 P0（认证 + WebSocket + 流式渲染 + Provider 设置）

**依赖**: Batch 2（Java Auth/Provider/Agent API） + Batch 4（Java WebSocket）
**产出**: 可注册登录、配置 Provider、创建单聊、发送消息并看到 Agent 流式回复的前端

---

## 1. 现状

已有文件:
- `App.tsx` — 静态 UI 骨架（SessionList + ChatArea + WorkspacePanel 组件都在一个文件里）
- `shared/config.ts` — apiUrl / wsUrl 解析 ✅
- `shared/types.ts` — 类型定义 ✅
- `shared/api.ts` — GET-only REST 封装（无 POST/PUT/DELETE，无 auth header）
- `main.tsx` — 入口

**需要**:
1. 把 App.tsx 按模块拆分为独立文件
2. 补充 auth（登录/注册/Token 持久化）
3. 补充 WebSocket Client
4. 补充流式渲染
5. 补充 Provider 设置页
6. 补充路由
7. 完善 api.ts

---

## 2. 目标文件结构

```
frontend/src/
├── auth/
│   ├── AuthContext.tsx       # JWT 状态管理 (useAuth hook)
│   ├── LoginPage.tsx         # 登录页
│   └── RegisterPage.tsx      # 注册页
├── chat/
│   ├── ChatArea.tsx          # 消息列表容器
│   ├── MessageBubble.tsx     # 单条消息气泡
│   ├── MessageInput.tsx      # 输入框（Enter 发送，Shift+Enter 换行）
│   └── StreamRenderer.tsx    # 流式 token 逐字追加
├── session/
│   ├── SessionList.tsx       # 左侧会话列表
│   └── CreateSession.tsx     # 创建单聊/群聊弹窗
├── workspace/
│   └── WorkspacePanel.tsx    # 右侧工程面板（从 App.tsx 迁出，功能不变）
├── settings/
│   ├── SettingsPage.tsx      # 设置页容器
│   └── ProviderConfig.tsx    # Provider 添加/编辑/删除表单
├── shared/
│   ├── WebSocketClient.ts    # WS 连接管理（auth.init + 心跳 + 自动重连）
│   ├── api.ts                # REST API 封装（补充 auth header + POST/PUT/DELETE）
│   ├── config.ts             # 不变 ✅
│   └── types.ts              # 不变 ✅
└── App.tsx                   # 路由 + 顶层布局（精简后）
```

---

## 3. 路由设计（App.tsx）

使用 `react-router-dom` 实现 SPA 路由:

```
/login          → LoginPage
/register       → RegisterPage
/settings       → SettingsPage（需登录）
/               → 主 IM 页面（需登录，三栏布局）
/session/:id    → 主 IM 页面 + 选中某会话
```

**路由守卫**: 非登录/注册页面 → 检查 token 是否存在 → 不存在则 redirect `/login`

**主 IM 页面**: 从现有 App.tsx 的三栏布局迁移，保持 SessionList + ChatArea + WorkspacePanel 结构。

---

## 4. auth/AuthContext.tsx — 认证状态管理

```tsx
type AuthState = {
  token: string | null;
  user: UserInfo | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
};

// token 持久化: localStorage.setItem("agenthub_token", token)
// 初始化: 从 localStorage 读 token，调 GET /api/users/me 恢复 user
// login: POST /api/auth/login → 存 token + user → 跳转 /
// register: POST /api/auth/register → 存 token + user → 跳转 /
// logout: 清 localStorage + setState(null)
```

**UserInfo 类型**（新增到 types.ts）:
```ts
type UserInfo = { id: string; username: string; displayName?: string; avatarUrl?: string };
```

---

## 5. auth/LoginPage.tsx — 登录页

```
布局: 居中卡片
  - Logo + "AgentHub" 标题
  - username input (2-20 字符)
  - password input (6-100 字符)
  - "登录" 按钮
  - 底部 "没有账号？去注册" 链接 → /register
  - 错误提示（用户名不存在 / 密码错误 / 网络错误）
```

---

## 6. auth/RegisterPage.tsx — 注册页

```
布局: 与 LoginPage 一致
  - username input + password input
  - "注册" 按钮
  - 底部 "已有账号？去登录" 链接 → /login
```

---

## 7. shared/api.ts — 完善 REST 封装

在现有基础上补充:

```ts
// Token 辅助
const getToken = () => localStorage.getItem("agenthub_token");

// request 方法增加 auth header + 支持 POST/PUT/DELETE
const request = async <T>(
  path: string,
  options?: { method?: string; body?: unknown; query?: Record<string, string | number | undefined> }
) => {
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  if (options?.body) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(buildUrl(path, options?.query), {
    method: options?.method || "GET",
    headers,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  return unwrap<T>(response);
};

// 新增方法
export const agentHubApi = {
  // 认证
  register: (body: RegisterRequest) => request<AuthResponse>("/auth/register", { method: "POST", body }),
  login: (body: LoginRequest) => request<AuthResponse>("/auth/login", { method: "POST", body }),
  getMe: () => request<UserResponse>("/users/me"),

  // Provider
  getProviders: () => request<ProviderResponse[]>("/providers"),
  createProvider: (body: ProviderRequest) => request<ProviderResponse>("/providers", { method: "POST", body }),
  updateProvider: (id: string, body: Partial<ProviderRequest>) =>
    request<ProviderResponse>(`/providers/${encodeURIComponent(id)}`, { method: "PUT", body }),
  deleteProvider: (id: string) => request<void>(`/providers/${encodeURIComponent(id)}`, { method: "DELETE" }),

  // Agent（已有）
  getAgents: () => request<AgentResponse[]>("/agents"),
  getAgentProvider: (agentId: string) => request<{ providerId: string; providerName: string } | null>(
    `/agents/${encodeURIComponent(agentId)}/provider`
  ),
  setAgentProvider: (agentId: string, providerId: string) =>
    request<void>(`/agents/${encodeURIComponent(agentId)}/provider`, { method: "PUT", body: { providerId } }),
  deleteAgentProvider: (agentId: string) =>
    request<void>(`/agents/${encodeURIComponent(agentId)}/provider`, { method: "DELETE" }),

  // 会话（已有 GET，补充 POST/DELETE/成员管理）
  getSessions: () => request<SessionResponse[]>("/sessions"),
  createSession: (body: CreateSessionRequest) => request<SessionResponse>("/sessions", { method: "POST", body }),
  deleteSession: (id: string) => request<void>(`/sessions/${encodeURIComponent(id)}`, { method: "DELETE" }),
  getSessionMembers: (sessionId: string) => request<SessionMemberResponse[]>(
    `/sessions/${encodeURIComponent(sessionId)}/members`
  ),
  addSessionMembers: (sessionId: string, agentIds: string[]) =>
    request<SessionMemberResponse[]>(`/sessions/${encodeURIComponent(sessionId)}/members`, {
      method: "POST",
      body: { agentIds },
    }),
  removeSessionMember: (sessionId: string, memberId: string) =>
    request<void>(`/sessions/${encodeURIComponent(sessionId)}/members/${encodeURIComponent(memberId)}`, {
      method: "DELETE",
    }),

  // 消息
  getMessages: (sessionId: string, query?: MessagePageQuery) =>
    request<MessageResponse[]>(`/sessions/${encodeURIComponent(sessionId)}/messages`, { query }),
};
```

---

## 8. shared/WebSocketClient.ts — WebSocket 连接管理

```ts
class WebSocketClient {
  private ws: WebSocket | null = null;
  private token: string;
  private messageHandlers: Map<string, (payload: any) => void> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectDelay = 30000;

  constructor(token: string) { this.token = token; }

  connect(): void {
    // 1. new WebSocket(wsUrl)
    // 2. onopen → 发送 auth.init: { type: "auth.init", payload: { token } }
    // 3. onmessage → 解析 JSON → 根据 type 分发给 handlers
    //    - chat.stream → token 追加
    //    - chat.message → 完整消息
    //    - chat.actions → Diff/预览按钮数据
    //    - chat.error → 错误提示
    //    - chat.system → 系统通知
    // 4. onclose → 非正常关闭则重连
    // 5. onerror → 记录日志

  reconnect(): void {
    // 指数退避: delay = min(1000 * 2^attempts, 30000)
    // setTimeout → connect() → reconnectAttempts++
    // 连接成功后 reset reconnectAttempts = 0
  }

  send(type: string, payload: any): void {
    // JSON.stringify({ type, payload }) → ws.send()
  }

  on(type: string, handler: (payload: any) => void): void {
    // 注册消息处理器
  }

  off(type: string): void {
    // 移除处理器
  }

  // 心跳: 每 30s 发 ping，60s 无响应视为断线
  disconnect(): void {
    // 正常关闭（不触发重连）
  }
}
```

**关键约束**:
- 单例模式：整个应用只维护一个 WebSocket 连接
- Token 过期 (4001) → 清 localStorage + 跳转登录页
- 组件 unmount 时取消订阅对应的 handler（避免内存泄漏）

---

## 9. chat/StreamRenderer.tsx — 流式渲染

```
职责：管理流式消息的"打字效果"

状态管理:
  - streamingMessages: Map<messageId, { content, isComplete }>

工作流程:
  1. WebSocketClient.on("chat.stream", ({ messageId, token, isComplete }) => {
       // 若是新 messageId → 创建空消息气泡
       // token 追加到对应 message 的 content
       // isComplete → 标记完成，触发代码块渲染
     })
  2. 渲染:
     - 未完成的: 显示打字光标 BlinkingCursor
     - 完成的: 去掉光标，显示完整内容 + Markdown
```

**注意**: 流式消息是增量的，前端维护一个 `streamingContent` state，每次 token 来就 append。完成后用 `agent:results` 的完整内容校正（兜底 Pub/Sub 丢包）。

---

## 10. chat/MessageInput.tsx — 消息发送

从 App.tsx 的 ChatArea 中拆出:

```
- textarea（Enter 发送，Shift+Enter 换行）
- disabled 当无选中会话
- 发送按钮
- @mention 快捷按钮（从 SessionList 获取 Agent 列表）
- 发送逻辑:
    1. 通过 WebSocketClient.send("chat.send", { sessionId, content, mentions })
    2. 清空输入框
    3. 乐观更新：本地先显示用户消息气泡
```

**单聊/群聊区别**:
- 单聊: mentions 为空数组或不传，后端自动路由
- 群聊: 必须带 mentions，从 Agent 列表中选择

---

## 11. settings/ProviderConfig.tsx — Provider 配置

```
功能:
  - Provider 列表（GET /api/providers）
  - 添加 Provider（表单: type 下拉, apiKey, baseUrl 可选, defaultModel, isDefault 勾选）
  - 编辑 Provider（弹窗或内联编辑，apiKey 显示为 ****）
  - 删除 Provider（确认弹窗）
  - 设置默认 Provider（PUT，自动清旧默认）

UI:
  - 卡片列表，每个卡片显示: type 图标 + baseUrl + model + 默认标记
  - "添加 Provider" 按钮 → 弹出表单
  - 每行有编辑/删除按钮
  - isDefault Provider 高亮显示
```

---

## 12. settings/SettingsPage.tsx — 设置页

```
布局:
  - 顶栏: "设置" 标题 + 返回按钮 (→ /)
  - Tab 切换: [Provider 配置] [个人资料]（个人资料先占位）
  - Provider 配置 Tab → ProviderConfig 组件
```

---

## 13. 组件迁移说明

现有 `App.tsx` 中的组件需要迁移到独立文件:
- `SessionList` → `session/SessionList.tsx`
- `ChatArea` → `chat/ChatArea.tsx`（MessageInput 拆出）
- `ChatMessage` → `chat/MessageBubble.tsx`
- `TaskPlanCard` → 保留在 `App.tsx` 或迁到 `orchestrator/TaskPlanCard.tsx`
- `WorkspacePanel` → `workspace/WorkspacePanel.tsx`
- `EmptyState`, `SkeletonRows`, `StatusDot`, `LogoMark` → `shared/components.tsx`（可选）

**迁移时不需要改组件逻辑**，只拆分文件结构。功能性改动（WebSocket 发送/接收）在拆分后接入。

---

## 14. 安装依赖

```bash
npm install react-router-dom   # 路由
# 可选: react-markdown, @monaco-editor/react（代码块渲染和 Diff，P1 再装）
```

---

## 验收标准

- [ ] 注册 → 自动登录 → 跳转到主页面
- [ ] 登录 → 拿到 token → localStorage 持久化 → 刷新页面仍保持登录态
- [ ] 未登录访问 `/` → 重定向到 `/login`
- [ ] 设置页可添加/编辑/删除 Provider（OpenAI + Anthropic）
- [ ] 可创建 DIRECT 会话（选 Agent → 自动创建）
- [ ] 在单聊中输入消息 → Enter 发送 → WebSocket 发送成功
- [ ] Agent 回复的 token 逐字显示（打字效果）
- [ ] Agent 回复结束后显示完整消息
- [ ] WebSocket 断线 → 自动重连 → 重连后恢复
- [ ] Token 过期 → 跳转登录页
- [ ] 多会话切换 → 消息列表正确切换，不串数据
