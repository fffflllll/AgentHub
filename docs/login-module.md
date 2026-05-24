# 登录模块详细说明

本文档按当前本地代码实现整理登录模块。若历史设计文档与代码不一致，以代码为准；未实现但已在规划中出现的能力会单独标注。

## 1. 模块边界

当前已落地的是 Java 后端最小认证闭环：

- 用户注册：`POST /api/auth/register`
- 用户登录：`POST /api/auth/login`
- 当前用户：`GET /api/users/me`
- JWT 签发与校验：`JwtTokenProvider`
- HTTP API 鉴权拦截：`JwtAuthInterceptor`
- 当前用户上下文：`CurrentUser`
- 用户表与 MyBatis Mapper：`users` / `UserMapper`
- 前端登录页、注册页、`AuthContext`、token 持久化和路由守卫

当前未落地：

- `PUT /api/users/me`
- WebSocket `auth.init` 首包鉴权
- Spring Security 集成；项目明确使用自研轻量 JWT，不引入 Spring Security

## 2. 相关文件

| 类型 | 文件 |
| --- | --- |
| Controller | `backend-java/src/main/java/com/agenthub/controller/AuthController.java`, `UserController.java` |
| Service | `backend-java/src/main/java/com/agenthub/service/AuthService.java`, `UserService.java` |
| JWT | `backend-java/src/main/java/com/agenthub/auth/JwtTokenProvider.java` |
| HTTP 拦截器 | `backend-java/src/main/java/com/agenthub/auth/JwtAuthInterceptor.java` |
| 当前用户上下文 | `backend-java/src/main/java/com/agenthub/auth/CurrentUser.java` |
| MVC 配置 | `backend-java/src/main/java/com/agenthub/config/WebMvcConfig.java` |
| 请求 DTO | `backend-java/src/main/java/com/agenthub/dto/request/LoginRequest.java`, `RegisterRequest.java` |
| 响应 DTO | `backend-java/src/main/java/com/agenthub/dto/response/AuthResponse.java`, `UserResponse.java` |
| 用户模型 | `backend-java/src/main/java/com/agenthub/model/User.java` |
| 用户 Mapper | `backend-java/src/main/java/com/agenthub/mapper/UserMapper.java`, `backend-java/src/main/resources/mapper/UserMapper.xml` |
| 数据库迁移 | `backend-java/src/main/resources/db/migration/V1__init_schema.sql` |
| 配置 | `backend-java/src/main/resources/application.yml`, `docker-compose.yml` |
| 统一异常 | `backend-java/src/main/java/com/agenthub/common/GlobalExceptionHandler.java`, `BusinessException.java`, `ApiResponse.java` |
| 前端认证上下文 | `frontend/src/auth/AuthContext.tsx` |
| 前端登录/注册页 | `frontend/src/auth/AuthPages.tsx` |
| 前端 API 封装 | `frontend/src/shared/api.ts` |
| 前端类型 | `frontend/src/shared/types.ts` |
| 前端路由守卫入口 | `frontend/src/App.tsx` |

## 3. 技术选型

- Web 框架：Spring Boot 3.3.5
- Java：21
- 数据访问：MyBatis 3.0.4，不使用 JPA
- 数据库：MySQL 8.0，Flyway 管理迁移
- 密码哈希：`org.mindrot.jbcrypt.BCrypt`
- JWT：`com.auth0:java-jwt:4.4.0`
- 参数校验：`spring-boot-starter-validation`
- 鉴权方式：MVC `HandlerInterceptor` + 自研 JWT

## 4. API 总览

### 4.1 注册

```http
POST /api/auth/register
Content-Type: application/json
```

请求体：

```json
{
  "username": "demo",
  "password": "abc12345"
}
```

