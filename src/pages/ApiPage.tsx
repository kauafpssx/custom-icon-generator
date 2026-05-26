import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Download, Key, Eye, EyeOff, X } from 'lucide-react';
import { ENDPOINTS, API_TAGS, type ApiEndpoint } from '@/lib/api-endpoints';
import { EndpointModal } from '@/components/api/EndpointModal';
import { downloadCollection, type CollectionFormat } from '@/lib/api-collection';
import { useRateLimit } from '@/hooks/use-rate-limit';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const LS_KEY = 'api_key';

function tierColor(tier: string, remaining: number | null, limit: number | null) {
  if (tier === 'master') return 'text-violet-500';
  if (remaining === null || limit === null) return 'text-muted-foreground';
  const ratio = remaining / limit;
  if (ratio > 0.5) return 'text-emerald-500';
  if (ratio > 0.1) return 'text-amber-500';
  return 'text-red-500';
}

function dotColor(tier: string, remaining: number | null, limit: number | null) {
  if (tier === 'master') return 'bg-violet-500';
  if (remaining === null || limit === null) return 'bg-muted-foreground';
  const ratio = remaining / limit;
  if (ratio > 0.5) return 'bg-emerald-500';
  if (ratio > 0.1) return 'bg-amber-500';
  return 'bg-red-500';
}

