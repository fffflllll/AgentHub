# Batch 2: Java 用户与配置 API

**依赖**: Batch 1（Model, Mapper, DTO, Auth, Common 全部完成）
**产出**: 可注册登录、配置 Provider 的 REST API

---

## 1. AuthController + AuthService（`POST /api/auth/*`，白名单，无需鉴权）

```
POST /api/auth/register
  Request:  { username, password }
  逻辑:
    1. 检查 username 唯一（UserMapper.findByUsername）
    2. password → BCrypt 加密
    3. UserMapper.insert → 生成 UUID userId
    4. JwtTokenProvider.generateToken(userId)
  返回:     { token, user: UserResponse }

POST /api/auth/login
  Request:  { username, password }
  逻辑:
    1. UserMapper.findByUsername → 不存在返回 401
    2. BCrypt 比对密码 → 不匹配返回 401
    3. JwtTokenProvider.generateToken
  返回:     { token, user: UserResponse }
```

**关键细节**:
- BCrypt 使用 Spring 的 `BCryptPasswordEncoder`（或直接 `org.mindrot.jbcrypt.BCrypt`）
- AuthController 在白名单中，不经过 JwtAuthInterceptor

---

## 2. UserController + UserService（需要鉴权）

```
GET /api/users/me
  从 CurrentUser.get() 拿 userId → UserMapper.findById → UserResponse
  （passwordHash、apiKeyEnc 等敏感字段绝不出现在 UserResponse 中）

PUT /api/users/me
  Request:  { displayName?, avatarUrl? }
  更新当前用户的显示名称和头像
```

---

## 3. ProviderController + ProviderService（需要鉴权）

```
GET /api/providers
  查当前用户的所有 Provider → List<ProviderResponse>
  ProviderResponse 不含 apiKey，前端用 **** 占位

POST /api/providers
  Request:  { providerType, apiKey, baseUrl?, defaultModel, isDefault? }
  逻辑:
    1. apiKey 用 AES-256-GCM 加密 → apiKeyEnc
    2. UserProviderMapper.insert
    3. 若 isDefault=true → 先 clearDefaultByUserId（保证只有一个默认）
  返回:     ProviderResponse（不含 apiKey）

PUT /api/providers/{id}
  校验 provider 属于当前用户
  若传了 apiKey → 重新 AES 加密
  isDefault 变更同理需要 clearDefault

DELETE /api/providers/{id}
  校验归属 → 删除
```

**AES-256-GCM 加密**:
- 密钥从 `agenthub.auth.aes-key` 读取
- 密文需要包含 nonce（12 bytes），格式: `base64(nonce + ciphertext)`
- ProviderService 提供 `encrypt(plaintext)` 和 `decrypt(ciphertext)` 内部方法

**关键约束**: Provider 的 GET/PUT/DELETE 都要校验 `provider.userId == currentUserId`

---

## 4. AgentController + AgentService（需要鉴权）

```
GET /api/agents
  查所有 Agent → List<AgentResponse>

GET /api/agents/{id}/provider
  查该用户对该 Agent 有无覆盖 → 返回 { providerId, providerName } 或 null

PUT /api/agents/{id}/provider
  Request:  { providerId }
  校验 providerId 属于当前用户
  → AgentProviderOverrideMapper.insert（覆盖已有则 UPDATE）

DELETE /api/agents/{id}/provider
  取消覆盖，恢复使用默认 Provider
```

**AgentService.resolveProvider(agentId, userId) 的查找逻辑**:
1. 查 `agent_provider_overrides(user_id, agent_id)` → 有则用指定的 Provider
2. 无覆盖 → 用 `user_providers.is_default = 1` 的那个 Provider
3. 找到后返回 (providerId, providerType, model, baseUrl)
4. 若都找不到 → 抛异常 "请先配置 Provider"

---

## 验收标准

- [ ] `POST /api/auth/register` 创建用户并返回 JWT
- [ ] `POST /api/auth/login` 验证密码并返回 JWT
- [ ] 未带 Token 访问 `/api/users/me` 返回 401
- [ ] Provider 的 CRUD 完整，API Key 不出现在返回体中
- [ ] 设置多个 isDefault 时旧默认被清除
- [ ] Agent 列表正确返回 5 个预置 Agent
- [ ] `resolveProvider` 覆盖逻辑正确：先查覆盖 → 回退默认
- [ ] curl 测试所有接口可用
