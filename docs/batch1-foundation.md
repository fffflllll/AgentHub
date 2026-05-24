# Batch 1: Java 基础设施层

**依赖**: 无（数据库表已通过 Flyway 迁移创建）
**产出**: 所有 Model、Mapper、DTO、Enums、Auth 组件、Common 组件

---

## 1. Enums（`com.agenthub.enums`）

```
ProviderType: OPENAI, ANTHROPIC, CUSTOM
SessionType:  DIRECT, GROUP
MessageType:  TEXT, CODE, TASK_PLAN, SYSTEM
MemberType:   USER, AGENT
SenderType:   USER, AGENT, SYSTEM
TaskStatus:   PENDING, IN_PROGRESS, COMPLETED, FAILED, CANCELLED
```

---

## 2. Model（`com.agenthub.model`，纯 POJO，无 JPA 注解）

每张 V1 表对应一个 Model 类，字段名用 camelCase（MyBatis 已配置下划线转驼峰）：

| 类 | 对应表 | 关键字段 |
|---|--------|---------|
| User | users | id, username, passwordHash, displayName, avatarUrl, createdAt, updatedAt |
| UserProvider | user_providers | id, userId, providerType, apiKeyEnc, baseUrl, defaultModel, isDefault |
| Agent | agents | id, identifier, name, roleDesc, systemPrompt, defaultModel, agentMode, platformType |
| AgentProviderOverride | agent_provider_overrides | id, userId, agentId, providerId |
| Session | sessions | id, name, sessionType, ownerId, createdAt, updatedAt |
| SessionMember | session_members | id, sessionId, userId, agentId, memberType, joinedAt |
| Message | messages | id, sessionId, senderType, senderId, content, messageType, metadata, createdAt |
| MessageCodeBlock | message_code_blocks | id, messageId, language, fileName, codeContent, sortOrder |
| ProjectFile | project_files | id, sessionId(MVP = projectId), filePath, content, version, isDeleted |

构造方式: `CHAR(36)` UUID → `String` / `TINYINT(1)` → `Boolean` / `DATETIME` → `LocalDateTime` / `JSON` → `String`

---

## 3. Mapper（`com.agenthub.mapper`，纯 MyBatis 接口 + XML）

每个 Mapper 接口对应一张表，XML 放在 `resources/mapper/` 下同名文件。

| Mapper 接口 | 必选方法 |
|------------|---------|
| UserMapper | insert, findByUsername, findById, update |
| UserProviderMapper | insert, findByUserId, findById, update, deleteById, clearDefaultByUserId |
| AgentMapper | findAll, findById, findByIdentifier |
| AgentProviderOverrideMapper | insert, findByUserIdAndAgentId, deleteByUserIdAndAgentId, deleteByProviderId |
| SessionMapper | insert, findByOwnerIdOrderByUpdatedAt, findById, deleteById |
| SessionMemberMapper | insert, findBySessionId, deleteBySessionAndMember, existsBySessionUserAgent |
| MessageMapper | insert, findBySessionIdBeforeCursor (游标分页: `WHERE session_id=? AND created_at < ? ORDER BY created_at DESC LIMIT ?`) |
| MessageCodeBlockMapper | insertBatch, findByMessageId |
| ProjectFileMapper | upsert (INSERT ON DUPLICATE KEY UPDATE), findByProjectId, findByProjectIdAndPath, updateContentWithVersion (乐观锁: `UPDATE ... SET content=?, version=version+1 WHERE id=? AND version=?`) |

**约束**: 不使用 @Select/@Insert 等注解 SQL，所有 SQL 写在 XML 中。

---

## 4. DTO（`com.agenthub.dto`，与 Model 分离）

### request/

| 类 | 字段 | 校验 |
|---|------|------|
| RegisterRequest | username(2-20), password(6-100) | @NotBlank + @Size |
| LoginRequest | username, password | @NotBlank |
| UpdateUserRequest | displayName, avatarUrl | 均可空 |
| ProviderRequest | providerType(OPENAI\|ANTHROPIC\|CUSTOM), apiKey, baseUrl(可选), defaultModel, isDefault | @NotBlank 必填字段 |
| CreateSessionRequest | name, sessionType(DIRECT\|GROUP), agentIds[] | @NotBlank name, @NotEmpty agentIds |

### response/

| 类 | 字段 |
|---|------|
| AuthResponse | token, user:UserResponse |
| UserResponse | id, username, displayName, avatarUrl |
| ProviderResponse | id, providerType, baseUrl, defaultModel, isDefault（**不含 apiKey**） |
| SessionResponse | id, name, type, lastMessage, updatedAt |
| MessageResponse | id, senderType, senderId, senderName, content, type, createdAt, codeBlocks[], taskPlan |
| AgentResponse | id, identifier, name, roleDescription, defaultModel |

---

## 5. Auth 组件（`com.agenthub.auth`）

```
JwtTokenProvider
  - generateToken(userId): 签发 JWT，7天有效期，payload 含 userId
  - validateToken(token): 验证签名 + 过期，返回 userId 或抛异常
  - 从 application.yml 读取 agenthub.auth.jwt-secret

JwtAuthInterceptor (实现 HandlerInterceptor)
  - preHandle: 从 Authorization header 提取 Bearer token → 验证 → 设置 CurrentUser
  - 白名单路径: /api/auth/**, /api/health, /internal/**

CurrentUser
  - ThreadLocal 存储当前 userId，提供 static get()/set()/clear()
```

**规则**: 不使用 Spring Security，纯自研。

---

## 6. Common 组件（`com.agenthub.common`）

```
ApiResponse<T>
  - 统一响应: { code: 0, message: "ok", data: T }
  - 静态工厂: ApiResponse.success(T data) / ApiResponse.error(int code, String message)

GlobalExceptionHandler (@RestControllerAdvice)
  - 捕获: MethodArgumentNotValidException → 400
  - 捕获: 自定义 BusinessException(code, message) → 对应状态码
  - 捕获: Exception → 500

MentionParser
  - parse(content): 正则匹配 @xxx 提取 agent 名称列表
  - 本次 Batch 1 只需写出类骨架，具体实现 Batch 3 再补
```

---

## 验收标准

- [ ] `mvn compile` 通过
- [ ] 每个 Mapper 有对应 XML 且 SQL 语法正确
- [ ] DTO 不包含 Model 类引用（彻底分离）
- [ ] JwtTokenProvider 可签发和验证 token
- [ ] ApiResponse 格式符合 `{code, message, data}`
