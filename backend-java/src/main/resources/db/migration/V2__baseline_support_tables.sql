CREATE UNIQUE INDEX idx_members_unique_user
  ON session_members (session_id, user_id);

CREATE UNIQUE INDEX idx_members_unique_agent
  ON session_members (session_id, agent_id);

ALTER TABLE project_files
  DROP FOREIGN KEY fk_project_files_session;

DROP INDEX idx_project_files_path ON project_files;

ALTER TABLE project_files
  CHANGE COLUMN session_id project_id CHAR(36) NOT NULL,
  MODIFY COLUMN content MEDIUMTEXT NOT NULL,
  ADD COLUMN is_deleted TINYINT(1) NOT NULL DEFAULT 0 AFTER version;

CREATE UNIQUE INDEX idx_project_files_path
  ON project_files (project_id, file_path);

CREATE TABLE task_plans (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  message_id CHAR(36) NOT NULL,
  session_id CHAR(36) NOT NULL,
  title VARCHAR(200) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_task_plans_message FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  CONSTRAINT fk_task_plans_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_task_plans_session ON task_plans(session_id);

CREATE TABLE task_items (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  task_plan_id CHAR(36) NOT NULL,
  sequence INT NOT NULL,
  description VARCHAR(500) NOT NULL,
  assigned_agent_id CHAR(36),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  depends_on JSON,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_task_items_plan FOREIGN KEY (task_plan_id) REFERENCES task_plans(id) ON DELETE CASCADE,
  CONSTRAINT fk_task_items_agent FOREIGN KEY (assigned_agent_id) REFERENCES agents(id)
);

CREATE INDEX idx_task_items_plan ON task_items(task_plan_id);

CREATE TABLE deployments (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  session_id CHAR(36) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  deploy_url VARCHAR(500),
  error_message TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_deployments_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_deployments_session ON deployments(session_id);

CREATE TABLE code_reviews (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  project_id CHAR(36) NOT NULL,
  task_id CHAR(36) NOT NULL,
  message_id CHAR(36),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  reviewer_id CHAR(36),
  reviewed_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_reviews_message FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE SET NULL,
  CONSTRAINT fk_reviews_reviewer FOREIGN KEY (reviewer_id) REFERENCES users(id)
);

CREATE INDEX idx_review_task ON code_reviews(task_id);
CREATE INDEX idx_review_project ON code_reviews(project_id);

CREATE TABLE code_review_patches (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  review_id CHAR(36) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  patch_type VARCHAR(10) NOT NULL,
  base_version INT,
  original_content MEDIUMTEXT,
  new_content MEDIUMTEXT,
  diff_hunk TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING_REVIEW',
  reviewed_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_review_patches_review FOREIGN KEY (review_id) REFERENCES code_reviews(id) ON DELETE CASCADE
);

CREATE INDEX idx_review_patches_review ON code_review_patches(review_id);
CREATE INDEX idx_review_patches_status ON code_review_patches(review_id, status);

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
