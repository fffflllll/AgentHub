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

-- code_reviews: 一次 AgentRun 对应一条审核记录
-- project_id MVP 阶段 = session_id，代码层通过 ProjectStorageService 抽象访问
CREATE TABLE code_reviews (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  project_id CHAR(36) NOT NULL,                      -- 项目 ID（MVP = session_id）
  task_id CHAR(36) NOT NULL,                         -- AgentTask / AgentRun ID
  message_id CHAR(36),                               -- 可选：关联的聊天消息
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',     -- PENDING / APPROVED / REJECTED / PARTIALLY_APPROVED
  reviewer_id CHAR(36) NOT NULL,
  reviewed_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_review_user FOREIGN KEY (reviewer_id) REFERENCES users(id)
);

CREATE INDEX idx_review_task ON code_reviews(task_id);
CREATE INDEX idx_review_project ON code_reviews(project_id);

-- code_review_patches: 一次审核中的逐文件变更明细
-- base_version 用于 Approve 时的乐观锁校验
CREATE TABLE code_review_patches (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  review_id CHAR(36) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  patch_type VARCHAR(10) NOT NULL,                   -- CREATE / MODIFY / DELETE
  base_version INT,                                  -- Agent 生成 patch 时的 project_files.version
  original_content MEDIUMTEXT,
  new_content MEDIUMTEXT,
  diff_hunk TEXT,                                    -- unified diff 格式
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING_REVIEW',  -- PENDING_REVIEW / APPROVED / REJECTED / APPLIED
  reviewed_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_review_patches_review FOREIGN KEY (review_id) REFERENCES code_reviews(id) ON DELETE CASCADE
);

CREATE INDEX idx_review_patches_review ON code_review_patches(review_id);
CREATE INDEX idx_review_patches_status ON code_review_patches(review_id, status);

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

-- MVP 过渡：project_files 增加软删除标记
-- project_files.session_id 在代码层由 ProjectStorageService 映射为 projectId
-- 后续迁移再将 session_id 重命名为 project_id
ALTER TABLE project_files ADD COLUMN is_deleted TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE project_files MODIFY COLUMN content MEDIUMTEXT NOT NULL;
