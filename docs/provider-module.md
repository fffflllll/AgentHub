# Provider 配置模块详细说明

本文档按当前 `codex/provider-config` 分支代码整理 Provider 配置模块。若历史设计文档与代码不一致，以当前代码为准；未实现但已在规划中的能力会单独标注。

## 1. 模块状态

当前 M1.2 Provider 配置基础闭环已完成，状态为 REVIEW：

- Java 后端提供 `/api/providers` CRUD。
- Provider 归属于当前登录用户，接口全部走 JWT 鉴权。
- API Key 使用 AES-GCM 加密后写入 `user_providers.api_key_enc`。
- 返回给前端的 `ProviderResponse` 不包含 API Key 明文或密文。
- 支持 `OPENAI`、`ANTHROPIC`、`CUSTOM` 三种 Provider 类型。
- 第一个 Provider 自动成为默认 Provider。
- 设置某个 Provider 为默认时，会清理同一用户其他默认 Provider。
- 删除默认 Provider 后，如果还有其他 Provider，会自动挑一个替代默认 Provider。
- 前端工作台右上角设置按钮可打开 Provider 设置抽屉，支持列表、新增、编辑、删除。

当前未落地：

- Agent 级 Provider 覆盖：`GET/PUT/DELETE /api/agents/{id}/provider` 还未实现。
- 内部凭据解析接口：`/internal/providers/{id}/credentials:resolve` 还未实现。
- Provider 连通性测试按钮还未实现。
- Python AI 调 LLM 时解析 Provider 的流程还未实现。
- 前端还没有独立设置路由，当前是工作台内的设置抽屉。

## 2. 相关文件

| 类型 | 文件 |
| --- | --- |
| Controller | `backend-java/src/main/java/com/agenthub/controller/ProviderController.java` |
| Service | `backend-java/src/main/java/com/agenthub/service/ProviderService.java` |
| 加密工具 | `backend-java/src/main/java/com/agenthub/service/AesGcmSecretCodec.java` |
| Mapper 接口 | `backend-java/src/main/java/com/agenthub/mapper/UserProviderMapper.java` |
| Mapper XML | `backend-java/src/main/resources/mapper/UserProviderMapper.xml` |
| 数据模型 | `backend-java/src/main/java/com/agenthub/model/UserProvider.java` |
| 请求 DTO | `CreateProviderRequest.java`, `UpdateProviderRequest.java` |
| 响应 DTO | `ProviderResponse.java` |
| 数据库迁移 | `backend-java/src/main/resources/db/migration/V1__init_schema.sql` |
| 配置 | `backend-java/src/main/resources/application.yml`, `.env.example`, `docker-compose.yml` |
| 前端入口 | `frontend/src/App.tsx` 的 `SettingsPanel` |
| 前端 API | `frontend/src/shared/api.ts` |
| 前端类型 | `frontend/src/shared/types.ts` |
| 进度记录 | `process.md` |

## 3. 数据库结构

Provider 使用 `user_providers` 表，迁移已在 `V1__init_schema.sql` 中存在，没有在本模块新增迁移。

核心字段：

| 字段 | 说明 |
| --- | --- |
| `id` | Provider ID，UUID 字符串 |
| `user_id` | 所属用户，外键到 `users.id` |
| `provider_type` | `OPENAI` / `ANTHROPIC` / `CUSTOM` |
| `api_key_enc` | AES-GCM 加密后的 API Key |
| `base_url` | 自定义接口地址，可为空 |
| `default_model` | 默认模型名 |
| `is_default` | 是否为当前用户默认 Provider |
| `created_at` / `updated_at` | 创建和更新时间 |

关键约束：

- `fk_user_providers_user`：用户删除后级联删除 Provider。
- `idx_providers_user_id`：按用户查询 Provider。
- `idx_providers_user_default`：通过函数索引保证同一用户最多一个默认 Provider。

注意：当前代码保证“最多一个默认 Provider”，并在创建第一个 Provider、设置默认、删除默认时维护默认值。后续如果做更严格策略，可以禁止用户把唯一默认 Provider 改成非默认。

## 4. 后端接口

所有 `/api/providers` 接口都需要登录。认证由 `JwtAuthInterceptor` 负责，用户 ID 通过 `CurrentUser.get()` 读取。

### 4.1 查询 Provider 列表

```http
GET /api/providers
Authorization: Bearer <jwt>
```

成功响应：

```json
{
  "code": 0,
  "message": "ok",
  "data": [
    {
      "id": "provider-id",
      "providerType": "OPENAI",
      "baseUrl": null,
      "defaultModel": "gpt-4o",
      "isDefault": true,
      "createdAt": "2026-05-25T23:00:00",
      "updatedAt": "2026-05-25T23:00:00"
    }
  ]
}
```

处理逻辑：

1. `ProviderController.listProviders()` 接收请求。
2. `ProviderService.listCurrentUserProviders()` 读取当前用户 ID。
3. `UserProviderMapper.findByUserId(userId)` 查询当前用户的 Provider。
4. 按 `is_default DESC, updated_at DESC` 排序。
5. 映射为 `ProviderResponse`，不包含 `apiKeyEnc`。

