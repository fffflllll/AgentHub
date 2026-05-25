import { FormEvent, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  LogIn,
  Network,
  ShieldCheck,
  UserPlus,
  UserRound,
  Workflow,
} from 'lucide-react';
import { ApiError } from '../shared/api';
import { useAuth } from './AuthContext';

type AuthPageProps = {
  onNavigate: (path: '/login' | '/register' | '/') => void;
};

const toFormError = (reason: unknown) => {
  if (reason instanceof ApiError) {
    return reason.message;
  }

  if (reason instanceof Error) {
    return reason.message;
  }

  return '请求失败，请稍后重试';
};

function AuthLogo() {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-10 place-items-center rounded-lg bg-neutral-950 text-white shadow-sm">
        <Workflow size={20} strokeWidth={2.2} />
      </span>
      <span>
        <span className="block text-[15px] font-semibold text-neutral-950">AgentHub</span>
        <span className="block text-xs text-neutral-500">workspace auth</span>
      </span>
    </div>
  );
}

function BlueprintPanel() {
  return (
    <aside className="relative hidden min-h-screen overflow-hidden border-l border-neutral-200 bg-[#eef2e8] text-neutral-950 lg:block">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(20,24,18,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(20,24,18,0.055) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />
      <div className="relative flex h-full flex-col justify-between p-8">
        <div className="flex items-center justify-between">
          <span className="rounded-md border border-neutral-200 bg-white/75 px-2.5 py-1 text-xs font-medium text-neutral-500 shadow-sm">
            AUTH
          </span>
          <span className="block h-2 w-16 rounded-full bg-[#b8e85f]" />
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-neutral-200 bg-white/75 p-4 shadow-[0_18px_50px_rgba(40,52,28,0.12)] backdrop-blur">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-lg bg-[#c6f56f] text-neutral-950">
                  <ShieldCheck size={17} />
                </span>
                <span className="text-sm font-semibold">JWT Session</span>
              </div>
              <span className="text-xs text-neutral-400">7d</span>
            </div>
            <div className="mt-4 grid gap-2">
              <div className="h-2.5 w-4/5 rounded-full bg-neutral-200" />
              <div className="h-2.5 w-2/3 rounded-full bg-neutral-100" />
              <div className="h-2.5 w-5/6 rounded-full bg-neutral-100" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-neutral-200 bg-white/65 p-4 shadow-sm">
              <Network className="text-sky-500" size={20} />
              <div className="mt-6 h-2 w-20 rounded-full bg-neutral-200" />
              <div className="mt-2 h-2 w-12 rounded-full bg-neutral-100" />
            </div>
            <div className="rounded-lg border border-neutral-200 bg-white/65 p-4 shadow-sm">
              <KeyRound className="text-amber-500" size={20} />
              <div className="mt-6 h-2 w-16 rounded-full bg-neutral-200" />
              <div className="mt-2 h-2 w-24 rounded-full bg-neutral-100" />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white/65 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="size-2 rounded-full bg-emerald-400" />
            <span className="text-xs font-medium uppercase text-neutral-500">ready for workspace</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

function PasswordField({
  autoComplete,
  label,
  value,
  onChange,
}: {
  autoComplete: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="block">
      <span className="text-sm font-medium text-neutral-800">{label}</span>
      <span className="mt-2 flex h-11 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 transition focus-within:border-neutral-950 focus-within:ring-2 focus-within:ring-[#c6f56f]/70">
        <LockKeyhole className="shrink-0 text-neutral-400" size={17} />
        <input
          autoComplete={autoComplete}
          className="min-w-0 flex-1 bg-transparent text-sm text-neutral-950 outline-none placeholder:text-neutral-400"
          minLength={8}
          onChange={(event) => onChange(event.target.value)}
          placeholder="至少 8 位"
          required
          type={visible ? 'text' : 'password'}
          value={value}
        />
        <button
          aria-label={visible ? '隐藏密码' : '显示密码'}
          className="grid size-8 shrink-0 place-items-center rounded-md text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-950"
          onClick={() => setVisible((current) => !current)}
          type="button"
        >
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </span>
    </label>
  );
}

function AuthShell({
  children,
  eyebrow,
  title,
}: {
  children: ReactNode;
  eyebrow: string;
  title: string;
}) {
  return (
    <main className="min-h-screen bg-[#f7f8f4] text-neutral-950">
      <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_420px] xl:grid-cols-[minmax(0,1fr)_500px]">
        <section className="flex min-h-screen items-center justify-center px-5 py-8">
          <div className="w-full max-w-[420px]">
            <AuthLogo />
            <div className="mt-12">
              <p className="text-xs font-semibold uppercase text-neutral-400">{eyebrow}</p>
              <h1 className="mt-3 text-3xl font-semibold text-neutral-950">{title}</h1>
            </div>
            {children}
          </div>
        </section>
        <BlueprintPanel />
      </div>
    </main>
  );
}

export function LoginPage({ onNavigate }: AuthPageProps) {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await login({ username: username.trim(), password });
      onNavigate('/');
    } catch (reason) {
      setError(toFormError(reason));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell eyebrow="sign in" title="登录 AgentHub">
      <form className="mt-8 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm" onSubmit={handleSubmit}>
        <label className="block">
          <span className="text-sm font-medium text-neutral-800">用户名</span>
          <span className="mt-2 flex h-11 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 transition focus-within:border-neutral-950 focus-within:ring-2 focus-within:ring-[#c6f56f]/70">
            <UserRound className="shrink-0 text-neutral-400" size={17} />
            <input
              autoComplete="username"
              className="min-w-0 flex-1 bg-transparent text-sm text-neutral-950 outline-none placeholder:text-neutral-400"
              maxLength={20}
              minLength={2}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="2-20 个字符"
              required
              value={username}
            />
          </span>
        </label>

        <div className="mt-4">
          <PasswordField autoComplete="current-password" label="密码" onChange={setPassword} value={password} />
        </div>

        {error ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <button
          className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-neutral-950 px-4 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
          disabled={submitting}
          type="submit"
        >
          {submitting ? <Loader2 className="animate-spin" size={18} /> : <LogIn size={18} />}
          登录
        </button>
      </form>

      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-neutral-500">还没有账号？</span>
        <button
          className="flex items-center gap-1 font-semibold text-neutral-950 transition hover:text-neutral-600"
          onClick={() => onNavigate('/register')}
          type="button"
        >
          去注册
          <ArrowRight size={16} />
        </button>
      </div>
    </AuthShell>
  );
}

export function RegisterPage({ onNavigate }: AuthPageProps) {
  const { register } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await register({ username: username.trim(), password });
      onNavigate('/');
    } catch (reason) {
      setError(toFormError(reason));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell eyebrow="create account" title="注册 AgentHub">
      <form className="mt-8 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm" onSubmit={handleSubmit}>
        <label className="block">
          <span className="text-sm font-medium text-neutral-800">用户名</span>
          <span className="mt-2 flex h-11 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 transition focus-within:border-neutral-950 focus-within:ring-2 focus-within:ring-[#c6f56f]/70">
            <UserRound className="shrink-0 text-neutral-400" size={17} />
            <input
              autoComplete="username"
              className="min-w-0 flex-1 bg-transparent text-sm text-neutral-950 outline-none placeholder:text-neutral-400"
              maxLength={20}
              minLength={2}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="2-20 个字符"
              required
              value={username}
            />
          </span>
        </label>

        <div className="mt-4">
          <PasswordField autoComplete="new-password" label="密码" onChange={setPassword} value={password} />
          <p className="mt-2 text-xs leading-5 text-neutral-500">密码需要 8-100 位，并包含字母和数字。</p>
        </div>

        {error ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <button
          className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-neutral-950 px-4 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
          disabled={submitting}
          type="submit"
        >
          {submitting ? <Loader2 className="animate-spin" size={18} /> : <UserPlus size={18} />}
          注册并进入
        </button>
      </form>

      <div className="mt-4 flex items-center justify-between text-sm">
        <button
          className="flex items-center gap-1 font-semibold text-neutral-950 transition hover:text-neutral-600"
          onClick={() => onNavigate('/login')}
          type="button"
        >
          <ArrowLeft size={16} />
          返回登录
        </button>
      </div>
    </AuthShell>
  );
}

export function AuthLoadingScreen() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f8f4] text-neutral-950">
      <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3 shadow-sm">
        <Loader2 className="animate-spin text-neutral-500" size={18} />
        <span className="text-sm font-medium">正在恢复登录态</span>
      </div>
    </main>
  );
}
