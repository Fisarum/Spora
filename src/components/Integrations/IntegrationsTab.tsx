import { useState, useEffect } from "react";
import { Copy, Check, RefreshCw, Terminal, Code2, Zap, Bot } from "lucide-react";
import { keysApi, settingsApi } from "../../lib/tauri";
import type { SporaKey } from "../../lib/types";

interface SnippetBlockProps {
  label: string;
  value: string;
}

function SnippetBlock({ label, value }: SnippetBlockProps) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div className="space-y-1">
      <span className="text-[9px] uppercase tracking-widest text-foreground/40 font-medium">{label}</span>
      <div className="flex items-center gap-2 bg-background/60 border border-primary/5 rounded px-3 py-2">
        <code className="text-[11px] font-mono text-foreground/70 flex-1 break-all">{value}</code>
        <button
          onClick={copy}
          className="p-1 text-foreground/30 hover:text-foreground/70 hover:bg-foreground/10 rounded transition-all flex-shrink-0"
        >
          {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
        </button>
      </div>
    </div>
  );
}

interface CodeBlockProps {
  code: string;
}
function CodeBlock({ code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div className="relative group/code">
      <pre className="bg-background/80 border border-primary/5 rounded p-3 text-[10px] font-mono text-foreground/60 overflow-x-auto whitespace-pre-wrap">
        {code}
      </pre>
      <button
        onClick={copy}
        className="absolute top-2 right-2 p-1 rounded text-foreground/20 hover:text-foreground/60 hover:bg-foreground/10 transition-all"
      >
        {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
      </button>
    </div>
  );
}

interface ToolCardProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}
function ToolCard({ icon, title, subtitle, children }: ToolCardProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded border border-primary/5 bg-white/1 overflow-hidden">
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-primary/5 transition-all text-left"
      >
        <div className="w-8 h-8 rounded bg-primary/10 border border-primary/10 flex items-center justify-center flex-shrink-0 text-primary">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-medium text-foreground">{title}</div>
          <div className="text-[9px] text-foreground/40 uppercase tracking-wider mt-0.5">{subtitle}</div>
        </div>
        <span className="text-[9px] uppercase tracking-wider text-foreground/30 px-2 py-1 rounded border border-primary/10 bg-primary/5 hover:bg-primary/10 transition-all">
          {open ? "Hide" : "Setup"}
        </span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-primary/5 pt-4">
          {children}
        </div>
      )}
    </div>
  );
}

