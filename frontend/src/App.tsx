import { MessageSquare, Settings, Workflow } from 'lucide-react';
import { config } from './shared/config';

const milestones = [
  'Provider settings',
  'Single-agent chat',
  'Streaming WebSocket',
  'Diff review',
];

export function App() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="grid min-h-screen grid-cols-[280px_1fr_360px]">
        <aside className="border-r border-slate-800 bg-slate-900/80 p-5">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded bg-cyan-400 text-slate-950">
              <Workflow size={22} />
            </div>
            <div>
              <h1 className="text-lg font-semibold">AgentHub</h1>
              <p className="text-xs text-slate-400">multi-agent workspace</p>
            </div>
          </div>

          <div className="mt-8 space-y-3">
            {milestones.map((item, index) => (
              <button
                className="flex w-full items-center gap-3 rounded border border-slate-800 bg-slate-900 px-3 py-2 text-left text-sm text-slate-300"
                key={item}
                type="button"
              >
                <span className="grid size-7 place-items-center rounded bg-slate-800 text-xs text-cyan-300">
                  {index + 1}
                </span>
                {item}
              </button>
            ))}
          </div>
        </aside>

        <section className="flex flex-col">
          <header className="flex h-16 items-center justify-between border-b border-slate-800 px-6">
            <div>
              <p className="text-sm text-slate-400">M1 scaffold</p>
              <h2 className="font-semibold">Single Agent Conversation</h2>
            </div>
            <button className="grid size-10 place-items-center rounded border border-slate-800 text-slate-300" type="button">
              <Settings size={18} />
            </button>
          </header>

          <div className="flex flex-1 items-center justify-center px-8">
            <div className="max-w-xl text-center">
              <div className="mx-auto grid size-16 place-items-center rounded bg-cyan-400 text-slate-950">
                <MessageSquare size={30} />
              </div>
              <h3 className="mt-6 text-3xl font-semibold tracking-tight">Ready for the first chat loop</h3>
              <p className="mt-4 text-slate-400">
                Frontend, Java API, Python AI worker, MySQL, and Redis now have a place to land.
                The next implementation slice wires authentication, provider settings, and streaming chat.
              </p>
              <p className="mt-6 rounded border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-400">
                API: {config.apiUrl} · WS: {config.wsUrl}
              </p>
            </div>
          </div>
        </section>

        <aside className="border-l border-slate-800 bg-slate-900/70 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Workspace</h2>
          <div className="mt-5 rounded border border-slate-800 bg-slate-950 p-4">
            <p className="text-sm font-medium">Diff and preview panel</p>
            <p className="mt-2 text-sm text-slate-500">This panel will host file trees, Monaco Diff, and iframe previews.</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
