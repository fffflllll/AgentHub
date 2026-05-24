import type { LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  Circle,
  CircleDot,
  Code2,
  Database,
  Eye,
  FileCode2,
  Folder,
  LogOut,
  Menu,
  MessageSquarePlus,
  PanelLeft,
  Plus,
  Search,
  SendHorizontal,
  Settings,
  Sparkles,
  TestTube2,
  Users,
  Wifi,
  Workflow,
} from 'lucide-react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { AuthLoadingScreen, LoginPage, RegisterPage } from './auth/AuthPages';
import { agentHubApi } from './shared/api';
import { config } from './shared/config';
import type {
  AgentResponse,
  MessageCodeBlockResponse,
  MessageResponse,
  SessionMemberResponse,
  SessionResponse,
  TaskItemResponse,
  TaskPlanResponse,
  TaskStatus,
  UserInfo,
} from './shared/types';

type ApiErrors = {
  agents?: string;
  sessions?: string;
  conversation?: string;
};

type AgentVisual = {
  icon: LucideIcon;
  accent: string;
};

type CodeBlockView = MessageCodeBlockResponse & {
  messageId: string;
  senderName: string;
};

const agentVisuals: Record<string, AgentVisual> = {
  orchestrator: { icon: Workflow, accent: 'bg-violet-100 text-violet-700' },
  frontend_agent: { icon: Code2, accent: 'bg-emerald-100 text-emerald-700' },
  backend_agent: { icon: Database, accent: 'bg-sky-100 text-sky-700' },
  test_agent: { icon: TestTube2, accent: 'bg-amber-100 text-amber-700' },
};

const fallbackAgentVisual: AgentVisual = {
  icon: Sparkles,
  accent: 'bg-neutral-100 text-neutral-700',
};

const formatSessionType = (type: SessionResponse['type']) => (type === 'GROUP' ? '群聊' : '单聊');

const formatSenderType = (type: MessageResponse['senderType']) => {
  if (type === 'USER') {
    return '用户';
  }

  if (type === 'SYSTEM') {
    return '系统';
  }

  return 'Agent';
};

const formatTime = (value?: string | null) => {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getUserInitials = (user?: UserInfo | null) => {
  const value = user?.displayName || user?.username || 'AH';
  return value.slice(0, 2).toUpperCase();
};

const toErrorMessage = (reason: unknown) => {
  if (reason instanceof Error) {
    return reason.message;
  }

  return '接口请求失败';
};

function getAgentVisual(agent?: AgentResponse | null) {
  if (!agent) {
    return fallbackAgentVisual;
  }

  return agentVisuals[agent.identifier] ?? fallbackAgentVisual;
}

function EmptyState({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-neutral-300 bg-white/70 px-4 py-5 text-center">
      <p className="text-sm font-semibold text-neutral-900">{title}</p>
      {detail ? <p className="mt-1 text-xs leading-5 text-neutral-500">{detail}</p> : null}
    </div>
  );
}

function SkeletonRows({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, index) => (
        <div className="rounded-lg border border-neutral-200 bg-white p-3" key={index}>
          <div className="h-4 w-2/3 rounded bg-neutral-100" />
          <div className="mt-2 h-3 w-full rounded bg-neutral-100" />
        </div>
      ))}
    </div>
  );
}

function StatusDot({ status }: { status: TaskStatus }) {
  if (status === 'COMPLETED') {
    return <CheckCircle2 className="text-emerald-600" size={16} />;
  }

  if (status === 'IN_PROGRESS') {
    return <CircleDot className="text-blue-600" size={16} />;
  }

  return <Circle className="text-neutral-300" size={16} />;
}

function LogoMark() {
  return (
    <div className="grid size-9 place-items-center rounded-lg bg-neutral-950 text-white shadow-sm">
      <Sparkles size={18} strokeWidth={2.2} />
    </div>
  );
}