### 4.2 新增 Provider

```http
POST /api/providers
Authorization: Bearer <jwt>
Content-Type: application/json
```

请求体：

```json
{
  "providerType": "OPENAI",
  "apiKey": "sk-xxx",
  "baseUrl": null,
  "defaultModel": "gpt-4o",
  "isDefault": true
}
```

字段规则：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `providerType` | 是 | 支持 `OPENAI`、`ANTHROPIC`、`CUSTOM` |
| `apiKey` | 是 | 只用于写入，后端不会回显 |
| `baseUrl` | 否 | Custom 或 OpenAI-compatible 服务可填写 |
| `defaultModel` | 是 | 默认模型名 |
| `isDefault` | 否 | 为 `true` 时设为默认；第一个 Provider 自动默认 |

处理逻辑：

1. `CreateProviderRequest` 使用 Bean Validation 做基础校验。
2. `ProviderService.createProvider()` 读取当前用户 ID。
3. 标准化 `providerType`：转大写，只允许三种已支持类型。
4. 如果 `isDefault=true`，或当前用户还没有任何 Provider，则先调用 `clearDefaults(userId)`。
5. 使用 `AesGcmSecretCodec.encrypt(apiKey)` 加密 API Key。
6. 写入 `user_providers`。
7. 重新查询 Provider 并返回 `ProviderResponse`。

### 4.3 更新 Provider

```http
PUT /api/providers/{id}
Authorization: Bearer <jwt>
Content-Type: application/json
```

请求体示例：

```json
{
  "providerType": "ANTHROPIC",
  "apiKey": "sk-ant-xxx",
  "baseUrl": null,
  "defaultModel": "claude-sonnet-4-20250514",
  "isDefault": true
}
```

处理逻辑：

1. `ProviderService.updateProvider(id, request)` 先用 `findByIdAndUserId(id, userId)` 校验 Provider 属于当前用户。
2. `providerType` 非空时重新校验并更新。
3. `apiKey` 非空且非空白时才重新加密更新；空字符串表示保留旧 Key。
4. `baseUrl` 传入空字符串时会被标准化为 `null`。
5. `defaultModel` 非空时更新。
6. `isDefault=true` 时清理其他默认 Provider，并将当前 Provider 标记为默认。
7. 保存后重新查询并返回 `ProviderResponse`。

### 4.4 删除 Provider

```http
DELETE /api/providers/{id}
Authorization: Bearer <jwt>
```

成功响应：

```http
204 No Content
```

处理逻辑：

1. 先确认 Provider 属于当前用户。
2. 删除该 Provider。
3. 如果被删除的是默认 Provider，且当前用户还有其他 Provider，则自动把最近更新的 Provider 标记为默认。

## 5. 加密实现

加密类：`AesGcmSecretCodec`

当前格式：

```text
v1:<base64 nonce>:<base64 ciphertext+tag>
```

实现细节：

- 算法：`AES/GCM/NoPadding`
- nonce 长度：12 bytes
- tag 长度：128 bits
- 每次加密都会生成新的随机 nonce。
- 配置项：`agenthub.auth.aes-key`
- 环境变量：`AES_KEY`

密钥派生规则：

1. 如果 `AES_KEY` 是合法 base64，且解码后正好 32 bytes，则直接作为 AES-256 key。
2. 否则对配置值做 SHA-256 digest，得到 32 bytes key。

重要注意：

- 生产环境必须设置稳定、高熵的 `AES_KEY`。
- 一旦 `AES_KEY` 改变，历史保存的 `api_key_enc` 将无法解密。
- 当前列表和详情接口不返回密钥，所以前端编辑时 API Key 输入框显示为空；留空代表保留旧 Key。

## 6. 前端实现

当前 Provider 前端集成在 `frontend/src/App.tsx` 的 `SettingsPanel` 组件中。

入口：

- 登录后进入工作台。
- 点击聊天区右上角的设置按钮。
- 打开右侧设置抽屉。
- 抽屉内展示 Provider 列表和 Provider 表单。

前端类型位于 `frontend/src/shared/types.ts`：

- `ProviderType`
- `ProviderResponse`
- `CreateProviderRequest`
- `UpdateProviderRequest`

前端 API 位于 `frontend/src/shared/api.ts`：

```ts
getProviders()
createProvider(body)
updateProvider(id, body)
deleteProvider(id)
```

`SettingsPanel` 内部状态：

| 状态 | 说明 |
| --- | --- |
| `providers` | 当前用户 Provider 列表 |
| `form` | 表单值，包括类型、API Key、Base URL、默认模型、是否默认 |
| `editingId` | 当前正在编辑的 Provider ID，`null` 表示新增 |
| `loading` | 列表加载状态 |
| `saving` | 保存或删除状态 |
| `error` | 接口错误提示 |

交互规则：