export default function ApiPage() {
  const [selected, setSelected]   = useState<ApiEndpoint | null>(null);
  const [apiKey, setApiKey]       = useState<string>(() => localStorage.getItem(LS_KEY) ?? '');
  const [showKey, setShowKey]     = useState(false);

  const { rlStatus, countdown, applyRlSnapshot, checkRateLimit } = useRateLimit(apiKey);

  const handleKeyChange = (val: string) => {
    setApiKey(val);
    if (val) localStorage.setItem(LS_KEY, val);
    else localStorage.removeItem(LS_KEY);
  };

  const { tier, limit, remaining } = rlStatus;
  const isUnlimited = tier === 'master';

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 bg-background/90 backdrop-blur z-30">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 shrink-0">
            <span className="font-mono font-bold text-lg bg-gradient-to-r from-violet-500 to-indigo-500 bg-clip-text text-transparent">
              /api
            </span>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              {ENDPOINTS.length} endpoints
            </span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {/* Rate limit chip */}
            {!rlStatus.loading && (
              <span className={`hidden sm:flex items-center gap-1.5 text-[11px] font-mono font-medium ${tierColor(tier, remaining, limit)}`}>
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor(tier, remaining, limit)}`} />
                {isUnlimited
                  ? 'master · ∞'
                  : limit !== null
                  ? remaining !== null
                    ? `${tier} · ${remaining}/${limit}${countdown !== null ? ` · ${countdown}s` : ''}`
                    : `${tier} · ?/${limit}`
                  : tier}
              </span>
            )}

            {/* Authorize popover */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={apiKey ? 'secondary' : 'outline'}
                  size="sm"
                  className="gap-1.5 text-xs h-8"
                >
                  <Key className="h-3.5 w-3.5" />
                  {apiKey ? 'Authorized' : 'Authorize'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-4" align="end">
                <div className="flex flex-col gap-3">
                  <div>
                    <p className="text-sm font-semibold">API Key</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Stored locally. Sent via <code className="text-[10px] bg-muted px-1 py-0.5 rounded">X-API-Key</code> header on every request.
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <div className="relative flex-1">
                      <Input
                        type={showKey ? 'text' : 'password'}
                        value={apiKey}
                        onChange={(e) => handleKeyChange(e.target.value)}
                        placeholder="Paste your API key…"
                        className="font-mono text-xs pr-8 h-8"
                        autoComplete="off"
                        spellCheck={false}
                      />
                      <button
                        type="button"
                        onClick={() => setShowKey((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                      >
                        {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    {apiKey && (
                      <button
                        type="button"
                        onClick={() => handleKeyChange('')}
                        className="text-muted-foreground hover:text-foreground transition"
                        title="Clear key"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {/* Live rate limit status */}
                  <div className="rounded-lg border bg-muted/30 px-3 py-2.5 flex items-center gap-2.5">
                    {rlStatus.loading ? (
                      <span className="text-xs text-muted-foreground">Checking…</span>
                    ) : rlStatus.error ? (
                      <span className="text-xs text-red-500">Could not reach API</span>
                    ) : (
                      <>
                        <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor(tier, remaining, limit)}`} />
                        <div className="flex flex-col gap-0.5">
                          <span className={`text-xs font-semibold font-mono ${tierColor(tier, remaining, limit)}`}>
                            {isUnlimited ? 'master — unlimited' : tier}
                          </span>
                          {!isUnlimited && limit !== null && (
                            <span className="text-[11px] text-muted-foreground">
                              {remaining ?? '—'} / {limit} req/min remaining
                            </span>
                          )}
                          {countdown !== null && (
                            <span className="text-[11px] text-muted-foreground font-mono">
                              resets in {countdown}s
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => checkRateLimit(apiKey)}
                          className="ml-auto text-[10px] text-muted-foreground hover:text-foreground transition"
                        >
                          Refresh
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
                  <Download className="h-3.5 w-3.5" />
                  Import collection
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => downloadCollection('postman' as CollectionFormat)}>
                  Postman collection
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => downloadCollection('insomnia' as CollectionFormat)}>
                  Insomnia export
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Link
              to="/"
              className="text-sm text-muted-foreground hover:text-foreground transition flex items-center gap-1.5 shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Generator</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-8">
        <section>
          <h1 className="text-2xl font-bold">API Reference</h1>
          <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
            REST API for brand icons — SVG, PNG, and ICO formats. Click any endpoint to explore and test it interactively.
          </p>
          <div className="flex gap-2 mt-3 flex-wrap">
            {(['CORS: *', 'Cache: up to 1yr', 'JSON / SVG / PNG / ICO', 'Rate limited'] as const).map((tag) => (
              <span key={tag} className="text-[11px] px-2.5 py-1 rounded-full border text-muted-foreground font-mono">
                {tag}
              </span>
            ))}
          </div>
        </section>

        <section className="rounded-xl border bg-muted/30 px-4 py-3.5 text-sm space-y-1.5">
          <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Rate limits</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-xs font-bold">Anonymous</span>
              <span className="text-xs text-muted-foreground">30 req / min · per IP</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-xs font-bold">Basic key</span>
              <span className="text-xs text-muted-foreground">200 req / min · per key</span>
              <code className="text-[10px] text-muted-foreground">X-API-Key: &lt;key&gt;</code>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-xs font-bold">Master key</span>
              <span className="text-xs text-muted-foreground">Unlimited</span>
              <code className="text-[10px] text-muted-foreground">X-API-Key: &lt;key&gt;</code>
            </div>
          </div>
        </section>

        <div className="flex flex-col gap-4">
          {API_TAGS.map((tag) => {
            const eps = ENDPOINTS.filter((e) => e.tag === tag);
            return (
              <div key={tag} className="border rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-muted/40 border-b flex items-center gap-2">
                  <span className="text-sm font-semibold">{tag}</span>
                  <span className="text-xs text-muted-foreground">
                    {eps.length} endpoint{eps.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {eps.map((ep, i) => (
                  <button
                    key={ep.id}
                    onClick={() => setSelected(ep)}
                    className={`w-full text-left px-4 py-3.5 flex items-center gap-3 hover:bg-muted/50 transition ${
                      i < eps.length - 1 ? 'border-b' : ''
                    }`}
                  >
                    <span className="text-[11px] font-bold font-mono px-1.5 py-0.5 rounded border bg-blue-500/10 text-blue-500 border-blue-500/20 w-10 text-center shrink-0">
                      GET
                    </span>
                    <code className="font-mono text-sm shrink-0">{ep.path}</code>
                    <span className="text-xs text-muted-foreground hidden sm:block truncate">{ep.summary}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </main>

      {selected && (
        <EndpointModal
          key={selected.id}
          endpoint={selected}
          apiKey={apiKey}
          open={!!selected}
          onClose={() => setSelected(null)}
          onAfterExecute={(rl) => { if (rl) applyRlSnapshot(rl); }}
        />
      )}
    </div>
  );
}