export default function IntegrationsTab() {
  const [sporaKeys, setSporaKeys] = useState<SporaKey[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState<string>("");
  const [gatewayPort, setGatewayPort] = useState(4141);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [keys, status] = await Promise.all([
          keysApi.listSporaKeys(),
          settingsApi.getGatewayStatus(),
        ]);
        const active = keys.filter((k) => k.active);
        setSporaKeys(active);
        if (active.length > 0) setSelectedKeyId(active[0].id);
        setGatewayPort(status.port);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const selectedKey = sporaKeys.find((k) => k.id === selectedKeyId);
  const token = selectedKey?.token ?? "sk-spora-YOUR_TOKEN";
  const baseUrl = `http://localhost:${gatewayPort}/v1`;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw size={20} className="text-foreground animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-5 space-y-6 bg-background">
      {/* Key Selector */}
      <div className="rounded border border-primary/10 bg-white/2 p-4 space-y-3">
        <div>
          <h2 className="text-[10px] tracking-wider text-foreground uppercase font-medium">Integration Setup</h2>
          <p className="text-[9px] text-foreground/40 uppercase tracking-widest mt-0.5">
            Select a Spora Key to generate tool-specific config snippets
          </p>
        </div>
        {sporaKeys.length === 0 ? (
          <p className="text-[10px] text-foreground/40 uppercase tracking-wider py-2">
            No active keys — create one in the Keys Wallet tab first
          </p>
        ) : (
          <select
            value={selectedKeyId}
            onChange={(e) => setSelectedKeyId(e.target.value)}
            className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-[11px] text-foreground focus:outline-none focus:border-primary/50 transition-all font-mono uppercase"
          >
            {sporaKeys.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label} {k.location ? `· ${k.location}` : ""}
              </option>
            ))}
          </select>
        )}
        <div className="grid grid-cols-2 gap-3">
          <SnippetBlock label="Base URL" value={baseUrl} />
          <SnippetBlock label="API Key" value={token} />
        </div>
      </div>

      {/* Tool Guides */}
      <div className="space-y-3">
        <h2 className="text-[10px] tracking-wider text-foreground/60 uppercase font-medium px-1">
          Tool Integration Guides
        </h2>

        {/* Cursor */}
        <ToolCard
          icon={<Code2 size={15} />}
          title="Cursor"
          subtitle="AI-powered code editor · OpenAI-compatible"
        >
          <p className="text-[10px] text-foreground/50">
            In Cursor Settings → Models → Add a custom model provider:
          </p>
          <SnippetBlock label="API Base URL" value={baseUrl} />
          <SnippetBlock label="API Key" value={token} />
          <p className="text-[10px] text-foreground/50 mt-1">
            Then in the model field, enter any model ID from the Model Discovery panel (e.g.{" "}
            <code className="text-primary text-[10px]">openai/gpt-4.1</code> or{" "}
            <code className="text-primary text-[10px]">anthropic/claude-sonnet-4</code>).
          </p>
        </ToolCard>

        {/* GitHub Copilot */}
        <ToolCard
          icon={<Terminal size={15} />}
          title="GitHub Copilot"
          subtitle="VS Code · OpenAI-compatible endpoint override"
        >
          <p className="text-[10px] text-foreground/50">
            In VS Code, open <code className="text-primary">Settings (JSON)</code> and add:
          </p>
          <CodeBlock
            code={`{
  "github.copilot.advanced": {
    "debug.overrideEngine": "openai/gpt-4.1",
    "debug.overrideChatEngine": "openai/gpt-4.1",
    "debug.overrideProxyUrl": "${baseUrl}",
    "authProvider": "none"
  }
}`}
          />
          <p className="text-[10px] text-foreground/50 mt-1">
            Set the <code className="text-primary">OPENAI_API_KEY</code> environment variable before launching VS Code:
          </p>
          <CodeBlock
            code={`export OPENAI_API_KEY="${token}"
code .`}
          />
          <p className="text-[10px] text-foreground/50 mt-1">
            Replace the model ID with any model from the Model Discovery panel.
          </p>
        </ToolCard>

        {/* Cline */}
        <ToolCard
          icon={<Code2 size={15} />}
          title="Cline"
          subtitle="VS Code extension · OpenAI-compatible"
        >
          <p className="text-[10px] text-foreground/50">
            In VS Code, open the Cline extension settings and select <code className="text-primary">OpenAI Compatible</code> as the API provider, then fill in:
          </p>
          <SnippetBlock label="Base URL" value={baseUrl} />
          <SnippetBlock label="API Key" value={token} />
          <p className="text-[10px] text-foreground/50 mt-1">
            In the <code className="text-primary">Model ID</code> field, enter any model ID (e.g.{" "}
            <code className="text-primary text-[10px]">anthropic/claude-sonnet-4</code> or{" "}
            <code className="text-primary text-[10px]">openai/gpt-4.1</code>).
          </p>
          <p className="text-[10px] text-foreground/50 mt-1">
            Spora handles all provider translation — Cline only needs the OpenAI-compatible interface.
          </p>
        </ToolCard>

        {/* Claude Code */}
        <ToolCard
          icon={<Bot size={15} />}
          title="Claude Code"
          subtitle="Anthropic CLI · ANTHROPIC_BASE_URL override"
        >
          <p className="text-[10px] text-foreground/50">
            Spora translates Anthropic-format requests. Set environment variables before running{" "}
            <code className="text-primary">claude</code>:
          </p>
          <CodeBlock
            code={`export ANTHROPIC_BASE_URL="${baseUrl}"
export ANTHROPIC_API_KEY="${token}"

# Then run Claude Code normally:
claude`}
          />
          <p className="text-[10px] text-foreground/50 mt-2">
            Or add to your shell profile (<code className="text-primary">~/.zshrc</code> /{" "}
            <code className="text-primary">~/.bashrc</code>):
          </p>
          <CodeBlock
            code={`# Spora Gateway for Claude Code
export ANTHROPIC_BASE_URL="${baseUrl}"
export ANTHROPIC_API_KEY="${token}"`}
          />
        </ToolCard>

        {/* OpenCode */}
        <ToolCard
          icon={<Zap size={15} />}
          title="OpenCode"
          subtitle="Terminal AI coding assistant · OpenAI-compatible"
        >
          <p className="text-[10px] text-foreground/50">
            Configure OpenCode to use Spora as the OpenAI-compatible endpoint:
          </p>
          <CodeBlock
            code={`# ~/.config/opencode/config.json
{
  "provider": "openai",
  "model": "openai/gpt-4.1",
  "openai": {
    "apiKey": "${token}",
    "baseUrl": "${baseUrl}"
  }
}`}
          />
          <p className="text-[10px] text-foreground/50 mt-1">
            Or via environment:
          </p>
          <CodeBlock
            code={`export OPENAI_API_KEY="${token}"
export OPENAI_BASE_URL="${baseUrl}"
opencode`}
          />
        </ToolCard>

        {/* Pi / Inflection */}
        <ToolCard
          icon={<Bot size={15} />}
          title="Pi / Any OpenAI-Compatible Tool"
          subtitle="Generic OpenAI-compatible setup"
        >
          <p className="text-[10px] text-foreground/50">
            For any tool that supports custom OpenAI-compatible endpoints (Aider, Shell-GPT, LiteLLM, etc.):
          </p>
          <div className="grid grid-cols-2 gap-3">
            <SnippetBlock label="OPENAI_BASE_URL" value={baseUrl} />
            <SnippetBlock label="OPENAI_API_KEY" value={token} />
          </div>
          <CodeBlock
            code={`# Generic shell setup
export OPENAI_API_KEY="${token}"
export OPENAI_BASE_URL="${baseUrl}"

# Aider
aider --openai-api-key ${token} --openai-api-base ${baseUrl}

# Shell-GPT
sgpt --api-key ${token} --api-url ${baseUrl}`}
          />
        </ToolCard>
      </div>

      {/* Notes */}
      <div className="rounded border border-primary/5 bg-white/1 p-4 space-y-2">
        <h3 className="text-[9px] uppercase tracking-widest text-foreground/40 font-medium">Protocol Notes</h3>
        <ul className="space-y-1.5 text-[10px] text-foreground/50">
          <li>• Use full OpenRouter-style model IDs: <code className="text-primary text-[10px]">provider/model-name</code></li>
          <li>• Spora auto-translates Anthropic and Gemini formats — standard OpenAI clients work with all models</li>
          <li>• The gateway runs locally — zero data leaves your machine before routing</li>
          <li>• Spend caps and provider restrictions are enforced per Spora Key</li>
        </ul>
      </div>
    </div>
  );
}