成功响应：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "token": "<jwt>",
    "user": {
      "id": "<uuid>",
      "username": "demo",
      "displayName": "demo",
      "avatarUrl": null
    }
  }
}
```

处理逻辑：

1. `AuthController.register()` 接收 `RegisterRequest`，使用 `@Valid` 触发 Bean Validation。
2. `AuthService.register()` 对 `username` 执行 `trim()`。
3. 调用 `UserMapper.findByUsername(username)` 检查用户名是否已存在。
4. 若已存在，抛出 `BusinessException(HttpStatus.CONFLICT, 40901, "username already exists")`。
5. 创建 `User`：
   - `id`：`UUID.randomUUID().toString()`
   - `username`：trim 后用户名
   - `passwordHash`：`BCrypt.hashpw(password, BCrypt.gensalt())`
   - `displayName`：默认等于用户名
   - `avatarUrl`：未设置，默认为 `null`
6. 调用 `UserMapper.insert(user)` 写入 `users` 表。
7. 调用 `JwtTokenProvider.generateToken(user.getId())` 签发 JWT。
8. 返回 `AuthResponse(token, UserResponse.from(user))`。

### 4.2 登录

```http
POST /api/auth/login
Content-Type: application/json
```

请求体：

```json
{
  "username": "demo",
  "password": "abc12345"
}
```

成功响应与注册一致，返回新的 JWT 和用户公开信息。

处理逻辑：

1. `AuthController.login()` 接收 `LoginRequest`，使用 `@Valid` 触发 Bean Validation。
2. `AuthService.login()` 对 `username` 执行 `trim()`。
3. 调用 `UserMapper.findByUsername(username)` 查询用户。
4. 用户不存在时，抛出 `BusinessException(HttpStatus.UNAUTHORIZED, 40101, "invalid username or password")`。
5. 用户存在时，调用 `BCrypt.checkpw(request.password(), user.getPasswordHash())` 校验密码。
6. 密码错误时，同样返回 40101，避免泄露“用户名存在但密码错误”的区分信息。
7. 密码正确后调用 `JwtTokenProvider.generateToken(user.getId())` 签发 JWT。
8. 返回 `AuthResponse(token, UserResponse.from(user))`。

### 4.3 当前用户

```http
GET /api/users/me
Authorization: Bearer <jwt>
```

成功响应：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": "<uuid>",
    "username": "demo",
    "displayName": "demo",
    "avatarUrl": null
  }
}
```

处理逻辑：

1. 该接口位于 `/api/users/**`，不在白名单中，必须先经过 `JwtAuthInterceptor`。
2. 拦截器校验 `Authorization: Bearer <jwt>`，成功后把 `userId` 写入 `CurrentUser`。
3. `UserController.me()` 调用 `UserService.getCurrentUser()`。
4. `UserService` 从 `CurrentUser.get()` 读取当前用户 ID。
5. 如果上下文为空，返回 401 / code 401 / `unauthorized`。
6. 调用 `UserMapper.findById(userId)` 查询用户。
7. 用户不存在时，返回 404 / code 40401 / `user not found`。
8. 成功时返回 `UserResponse`，不包含 `passwordHash`。

## 5. 请求参数校验

### 5.1 `RegisterRequest`

| 字段 | 规则 |
| --- | --- |
| `username` | `@NotBlank`, 长度 2 到 20 |
| `password` | `@NotBlank`, 长度 8 到 100 |
| `password` | 必须同时包含至少一个字母和至少一个数字，正则为 `^(?=.*[A-Za-z])(?=.*\\d).+$` |

### 5.2 `LoginRequest`

| 字段 | 规则 |
| --- | --- |
| `username` | `@NotBlank`, 长度 2 到 20 |
| `password` | `@NotBlank`, 长度 8 到 100 |

登录不强制密码必须包含字母和数字，因为已有用户的密码策略可能随版本变化；当前注册才应用复杂度规则。

## 6. 响应模型

### 6.1 统一响应 `ApiResponse<T>`

成功：

