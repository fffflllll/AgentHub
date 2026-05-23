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

CREATE TABLE user_providers (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id CHAR(36) NOT NULL,
  provider_type VARCHAR(20) NOT NULL,
  api_key_enc TEXT NOT NULL,
  base_url VARCHAR(500),
  default_model VARCHAR(100) NOT NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_providers_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_providers_user_id ON user_providers(user_id);

CREATE TABLE agents (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  identifier VARCHAR(50) NOT NULL,
  name VARCHAR(50) NOT NULL,
  role_desc VARCHAR(200) NOT NULL,
  system_prompt TEXT NOT NULL,
  default_model VARCHAR(100),
  agent_mode VARCHAR(10) NOT NULL DEFAULT 'LLM',
  platform_type VARCHAR(30),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY idx_agents_identifier (identifier)
);

CREATE TABLE agent_provider_overrides (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id CHAR(36) NOT NULL,
  agent_id CHAR(36) NOT NULL,
  provider_id CHAR(36) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY idx_override_user_agent (user_id, agent_id),
  CONSTRAINT fk_override_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_override_agent FOREIGN KEY (agent_id) REFERENCES agents(id),
  CONSTRAINT fk_override_provider FOREIGN KEY (provider_id) REFERENCES user_providers(id) ON DELETE CASCADE
);

CREATE TABLE sessions (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(100) NOT NULL,
  session_type VARCHAR(10) NOT NULL,
  owner_id CHAR(36) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_sessions_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_sessions_owner ON sessions(owner_id);
CREATE INDEX idx_sessions_updated ON sessions(owner_id, updated_at DESC);

CREATE TABLE session_members (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  session_id CHAR(36) NOT NULL,
  user_id CHAR(36),
  agent_id CHAR(36),
  member_type VARCHAR(10) NOT NULL,
  joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_members_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_members_agent FOREIGN KEY (agent_id) REFERENCES agents(id),
  CONSTRAINT chk_member_type CHECK (
    (member_type = 'USER' AND user_id IS NOT NULL AND agent_id IS NULL) OR
    (member_type = 'AGENT' AND agent_id IS NOT NULL AND user_id IS NULL)
  )
);

CREATE INDEX idx_members_session ON session_members(session_id);
CREATE UNIQUE INDEX idx_members_unique ON session_members(session_id, user_id, agent_id);

CREATE TABLE messages (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  session_id CHAR(36) NOT NULL,
  sender_type VARCHAR(10) NOT NULL,
  sender_id CHAR(36),
  content TEXT NOT NULL,
  message_type VARCHAR(20) NOT NULL DEFAULT 'TEXT',
  metadata JSON,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_messages_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_messages_session_time ON messages(session_id, created_at DESC);
CREATE INDEX idx_messages_session_cursor ON messages(session_id, created_at);

CREATE TABLE message_code_blocks (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  message_id CHAR(36) NOT NULL,
  language VARCHAR(50) NOT NULL,
  file_name VARCHAR(255),
  code_content TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_code_blocks_message FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);

CREATE INDEX idx_code_blocks_message ON message_code_blocks(message_id);

CREATE TABLE project_files (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  session_id CHAR(36) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  version INT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY idx_project_files_path (session_id, file_path),
  CONSTRAINT fk_project_files_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

INSERT INTO agents (identifier, name, role_desc, system_prompt, default_model, agent_mode, platform_type)
VALUES
  ('frontend_agent', 'Frontend Agent', 'Frontend development expert', 'You are a frontend engineering expert.', 'claude-sonnet-4-20250514', 'LLM', NULL),
  ('backend_agent', 'Backend Agent', 'Backend development expert', 'You are a backend engineering expert.', 'claude-sonnet-4-20250514', 'LLM', NULL),
  ('test_agent', 'Test Agent', 'Testing expert', 'You are a software testing expert.', 'gpt-4o', 'LLM', NULL),
  ('orchestrator', 'Orchestrator', 'Task planning and coordination', 'You are a project orchestrator for multi-agent development.', 'claude-sonnet-4-20250514', 'LLM', NULL),
  ('claude_code_agent', 'Claude Code Agent', 'Full-stack coding agent powered by Claude Code CLI', 'Use the project workspace to complete coding tasks.', 'claude-sonnet-4-20250514', 'PLATFORM', 'CLAUDE_CODE');
