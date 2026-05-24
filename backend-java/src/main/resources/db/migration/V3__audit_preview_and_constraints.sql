CREATE UNIQUE INDEX idx_members_unique_user
  ON session_members (session_id, user_id);

CREATE UNIQUE INDEX idx_members_unique_agent
  ON session_members (session_id, agent_id);

CREATE TABLE previews (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  session_id CHAR(36) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  preview_url VARCHAR(500),
  error_message TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_previews_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_previews_session ON previews(session_id);

CREATE TABLE agent_task_runs (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  task_id CHAR(36) NOT NULL,
  agent_id CHAR(36) NOT NULL,
  session_id CHAR(36) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  prompt_tokens INT DEFAULT 0,
  completion_tokens INT DEFAULT 0,
  started_at DATETIME,
  completed_at DATETIME,
  duration_ms INT,
  error_code VARCHAR(50),
  error_message TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_task_runs_agent FOREIGN KEY (agent_id) REFERENCES agents(id),
  CONSTRAINT fk_task_runs_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_runs_task ON agent_task_runs(task_id);
CREATE INDEX idx_runs_session ON agent_task_runs(session_id);
CREATE INDEX idx_runs_agent ON agent_task_runs(agent_id);

CREATE TABLE agent_trace_events (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  run_id CHAR(36) NOT NULL,
  sequence INT NOT NULL,
  event_type VARCHAR(20) NOT NULL,
  payload JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_trace_events_run FOREIGN KEY (run_id) REFERENCES agent_task_runs(id) ON DELETE CASCADE
);

CREATE INDEX idx_trace_run ON agent_trace_events(run_id, sequence);

CREATE TABLE verification_reports (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  run_id CHAR(36) NOT NULL,
  overall_status VARCHAR(10) NOT NULL,
  checks_json JSON NOT NULL,
  summary TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_verification_run FOREIGN KEY (run_id) REFERENCES agent_task_runs(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_verification_run ON verification_reports(run_id);