```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

失败：

```json
{
  "code": 40101,
  "message": "invalid username or password",
  "data": null
}
```

### 6.2 `AuthResponse`

| 字段 | 说明 |
| --- | --- |
| `token` | JWT 字符串 |
| `user` | `UserResponse`，只包含可公开用户信息 |

### 6.3 `UserResponse`

| 字段 | 来源 |
| --- | --- |
| `id` | `users.id` |
| `username` | `users.username` |
| `displayName` | `users.display_name` |
| `avatarUrl` | `users.avatar_url` |

`passwordHash`、创建时间、更新时间均不会出现在登录响应中。

## 7. 错误码与 HTTP 状态

| 场景 | HTTP 状态 | 业务 code | message |
| --- | --- | --- | --- |
| 注册用户名已存在 | 409 | 40901 | `username already exists` |
| 用户名或密码错误 | 401 | 40101 | `invalid username or password` |
| token 有效但用户不存在 | 404 | 40401 | `user not found` |
| Bean Validation 失败 | 400 | 400 | 由字段错误拼接，例如 `password size must be between 8 and 100` |
| 未携带 Bearer token 访问受保护 `/api/**` | 401 | 401 | `unauthorized` |
| Bearer token 无效或过期 | 401 | 401 | `unauthorized` |
| 未捕获异常 | 500 | 500 | `internal server error` |

`GlobalExceptionHandler` 统一处理 `BusinessException`、`MethodArgumentNotValidException` 和其他异常。`JwtAuthInterceptor` 内部直接写 401 响应，不经过 `BusinessException`。

## 8. JWT 细节

`JwtTokenProvider` 负责签发和校验 JWT。

签发内容：

- 算法：HMAC SHA-256，即 `Algorithm.HMAC256(jwtSecret)`
- claim：`userId`
- `issuedAt`：当前时间
- `expiresAt`：当前时间加 7 天
- TTL：`7 * 24 * 60 * 60` 秒

校验逻辑：

1. `verifier.verify(token)` 校验签名和过期时间。
2. 读取 claim `userId`。
3. 若 `userId` 缺失或为空，抛出 `JWTVerificationException("missing userId claim")`。
4. 校验成功时返回 `userId` 字符串。

密钥启动校验：

- `JWT_SECRET` 不能为空。
- 长度必须至少 32 个字符。
- 不能以 `change-me` 或 `replace-with` 开头。

当前 `application.yml` 提供了一个较长的默认 `jwt-secret`，而 `docker-compose.yml` 中 `java-api` 显式设置 `JWT_SECRET: ${JWT_SECRET:-}`。因此容器启动时如果没有提供 `JWT_SECRET`，会传入空值并触发启动失败；这是更安全的部署行为。

## 9. HTTP 鉴权拦截

`WebMvcConfig` 将 `JwtAuthInterceptor` 注册到 `/api/**`。

白名单：

- `/api/auth/**`
- `/api/health`
- `/actuator/**`
- `/internal/**`

受保护路径：

- 所有其他 `/api/**` 路径都需要 `Authorization: Bearer <token>`。
- 当前仓库已有 `/api/users/me` 作为受保护接口；未来新增 Provider、会话和消息接口时会自动受该拦截器保护。

拦截流程：

1. 从请求头读取 `Authorization`。
2. 如果 header 为空，或不是以 `Bearer ` 开头，写入 401。
3. 截取 `Bearer ` 后面的 token 并 `trim()`。
4. 调用 `JwtTokenProvider.validateToken(token)`。
5. 校验成功后，将 `userId` 写入 `CurrentUser.set(userId)`。
6. Controller 和 Service 可通过 `CurrentUser.get()` 获取当前用户 ID。
7. 请求结束后，`afterCompletion()` 调用 `CurrentUser.clear()`，避免线程复用导致用户上下文泄漏。
8. token 无效或过期时，清理 `CurrentUser` 并返回 401。

## 10. 当前用户上下文

`CurrentUser` 使用 `ThreadLocal<String>` 保存当前请求的 `userId`。

方法：

- `get()`：返回当前线程中的用户 ID，可能为 `null`。
- `set(userId)`：写入当前用户 ID。
- `clear()`：移除当前线程中的用户 ID。

注意事项：

- 该机制适合传统同步 MVC 请求。
- 异步任务、线程池、WebSocket 或消息消费线程不会自动继承该上下文。
- 使用完必须清理，当前拦截器已在 `afterCompletion()` 中清理。

## 11. 数据库设计

用户表来自 `V1__init_schema.sql`：

```sql
CREATE TABLE users (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  username VARCHAR(20) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(50),
  avatar_url VARCHAR(500),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY idx_users_username (username)
);
```

字段说明：

| 字段 | 说明 |
| --- | --- |
| `id` | 用户主键，CHAR(36)，代码中注册时使用 UUID 字符串生成 |
| `username` | 用户名，最长 20，数据库唯一 |
| `password_hash` | BCrypt 哈希，不保存明文密码 |
| `display_name` | 显示名，注册时默认等于用户名 |
| `avatar_url` | 头像 URL，当前注册流程不设置 |
| `created_at` | 创建时间，数据库默认当前时间 |
| `updated_at` | 更新时间，数据库自动更新 |

唯一性保护：

- 业务层先用 `findByUsername` 检查。
- 数据库层还有 `UNIQUE KEY idx_users_username (username)` 兜底。
- 当前业务层没有单独捕获并转换并发注册导致的唯一键冲突；极端并发下可能进入全局 500 分支，这是后续可硬化点。

## 12. MyBatis 映射

`UserMapper` 方法：

- `insert(User user)`
- `findByUsername(String username)`
- `findById(String id)`
- `update(User user)`

当前登录模块使用：

- 注册：`findByUsername` + `insert`
- 登录：`findByUsername`
- 登录态恢复：`findById`

`UserMapper.xml` 映射：

- `UserResultMap` 将 `password_hash` 映射到 `passwordHash`。
- `insert` 写入 `id, username, password_hash, display_name, avatar_url`。
- `findByUsername` 和 `findById` 都会查出 `password_hash`，供登录密码校验或后续服务使用。
- `update` 当前只更新 `display_name` 和 `avatar_url`，但对应用户更新接口尚未实现。

## 13. 密码处理

注册时：

```java
BCrypt.hashpw(request.password(), BCrypt.gensalt())
```

登录时：

```java
BCrypt.checkpw(request.password(), user.getPasswordHash())
```

安全属性：

- 数据库不保存明文密码。
- BCrypt 每次 `gensalt()` 都会生成随机盐。
- 登录失败统一返回 `invalid username or password`，不区分用户不存在和密码错误。

当前限制：

- 没有登录失败次数限制。
- 没有账号锁定、验证码、MFA 或设备管理。
- 没有密码重置、修改密码、刷新 token、退出登录黑名单。

## 14. 日志行为

`AuthService` 日志：

- 用户名已存在：`Registration rejected because username already exists: {username}`
- 注册成功：`Registered user id={id} username={username}`
- 登录失败：`Login rejected for username={username}`
- 登录成功：`User logged in id={id} username={username}`

`JwtAuthInterceptor` 日志：

- 未携带 bearer：`Unauthorized request without bearer token path={path} method={method}`
- token 无效：`Unauthorized request with invalid token path={path} method={method}`

日志不会记录明文密码或 JWT token。

## 15. 配置与部署

`application.yml`：

```yaml
agenthub:
  auth:
    jwt-secret: ${JWT_SECRET:...}
    aes-key: ${AES_KEY:change-me-32-byte-base64-or-secret}
    internal-service-token: ${INTERNAL_SERVICE_TOKEN:change-me-internal-service-token}
```

登录模块实际使用 `agenthub.auth.jwt-secret`。`aes-key` 和 `internal-service-token` 属于 Provider 加密和内部服务鉴权规划，不属于当前登录 API 的直接依赖。

`docker-compose.yml`：

- Java API 容器端口：容器内 `8080`，宿主默认 `18080`。
- 前端 Nginx 代理 `/api/` 到 `java-api:8080/api/`。
- `JWT_SECRET` 默认传空，要求部署时显式提供。

本地直接访问：

- 健康检查：`http://localhost:18080/api/health`
- 注册：`http://localhost:18080/api/auth/register`
- 登录：`http://localhost:18080/api/auth/login`

经前端容器访问：

- `http://localhost:3000/api/auth/register`
- `http://localhost:3000/api/auth/login`

## 16. 前端实现

当前前端已经实现登录态闭环。

### 16.1 API 封装

`frontend/src/shared/api.ts` 现在提供：

- `AUTH_TOKEN_STORAGE_KEY = "agenthub_token"`
- `getStoredToken()` / `persistAuthToken()` / `clearAuthToken()`
- `ApiError`，包含 `status`、`code` 和 `message`
- `request()` 支持 `GET`、`POST`、`PUT`、`DELETE`
- 自动追加 `Authorization: Bearer <token>`
- `POST` 请求自动 JSON 序列化并设置 `Content-Type: application/json`
- 后端 `ApiResponse<T>` 自动 unwrap，业务失败转为 `ApiError`
- 受保护请求遇到 401 时派发 `agenthub:unauthorized` 事件

`agentHubApi` 已包含：

- `register(body)`
- `login(body)`
- `getCurrentUser()`
- 原有工作台读取接口：`getAgents()`、`getSessions()`、`getSessionMembers()`、`getMessages()`

### 16.2 类型

`frontend/src/shared/types.ts` 新增：

- `UserInfo`
- `LoginRequest`
- `RegisterRequest`
- `AuthResponse`

### 16.3 认证上下文

`frontend/src/auth/AuthContext.tsx` 提供：

- `token`
- `user`
- `initializing`
- `isAuthenticated`
- `login(credentials)`
- `register(credentials)`
- `logout()`

初始化逻辑：

1. 从 `localStorage["agenthub_token"]` 读取 token。
2. 没有 token 时直接结束初始化。
3. 有 token 时调用 `GET /api/users/me` 恢复用户信息。
4. 恢复失败时清除 token 和用户状态。
5. 监听 `agenthub:unauthorized`，后续受保护请求收到 401 时自动登出。

登录/注册逻辑：

1. 调用 `/api/auth/login` 或 `/api/auth/register`。
2. 成功后把 token 写入 `localStorage["agenthub_token"]`。
3. 将 `user` 写入 React 状态。
4. 页面跳转到 `/`。

退出逻辑：

1. 删除 `localStorage["agenthub_token"]`。
2. 清空 `token` 和 `user`。
3. 页面跳转到 `/login`。

### 16.4 页面与路由守卫

`frontend/src/auth/AuthPages.tsx` 实现：

- `LoginPage`
- `RegisterPage`
- `AuthLoadingScreen`

页面特性：

- 用户名输入：2 到 20 个字符。
- 密码输入：至少 8 位。
- 注册页提示密码需要 8 到 100 位，且包含字母和数字。
- 密码可显示/隐藏。
- 登录/注册提交中显示 loading 状态。
- 后端错误会展示在表单内。

`frontend/src/App.tsx` 实现轻量路由守卫：

- 支持 `/login`、`/register`、`/`。
- 未登录访问 `/` 时自动替换到 `/login`。
- 已登录访问 `/login` 或 `/register` 时自动替换到 `/`。
- 正在恢复登录态时展示 `AuthLoadingScreen`。
- 主工作台侧栏底部展示当前用户，并提供退出登录按钮。

当前没有引入 `react-router-dom`；路由使用浏览器 `history.pushState`、`replaceState` 和 `popstate` 管理。

## 17. 典型调用示例

注册：

```bash
curl -sS -X POST http://localhost:18080/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"demo","password":"abc12345"}'
```

登录：

```bash
curl -sS -X POST http://localhost:18080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"demo","password":"abc12345"}'
```

访问受保护接口的请求格式：

```bash
curl -sS http://localhost:18080/api/users/me \
  -H "Authorization: Bearer <jwt>"
```

## 18. 验证记录

`process.md` 中记录了 2026-05-24 的验证：

- `mvn test` 通过。
- 临时 MySQL 启动 Java API。
- `curl` 验证注册、登录、错误密码 401。
- 安全硬化后再次验证：
  - 弱密码返回 400。
  - 注册成功。
  - 登录成功。
  - 未鉴权访问受保护接口返回 401。

当前仓库没有 `backend-java/src/test` 测试目录；上述记录来自过程文档，不是当前新增的自动化测试文件。

2026-05-24 前端认证闭环补齐后的本地验证：

- `backend-java` 执行 `mvn test` 通过；当前仍无测试源。
- `frontend` 首次执行 `npm run build` 因未安装依赖失败，随后执行 `npm install`。
- `frontend` 再次执行 `npm run build` 通过。
- 启动 MySQL/Redis 后，以本地 Java API 端口 `18080` 做 curl 验证：
  - `POST /api/auth/register` 成功，返回 token 和用户信息。
  - `POST /api/auth/login` 成功，返回 token 和用户信息。
  - 带 `Authorization: Bearer <jwt>` 访问 `GET /api/users/me` 成功。
  - 未带 token 访问 `GET /api/users/me` 返回 401。
- 使用本地 Vite dev server `http://127.0.0.1:5173/` 做浏览器验收：
  - 未登录访问 `/` 自动进入 `/login`。
  - `/register` 页面在窄屏和桌面宽屏下正常显示。
  - 登录成功后进入 `/` 工作台。
  - 登录后刷新页面会调用 `/api/users/me` 恢复用户。
  - 工作台侧栏显示当前用户和退出登录按钮。
- 针对登录后工作台落地体验补齐：
  - `GET /api/agents` 返回数据库预置 Agent 列表。
  - `GET /api/sessions` 当前返回空列表，避免未实现接口在登录后刷 500。
  - 未实现资源统一返回 404 / `not found`，不再进入 500 未捕获异常日志。

## 19. 已知风险与后续建议

| 优先级 | 项目 | 说明 |
| --- | --- | --- |
| P0 | 会话 API 仍是占位 | `GET /api/sessions` 当前只返回空列表，创建会话、成员和消息接口仍待 M2 实现 |
| P1 | Agent API 只支持列表 | `GET /api/agents` 已返回预置 Agent，但 Agent Provider 覆盖配置仍待 M1.2 实现 |
| P1 | 前端登录态只存 token | 用户信息在内存中，刷新后依赖 `/api/users/me` 恢复，这是当前设计预期 |
| P1 | 并发注册唯一键冲突 | 业务层先查再插，极端并发下数据库唯一键异常没有转换成 40901 |
| P1 | token 无刷新/吊销机制 | JWT 7 天有效，退出登录只能前端删除 token，服务端无法主动吊销已签发 token |
| P1 | 无登录限流 | 密码错误没有次数限制、IP 限流或账号锁定 |
| P2 | 用户名规范较弱 | 当前仅长度和非空校验，没有限制字符集、大小写归一化或保留字 |
| P2 | 鉴权响应 code 粒度低 | 拦截器对缺失 token、过期 token、签名错误统一返回 code 401 |
| P2 | 默认配置需部署约束 | 直接运行 `application.yml` 会使用内置长密钥；容器模式更严格，要求显式 `JWT_SECRET` |

## 20. 当前实现结论

登录模块已经具备端到端最小可用能力：后端可注册、登录、恢复当前用户并校验 JWT；前端可登录、注册、保存 token、刷新恢复登录态、路由守卫和退出登录。它适合作为后续 Provider、会话、消息等 API 的认证基础。

模块还不是完整产品级登录系统。缺口主要集中在 token 生命周期管理、风控限流、并发异常硬化、WebSocket 鉴权，以及登录后工作台所依赖的 Provider/会话/消息接口。下一步建议继续 `process.md` 的 `M1.2 Provider 配置`，因为认证能力现在已经可以支撑用户级配置接口。
