export type ApiResponse<T> = {
  code: number | string;
  message: string;
  data: T;
};

export type SessionType = 'DIRECT' | 'GROUP';
export type MemberType = 'USER' | 'AGENT';
export type SenderType = 'USER' | 'AGENT' | 'SYSTEM';
export type MessageType = 'TEXT' | 'CODE' | 'TASK_PLAN' | 'SYSTEM';
export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
export type ProviderType = 'OPENAI' | 'ANTHROPIC' | 'CUSTOM';

export type UserInfo = {
  id: string;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
};

export type LoginRequest = {
  username: string;
  password: string;
};

export type RegisterRequest = {
  username: string;
  password: string;
};

export type AuthResponse = {
  token: string;
  user: UserInfo;
};

export type AgentResponse = {
  id: string;
  identifier: string;
  name: string;
  roleDescription: string;
  defaultModel?: string;
};

export type ProviderResponse = {
  id: string;
  providerType: ProviderType;
  baseUrl?: string | null;
  defaultModel: string;
  isDefault: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type CreateProviderRequest = {
  providerType: ProviderType;
  apiKey: string;
  baseUrl?: string | null;
  defaultModel: string;
  isDefault?: boolean;
};

export type UpdateProviderRequest = Partial<CreateProviderRequest>;

export type SessionResponse = {
  id: string;
  name: string;
  type: SessionType;
  lastMessage?: string | null;
  updatedAt?: string | null;
};

export type SessionMemberResponse = {
  id: string;
  memberType: MemberType;
  memberId: string;
  name: string;
};

export type MessageCodeBlockResponse = {
  id: string;
  language?: string | null;
  filename?: string | null;
  content: string;
};

export type TaskItemResponse = {
  id: string;
  title?: string | null;
  description: string;
  assigneeAgentId?: string | null;
  assigneeAgentName?: string | null;
  status: TaskStatus;
};

export type TaskPlanResponse = {
  id: string;
  title?: string | null;
  status?: TaskStatus;
  items: TaskItemResponse[];
};

export type MessageResponse = {
  id: string;
  senderType: SenderType;
  senderId?: string | null;
  senderName?: string | null;
  content: string;
  type: MessageType;
  createdAt: string;
  codeBlocks?: MessageCodeBlockResponse[];
  taskPlan?: TaskPlanResponse | null;
};

export type MessagePageQuery = {
  before?: string;
  limit?: number;
};