- 打开设置抽屉时调用 `getProviders()`。
- 点击“新增”会重置表单。
- 点击编辑图标会把 Provider 的类型、Base URL、默认模型、默认状态带入表单。
- 编辑时 API Key 不会回填；用户留空则后端保留旧 Key。
- 新增时 API Key 必填。
- 删除前使用浏览器 `confirm()` 做一次确认。
- 保存成功后重新加载 Provider 列表。

默认模型前端预填：

| Provider | 默认模型 |
| --- | --- |
| `OPENAI` | `gpt-4o` |
| `ANTHROPIC` | `claude-sonnet-4-20250514` |
| `CUSTOM` | `gpt-4o` |

## 7. 本地调试流程

### 7.1 启动服务

根目录执行：

```bash
docker compose up --build
```

默认地址：

| 服务 | URL |
| --- | --- |
| 前端 | `http://localhost:3000` |
| Java API 代理 | `http://localhost:3000/api` |
| Java API 直连 | `http://localhost:18080/api` |

### 7.2 浏览器验证

1. 打开 `http://localhost:3000`。
2. 注册或登录。
3. 进入工作台。
4. 点击右上角设置按钮。
5. 新增 OpenAI 或 Anthropic Provider。
6. 检查列表中不会显示 API Key。
7. 编辑 Provider，留空 API Key 保存，确认旧 Key 不会被清空。
8. 新增第二个 Provider 并设为默认，确认列表中默认标记切换。
9. 删除默认 Provider，确认另一个 Provider 自动变成默认。

### 7.3 curl 验证

先登录拿 token：

```bash
curl -s http://localhost:18080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"demo","password":"abc12345"}'
```

新增 Provider：

```bash
curl -s http://localhost:18080/api/providers \
  -H "Authorization: Bearer <token>" \
  -H 'Content-Type: application/json' \
  -d '{"providerType":"OPENAI","apiKey":"sk-test","defaultModel":"gpt-4o","isDefault":true}'
```

查询 Provider：

```bash
curl -s http://localhost:18080/api/providers \
  -H "Authorization: Bearer <token>"
```

检查点：

- 响应中不应出现 `apiKey` 或 `apiKeyEnc`。
- 数据库 `user_providers.api_key_enc` 应为 `v1:` 开头的密文。

## 8. 验证记录

本模块已执行：

```bash
cd backend-java && mvn test
cd frontend && npm run build
```

结果：

- Java 编译通过；当前无测试源。
- 前端 TypeScript 和 Vite build 通过。

## 9. 常见问题

### 9.1 为什么编辑 Provider 时 API Key 不回显？

这是刻意设计。API Key 只在创建或用户主动填写新值时发送给后端。后端响应体只包含非敏感配置，避免密钥进入浏览器状态、日志或截图。

### 9.2 为什么 API Key 加密后仍然需要保护数据库？

AES-GCM 可以降低数据库泄露时的明文风险，但如果攻击者同时拿到数据库和 `AES_KEY`，仍然能解密。生产环境需要保护环境变量、日志、备份和部署平台密钥。

### 9.3 默认 Provider 和 Agent Provider 覆盖是什么关系？

当前只完成默认 Provider。后续 Agent 调用模型时应按下面顺序解析：

1. 查 `agent_provider_overrides(user_id, agent_id)`。
2. 如果存在覆盖，使用覆盖 Provider。
3. 如果不存在覆盖，使用 `user_providers.is_default = 1` 的默认 Provider。
4. Python 执行任务前通过 Java 内部接口临时解析 API Key。

### 9.4 为什么 Provider 模块还不能直接发起 LLM 对话？

Provider 只是模型凭据配置。完整单 Agent 对话还需要：

- 会话和消息持久化。
- WebSocket `chat.send` / `chat.message` / `chat.stream`。
- Java 发布 `agent:tasks` Redis Stream。
- Python 消费任务、解析凭据、调用 LLM。
- Java 把 Python 返回的 token 流转发给前端。

这些属于 M2 单 Agent 流式对话闭环。

## 10. 后续建议

建议按下面顺序继续：

1. 增加 Provider 连通性测试接口和前端测试按钮。
2. 实现 Agent Provider 覆盖接口和前端 Agent 设置入口。
3. 实现内部凭据解析接口，供 Python AI 服务按 task/session/agent 归属校验后读取 API Key。
4. 进入 M2.1，会话与消息基础：创建单聊、成员、消息历史。
5. 进入 M2.2/M2.3，WebSocket 和 LLM 流式闭环。

## 11. 接手检查清单

接手该模块时优先检查：

- `.env` 或部署环境是否设置稳定的 `AES_KEY`。
- `/api/providers` 是否被 JWT 拦截器保护。
- `ProviderResponse` 是否仍然不包含任何密钥字段。
- `user_providers` 默认 Provider 唯一索引是否在目标 MySQL 版本正常执行。
- 前端编辑 Provider 时是否仍然保持“API Key 留空即不更新”的语义。
- 后续实现内部凭据解析接口时，不要把明文 API Key 写入 Redis Stream、日志或前端响应。