function SessionList({
  agents,
  errors,
  loading,
  onLogout,
  onSelect,
  selectedSessionId,
  sessions,
  user,
}: {
  agents: AgentResponse[];
  errors: ApiErrors;
  loading: boolean;
  onLogout: () => void;
  onSelect: (sessionId: string) => void;
  selectedSessionId: string | null;
  sessions: SessionResponse[];
  user: UserInfo | null;
}) {
  return (
    <aside className="hidden h-screen border-r border-neutral-200 bg-[#f6f6f3] lg:flex lg:w-[304px] lg:flex-col">
      <div className="flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <LogoMark />
          <div>
            <p className="text-[15px] font-semibold tracking-tight text-neutral-950">AgentHub</p>
            <p className="text-xs text-neutral-500">IM-style Agent workspace</p>
          </div>
        </div>
        <button
          aria-label="收起会话栏"
          className="grid size-9 place-items-center rounded-lg text-neutral-500 transition hover:bg-white hover:text-neutral-950"
          type="button"
        >
          <PanelLeft size={19} />
        </button>
      </div>

      <div className="px-3">
        <button
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-neutral-950 px-3 text-sm font-medium text-white shadow-sm transition hover:bg-neutral-800"
          type="button"
        >
          <MessageSquarePlus size={18} />
          新建会话
        </button>
        <label className="mt-3 flex h-10 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 text-neutral-500">
          <Search size={17} />
          <input
            className="min-w-0 flex-1 bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral-400"
            placeholder="搜索会话或 Agent"
            type="text"
          />
        </label>
      </div>

      <div className="mt-5 flex-1 overflow-y-auto px-3">
        <div className="flex items-center justify-between px-1 pb-2">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">会话</p>
          <button
            aria-label="添加会话"
            className="grid size-7 place-items-center rounded-md text-neutral-500 transition hover:bg-white hover:text-neutral-950"
            type="button"
          >
            <Plus size={16} />
          </button>
        </div>

        {loading ? <SkeletonRows /> : null}

        {!loading && errors.sessions ? (
          <EmptyState detail={errors.sessions} title="会话接口未返回数据" />
        ) : null}

        {!loading && !errors.sessions && sessions.length === 0 ? (
          <EmptyState detail="后端返回会话后会在这里展示。" title="暂无会话" />
        ) : null}

        {!loading && sessions.length > 0 ? (
          <div className="space-y-1">
            {sessions.map((session) => {
              const active = session.id === selectedSessionId;

              return (
                <button
                  className={`w-full rounded-lg border p-3 text-left transition ${
                    active
                      ? 'border-neutral-200 bg-white shadow-[0_1px_0_rgba(0,0,0,0.04)]'
                      : 'border-transparent text-neutral-700 hover:bg-white/70'
                  }`}
                  key={session.id}
                  onClick={() => onSelect(session.id)}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-neutral-950">{session.name}</span>
                        <span className="shrink-0 rounded-md border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500">
                          {formatSessionType(session.type)}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs leading-5 text-neutral-500">
                        {session.lastMessage || '暂无消息'}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] text-neutral-400">{formatTime(session.updatedAt)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : null}

        <div className="mt-6">
          <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">预置 Agent</p>
          {errors.agents ? <EmptyState detail={errors.agents} title="Agent 接口未返回数据" /> : null}
          {!errors.agents && agents.length === 0 ? <EmptyState title="暂无 Agent" /> : null}
          <div className="space-y-1">
            {agents.map((agent) => {
              const { icon: Icon, accent } = getAgentVisual(agent);

              return (
                <button
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-white"
                  key={agent.id}
                  type="button"
                >
                  <span className={`grid size-8 place-items-center rounded-lg ${accent}`}>
                    <Icon size={17} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-neutral-900">{agent.name}</span>
                    <span className="block truncate text-xs text-neutral-500">{agent.roleDescription}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="border-t border-neutral-200 px-4 py-3">
        <div className="flex items-center gap-3 rounded-lg p-2">
          <span className="grid size-9 place-items-center rounded-full bg-neutral-950 text-xs font-bold text-white">
            {getUserInitials(user)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-neutral-950">
              {user?.displayName || user?.username || 'AgentHub'}
            </span>
            <span className="block truncate text-xs text-neutral-500">API {config.apiUrl}</span>
          </span>
          <button
            aria-label="退出登录"
            className="grid size-9 place-items-center rounded-lg text-neutral-500 transition hover:bg-white hover:text-neutral-950"
            onClick={onLogout}
            title="退出登录"
            type="button"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
}

function TaskPlanCard({ plan }: { plan: TaskPlanResponse }) {
  return (
    <div className="mt-3 rounded-lg border border-neutral-200 bg-white">
      <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <Workflow className="text-violet-700" size={18} />
          <p className="text-sm font-semibold text-neutral-950">{plan.title || '任务计划'}</p>
        </div>
        {plan.status ? (
          <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">{plan.status}</span>
        ) : null}
      </div>
      <div className="divide-y divide-neutral-100">
        {plan.items.map((task: TaskItemResponse) => (
          <div className="flex items-center gap-3 px-4 py-3" key={task.id}>
            <StatusDot status={task.status} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-neutral-900">{task.title || task.description}</p>
              <p className="truncate text-xs text-neutral-500">{task.assigneeAgentName || '未分配'}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChatMessage({
  agents,
  members,
  message,
}: {
  agents: AgentResponse[];
  members: SessionMemberResponse[];
  message: MessageResponse;
}) {
  if (message.senderType === 'SYSTEM') {
    return (
      <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        {message.content}
      </div>
    );
  }

  const senderName =
    message.senderName ||
    members.find((member) => member.memberId === message.senderId)?.name ||
    formatSenderType(message.senderType);
  const agent = agents.find((item) => item.id === message.senderId || item.name === senderName);
  const { icon: Icon, accent } = getAgentVisual(agent);

  if (message.senderType === 'USER') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[78%] rounded-lg bg-neutral-950 px-4 py-3 text-sm leading-6 text-white shadow-sm">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <div className={`grid size-9 shrink-0 place-items-center rounded-lg ${accent}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-neutral-950">{senderName}</p>
          <span className="text-xs text-neutral-400">{formatTime(message.createdAt)}</span>
        </div>
        <div className="mt-2 rounded-lg border border-neutral-200 bg-white px-4 py-3 shadow-sm">
          <p className="whitespace-pre-wrap text-sm leading-6 text-neutral-700">{message.content}</p>
          {message.taskPlan ? <TaskPlanCard plan={message.taskPlan} /> : null}
          {message.codeBlocks?.map((block) => (
            <div className="mt-3 overflow-hidden rounded-lg border border-neutral-200 bg-[#111315]" key={block.id}>
              <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
                <span className="truncate text-xs font-medium text-neutral-300">
                  {block.filename || block.language || 'code'}
                </span>
              </div>
              <pre className="max-h-56 overflow-auto px-3 py-3 text-xs leading-5 text-neutral-200">
                <code>{block.content}</code>
              </pre>
            </div>
          ))}
          {message.codeBlocks?.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="flex h-8 items-center gap-1.5 rounded-md border border-neutral-200 px-2.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50"
                type="button"
              >
                <Code2 size={14} />
                查看 Diff
              </button>
              <button
                className="flex h-8 items-center gap-1.5 rounded-md border border-neutral-200 px-2.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50"
                type="button"
              >
                <Eye size={14} />
                预览
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ChatArea({
  agents,
  conversationError,
  loading,
  members,
  messages,
  selectedSession,
}: {
  agents: AgentResponse[];
  conversationError?: string;
  loading: boolean;
  members: SessionMemberResponse[];
  messages: MessageResponse[];
  selectedSession: SessionResponse | null;
}) {
  const memberNames = members.map((member) => member.name).join('、');

  return (
    <section className="flex h-screen min-w-0 flex-col bg-[#fbfbfa]">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-4 lg:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <button
            aria-label="打开菜单"
            className="grid size-9 place-items-center rounded-lg text-neutral-600 transition hover:bg-neutral-100 lg:hidden"
            type="button"
          >
            <Menu size={21} />
          </button>
          <div className="min-w-0">
            <button className="flex max-w-full items-center gap-1.5 rounded-md text-left" type="button">
              <span className="truncate text-lg font-semibold tracking-tight text-neutral-950">
                {selectedSession?.name || '选择会话'}
              </span>
              <ChevronDown className="shrink-0 text-neutral-500" size={18} />
            </button>
            <div className="mt-1 flex items-center gap-2 text-xs text-neutral-500">
              <Users size={14} />
              <span className="truncate">{memberNames || '暂无成员数据'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs font-medium text-neutral-600 sm:flex">
            <Wifi size={14} />
            WS
          </span>
          <button
            aria-label="设置"
            className="grid size-9 place-items-center rounded-lg text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-950"
            type="button"
          >
            <Settings size={19} />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        <div className="mx-auto flex h-full max-w-3xl flex-col px-4 py-6">
          <div className="flex-1 space-y-5 overflow-y-auto pr-1">
            {!selectedSession ? <EmptyState title="暂无选中会话" /> : null}
            {selectedSession && loading ? <SkeletonRows count={4} /> : null}
            {selectedSession && !loading && conversationError ? (
              <EmptyState detail={conversationError} title="会话数据接口未返回" />
            ) : null}
            {selectedSession && !loading && !conversationError && messages.length === 0 ? (
              <EmptyState title="暂无消息" />
            ) : null}
            {messages.map((message) => (
              <ChatMessage agents={agents} key={message.id} members={members} message={message} />
            ))}
          </div>

          <div className="pt-5">
            <div className="rounded-lg border border-neutral-200 bg-white p-2 shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
              {agents.length > 0 ? (
                <div className="mb-2 flex flex-wrap gap-2 px-2 pt-1">
                  {agents.map((agent) => (
                    <button
                      className="rounded-md bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-700 transition hover:bg-neutral-200"
                      key={agent.id}
                      type="button"
                    >
                      @{agent.name}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="flex items-end gap-2 px-2 pb-2">
                <button
                  aria-label="添加上下文"
                  className="grid size-9 shrink-0 place-items-center rounded-lg text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-950"
                  type="button"
                >
                  <Plus size={21} />
                </button>
                <textarea
                  className="max-h-32 min-h-12 flex-1 resize-none bg-transparent py-3 text-[15px] leading-6 text-neutral-900 outline-none placeholder:text-neutral-400"
                  disabled={!selectedSession}
                  placeholder={selectedSession ? '输入消息，Enter 发送，Shift + Enter 换行' : '选择会话后发送消息'}
                  rows={1}
                />
                <button
                  aria-label="发送消息"
                  className="grid size-9 shrink-0 place-items-center rounded-lg bg-neutral-950 text-white shadow-sm transition hover:bg-neutral-800 disabled:bg-neutral-300"
                  disabled={!selectedSession}
                  type="button"
                >
                  <SendHorizontal size={18} />
                </button>
              </div>
            </div>
            <p className="mt-2 text-center text-xs text-neutral-400">
              API {config.apiUrl} · WS {config.wsUrl}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function WorkspacePanel({ codeBlocks }: { codeBlocks: CodeBlockView[] }) {
  const selectedBlock = codeBlocks[0] ?? null;

  return (
    <aside className="hidden h-screen border-l border-neutral-200 bg-white xl:flex xl:w-[408px] xl:flex-col">
      <header className="flex h-16 items-center justify-between border-b border-neutral-200 px-4">
        <div>
          <p className="text-sm font-semibold text-neutral-950">工程面板</p>
          <p className="text-xs text-neutral-500">代码对比 / 网页预览</p>
        </div>
        <button
          aria-label="折叠工程面板"
          className="grid size-9 place-items-center rounded-lg text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-950"
          type="button"
        >
          <PanelLeft size={18} />
        </button>
      </header>

      <div className="flex gap-1 border-b border-neutral-200 px-4 py-3">
        <button
          className="flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-neutral-950 text-sm font-medium text-white"
          type="button"
        >
          <Code2 size={16} />
          代码对比
        </button>
        <button
          className="flex h-9 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-medium text-neutral-600 transition hover:bg-neutral-100"
          type="button"
        >
          <Eye size={16} />
          网页预览
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <section className="rounded-lg border border-neutral-200">
          <div className="flex items-center gap-2 border-b border-neutral-100 px-3 py-3">
            <Folder className="text-neutral-500" size={17} />
            <p className="text-sm font-semibold text-neutral-950">代码块</p>
          </div>
          {codeBlocks.length === 0 ? (
            <div className="p-3">
              <EmptyState title="暂无代码块" />
            </div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {codeBlocks.map((block) => (
                <button
                  className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition ${
                    block.id === selectedBlock?.id ? 'bg-neutral-50 text-neutral-950' : 'text-neutral-600 hover:bg-neutral-50'
                  }`}
                  key={`${block.messageId}-${block.id}`}
                  type="button"
                >
                  <FileCode2 className="shrink-0 text-neutral-400" size={16} />
                  <span className="min-w-0 flex-1 truncate">{block.filename || block.language || block.senderName}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="mt-4 overflow-hidden rounded-lg border border-neutral-200">
          <div className="flex items-center justify-between border-b border-neutral-100 px-3 py-3">
            <p className="text-sm font-semibold text-neutral-950">Diff 预览</p>
            <span className="text-xs text-neutral-500">side-by-side</span>
          </div>
          {selectedBlock ? (
            <div className="grid grid-cols-2 divide-x divide-neutral-200 bg-[#fafafa] text-xs">
              <div>
                <div className="border-b border-neutral-200 px-3 py-2 font-medium text-neutral-500">原代码</div>
                <pre className="h-52 overflow-auto px-3 py-3 leading-5 text-neutral-400" />
              </div>
              <div>
                <div className="border-b border-neutral-200 px-3 py-2 font-medium text-neutral-500">Agent 代码</div>
                <pre className="h-52 overflow-auto bg-emerald-50/40 px-3 py-3 leading-5 text-neutral-700">
                  {selectedBlock.content}
                </pre>
              </div>
            </div>
          ) : (
            <div className="p-3">
              <EmptyState title="暂无 Diff 数据" />
            </div>
          )}
        </section>

        <section className="mt-4 rounded-lg border border-neutral-200 p-3">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-neutral-950">网页预览</p>
            <span className="rounded-md bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-600">未触发</span>
          </div>
          <div className="rounded-lg border border-dashed border-neutral-300 bg-[#fbfbfa] p-4">
            <EmptyState title="暂无预览" />
          </div>
        </section>
      </div>
    </aside>
  );
}

type RoutePath = '/' | '/login' | '/register';

const getRoutePath = (): RoutePath => {
  if (typeof window === 'undefined') {
    return '/';
  }

  if (window.location.pathname === '/login' || window.location.pathname === '/register') {
    return window.location.pathname;
  }

  return '/';
};

function WorkspaceApp({ onLogout, user }: { onLogout: () => void; user: UserInfo | null }) {
  const [agents, setAgents] = useState<AgentResponse[]>([]);
  const [sessions, setSessions] = useState<SessionResponse[]>([]);
  const [members, setMembers] = useState<SessionMemberResponse[]>([]);
  const [messages, setMessages] = useState<MessageResponse[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [loadingIndex, setLoadingIndex] = useState(true);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [errors, setErrors] = useState<ApiErrors>({});

  useEffect(() => {
    let cancelled = false;

    const loadIndex = async () => {
      setLoadingIndex(true);
      const [agentsResult, sessionsResult] = await Promise.allSettled([
        agentHubApi.getAgents(),
        agentHubApi.getSessions(),
      ]);

      if (cancelled) {
        return;
      }

      setErrors((current) => ({
        ...current,
        agents: agentsResult.status === 'rejected' ? toErrorMessage(agentsResult.reason) : undefined,
        sessions: sessionsResult.status === 'rejected' ? toErrorMessage(sessionsResult.reason) : undefined,
      }));

      if (agentsResult.status === 'fulfilled') {
        setAgents(agentsResult.value);
      }

      if (sessionsResult.status === 'fulfilled') {
        setSessions(sessionsResult.value);
        setSelectedSessionId((current) => current ?? sessionsResult.value[0]?.id ?? null);
      }

      setLoadingIndex(false);
    };

    void loadIndex();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadConversation = async () => {
      setMembers([]);
      setMessages([]);

      if (!selectedSessionId) {
        setErrors((current) => ({ ...current, conversation: undefined }));
        return;
      }

      setLoadingConversation(true);
      const [membersResult, messagesResult] = await Promise.allSettled([
        agentHubApi.getSessionMembers(selectedSessionId),
        agentHubApi.getMessages(selectedSessionId),
      ]);

      if (cancelled) {
        return;
      }

      const conversationError =
        membersResult.status === 'rejected'
          ? toErrorMessage(membersResult.reason)
          : messagesResult.status === 'rejected'
            ? toErrorMessage(messagesResult.reason)
            : undefined;

      setErrors((current) => ({ ...current, conversation: conversationError }));

      if (membersResult.status === 'fulfilled') {
        setMembers(membersResult.value);
      }

      if (messagesResult.status === 'fulfilled') {
        setMessages(messagesResult.value);
      }

      setLoadingConversation(false);
    };

    void loadConversation();

    return () => {
      cancelled = true;
    };
  }, [selectedSessionId]);

  const selectedSession = sessions.find((session) => session.id === selectedSessionId) ?? null;
  const codeBlocks = useMemo<CodeBlockView[]>(
    () =>
      messages.flatMap((message) => {
        const senderName =
          message.senderName ||
          members.find((member) => member.memberId === message.senderId)?.name ||
          formatSenderType(message.senderType);

        return (message.codeBlocks ?? []).map((block) => ({
          ...block,
          messageId: message.id,
          senderName,
        }));
      }),
    [members, messages],
  );

  return (
    <main className="h-screen overflow-hidden bg-white text-neutral-950">
      <div className="h-screen lg:grid lg:grid-cols-[304px_minmax(0,1fr)] xl:grid-cols-[304px_minmax(0,1fr)_408px]">
        <SessionList
          agents={agents}
          errors={errors}
          loading={loadingIndex}
          onLogout={onLogout}
          onSelect={setSelectedSessionId}
          selectedSessionId={selectedSessionId}
          sessions={sessions}
          user={user}
        />
        <ChatArea
          agents={agents}
          conversationError={errors.conversation}
          loading={loadingConversation}
          members={members}
          messages={messages}
          selectedSession={selectedSession}
        />
        <WorkspacePanel codeBlocks={codeBlocks} />
      </div>
    </main>
  );
}

function RoutedApp() {
  const { initializing, isAuthenticated, logout, user } = useAuth();
  const [route, setRoute] = useState<RoutePath>(() => getRoutePath());

  const navigate = useCallback((path: RoutePath, mode: 'push' | 'replace' = 'push') => {
    if (typeof window !== 'undefined') {
      if (mode === 'replace') {
        window.history.replaceState(null, '', path);
      } else {
        window.history.pushState(null, '', path);
      }
    }

    setRoute(path);
  }, []);

  useEffect(() => {
    const handlePopState = () => setRoute(getRoutePath());

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (initializing) {
      return;
    }

    if (!isAuthenticated && route === '/') {
      navigate('/login', 'replace');
    }

    if (isAuthenticated && (route === '/login' || route === '/register')) {
      navigate('/', 'replace');
    }
  }, [initializing, isAuthenticated, navigate, route]);

  if (initializing) {
    return <AuthLoadingScreen />;
  }

  if (!isAuthenticated) {
    return route === '/register' ? <RegisterPage onNavigate={navigate} /> : <LoginPage onNavigate={navigate} />;
  }

  return (
    <WorkspaceApp
      onLogout={() => {
        logout();
        navigate('/login');
      }}
      user={user}
    />
  );
}

export function App() {
  return (
    <AuthProvider>
      <RoutedApp />
    </AuthProvider>
  );
}
