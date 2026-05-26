import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ColorPicker } from '@/components/ColorPicker';
import { Copy, Play, Key } from 'lucide-react';
import type { ApiEndpoint } from '@/lib/api-endpoints';
import { RateLimitBar, type RateLimitInfo } from '@/components/api/RateLimitBar';
import { useIconSuggestions } from '@/hooks/use-icon-suggestions';
import { highlightJson } from '@/lib/json-highlight';
import type { RlSnapshot } from '@/hooks/use-rate-limit';

export type { RlSnapshot };

interface ResponseState {
  status: number;
  statusText: string;
  elapsed: number;
  contentType: string;
  body?: string;
  imageUrl?: string;
  requestUrl?: string;
  size?: number;
  truncated?: boolean;
  totalItems?: number;
  error?: string;
  rateLimit?: RateLimitInfo | null;
}

type ImageTab = 'preview' | 'markdown' | 'html' | 'css' | 'url';

function buildUrl(endpoint: ApiEndpoint, values: Record<string, string>): string {
  let path = endpoint.path;
  const qs = new URLSearchParams();

  for (const p of endpoint.params) {
    const v = values[p.name] ?? p.defaultValue ?? '';
    if (p.loc === 'path') {
      path = path.replace(`{${p.name}}`, v || p.placeholder || '');
    } else if (v) {
      if (p.isColor) {
        const clean = v.startsWith('#') ? v.slice(1) : v;
        if (clean) {
          if (p.name === 'color' && clean === '000000') continue;
          qs.set(p.name, clean);
        }
      } else {
        qs.set(p.name, v);
      }
    }
  }

  return `${window.location.origin}${path}${qs.toString() ? '?' + qs.toString() : ''}`;
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1_048_576) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / 1_048_576).toFixed(1)}MB`;
}

function renderDesc(desc: string, onToken: (token: string) => void): React.ReactNode {
  const parts = desc.split(/("(?:[^"]+)")/g);
  return parts.map((part, i) => {
    const match = part.match(/^"([^"]+)"$/);
    if (match) {
      return (
        <button
          key={i}
          type="button"
          onClick={() => onToken(match[1])}
          className="font-mono text-[10px] bg-muted border rounded px-1 py-0.5 text-muted-foreground hover:text-foreground hover:bg-accent transition cursor-pointer"
        >
          {match[1]}
        </button>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function extractRateLimit(res: Response) {
  const tier = res.headers.get('x-ratelimit-tier');
  if (!tier) return null;
  const limit     = res.headers.get('x-ratelimit-limit');
  const remaining = res.headers.get('x-ratelimit-remaining');
  const reset     = res.headers.get('x-ratelimit-reset');
  return {
    tier,
    limit:     limit     ? parseInt(limit)     : null,
    remaining: remaining ? parseInt(remaining) : null,
    reset:     reset     ? parseInt(reset)     : null,
  };
}

interface EndpointModalProps {
  endpoint: ApiEndpoint;
  open: boolean;
  onClose: () => void;
  apiKey?: string;
  onAfterExecute?: (rl: RlSnapshot | null) => void;
}

export function EndpointModal({ endpoint, open, onClose, apiKey = '', onAfterExecute }: EndpointModalProps) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const defaults: Record<string, string> = {};
    for (const p of endpoint.params) {
      if (p.defaultValue !== undefined) defaults[p.name] = p.defaultValue;
    }
    return defaults;
  });

  const [loading, setLoading]     = useState(false);
  const [response, setResponse]   = useState<ResponseState | null>(null);
  const [imageTab, setImageTab]   = useState<ImageTab>('preview');

  const { icons, suggestions, activeSlugParam, fetchIcons, updateQuery, clearSuggestions } =
    useIconSuggestions({ apiKey });

  const currentIconHex = useMemo(() => {
    const slugParam = endpoint.params.find((p) => p.isSlug);
    if (!slugParam || !icons.length) return null;
    const slug = values[slugParam.name];
    if (!slug) return null;
    return icons.find((i) => i.s === slug)?.c ?? null;
  }, [icons, values, endpoint.params]);

  useEffect(() => {
    if (endpoint.params.some((p) => p.isSlug)) {
      const slugParam = endpoint.params.find((p) => p.isSlug);
      fetchIcons((list) => {
        if (slugParam && list.length > 0) {
          const pick = list[Math.floor(Math.random() * list.length)];
          // Batch with setIcons (inside fetchIcons) — React 18 batches both into one render
          setValues((prev) => ({ ...prev, [slugParam.name]: pick.s }));
        }
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setValue = (name: string, val: string) =>
    setValues((prev) => ({ ...prev, [name]: val }));

  const handleSlugInput = (paramName: string, q: string) => {
    setValue(paramName, q);
    updateQuery(paramName, q);
  };

  const pickSlug = (paramName: string, slug: string) => {
    setValue(paramName, slug);
    clearSuggestions();
  };

  const currentUrl = buildUrl(endpoint, values);

  const execute = async () => {
    for (const p of endpoint.params) {
      if (p.required && !(values[p.name] ?? p.defaultValue)) return;
    }

    setLoading(true);
    setResponse(null);
    setImageTab('preview');

    const headers: HeadersInit = {};
    if (apiKey.trim()) headers['X-API-Key'] = apiKey.trim();

    const t0   = Date.now();
    const reqUrl = currentUrl;
    let rlFromResponse: RlSnapshot | null = null;

    try {
      const res     = await fetch(currentUrl, { headers, cache: 'no-store' });
      const elapsed = Date.now() - t0;
      const ct      = res.headers.get('content-type') ?? '';
      const clHeader = res.headers.get('content-length');
      const rateLimit = extractRateLimit(res);
      rlFromResponse  = rateLimit;

      if (ct.includes('json')) {
        const text = await res.text();
        let body = text;
        let truncated = false;
        let totalItems: number | undefined;

        if (text.length > 8000) {
          try {
            const data = JSON.parse(text);
            if (Array.isArray(data)) {
              totalItems = data.length;
              body = JSON.stringify(data.slice(0, 15), null, 2);
              truncated = true;
            } else {
              body = text.substring(0, 8000);
              truncated = true;
            }
          } catch {
            body = text.substring(0, 8000);
            truncated = true;
          }
        } else {
          try { body = JSON.stringify(JSON.parse(text), null, 2); } catch { /* ignore parsing errors */ }
        }

        setResponse({
          status: res.status, statusText: res.statusText, elapsed, contentType: ct,
          body, truncated, totalItems,
          size: clHeader ? parseInt(clHeader) : text.length,
          rateLimit,
        });
      } else {
        const blob = await res.blob();
        let displayUrl = reqUrl;
        const xColor = res.headers.get('X-Color');
        if (xColor) {
          displayUrl = reqUrl.replace(/color=random/gi, `color=${xColor}`);
        }
        setResponse({
          status: res.status, statusText: res.statusText, elapsed, contentType: ct,
          imageUrl: URL.createObjectURL(blob), requestUrl: displayUrl,
          size: blob.size, rateLimit,
        });
      }
    } catch (err) {
      setResponse({
        status: 0, statusText: 'Network Error',
        elapsed: Date.now() - t0, contentType: '', error: String(err),
      });
    } finally {
      setLoading(false);
      onAfterExecute?.(rlFromResponse);
    }
  };

  const copyUrl  = () => navigator.clipboard.writeText(currentUrl);
  const copyBody = () => response?.body && navigator.clipboard.writeText(response.body);

  const statusClass =
    response?.status && response.status >= 200 && response.status < 300
      ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
      : response?.status === 429
      ? 'bg-orange-500/15 text-orange-500 border-orange-500/30'
      : response?.status === 0
      ? 'bg-red-500/15 text-red-500 border-red-500/30'
      : 'bg-orange-500/15 text-orange-500 border-orange-500/30';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-2xl p-0 gap-0"
        style={{ display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}
      >
        {/* Header */}
        <DialogHeader className="px-5 py-4 border-b space-y-1.5 shrink-0">
          <DialogTitle className="flex items-center gap-2.5">
            <span className="text-[11px] font-bold font-mono px-2 py-0.5 rounded border bg-blue-500/10 text-blue-500 border-blue-500/20">
              GET
            </span>
            <code className="font-mono text-sm">{endpoint.path}</code>
            {apiKey && (
              <span className="ml-auto flex items-center gap-1 text-[10px] font-mono text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                <Key className="h-2.5 w-2.5" /> key active
              </span>
            )}
          </DialogTitle>
          <DialogDescription>{endpoint.desc}</DialogDescription>
        </DialogHeader>

        {/* Scrollable body */}
        <div data-lenis-prevent style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <div className="px-5 py-5 flex flex-col gap-5">

          {/* Parameters */}
          {endpoint.params.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Parameters</h3>
              {endpoint.params.map((p) => (
                <div key={p.name} className="border rounded-xl overflow-visible">
                  <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-b">
                    <span className="font-mono text-sm font-medium">{p.name}</span>
                    {p.required ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-500 border border-rose-500/20 font-semibold">required</span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border font-medium">optional</span>
                    )}
                    <span className="text-[11px] font-mono text-muted-foreground ml-auto">{p.loc}</span>
                  </div>
                  <div className="px-3 py-2.5 flex flex-col gap-1.5">
                    <p className="text-xs text-muted-foreground">
                      {renderDesc(p.desc, (token) => setValue(p.name, token))}
                    </p>

                    {p.isColor ? (
                      <div className="flex items-center gap-2">
                        {p.name === 'background' ? (
                          values[p.name]?.toLowerCase() === 'transparent' ? (
                            <div
                              className="h-10 w-10 rounded border-2 shrink-0"
                              style={{ backgroundImage: 'repeating-conic-gradient(#d0d0d0 0% 25%, #ffffff 0% 50%)', backgroundSize: '8px 8px' }}
                              title="Transparent background"
                            />
                          ) : values[p.name]?.toLowerCase() === 'default' ? (
                            <div
                              className="h-10 w-10 rounded border-2 shrink-0 bg-white"
                              title="White background"
                            />
                          ) : (
                            <ColorPicker
                              value={
                                values[p.name] && /^#[0-9A-F]{6}$/i.test(values[p.name])
                                  ? values[p.name]
                                  : '#000000'
                              }
                              onChange={(v) => setValue(p.name, v)}
                            />
                          )
                        ) : values[p.name]?.toLowerCase() === 'random' ? (
                          <div
                            className="h-10 w-10 rounded border-2 shrink-0"
                            style={{ background: 'conic-gradient(in hsl longer hue, red 0%, red 100%)' }}
                            title="Random color"
                          />
                        ) : (
                          <ColorPicker
                            value={
                              (!values[p.name] || values[p.name] === 'brand') && currentIconHex
                                ? `#${currentIconHex}`
                                : values[p.name] || '#000000'
                            }
                            onChange={(v) => setValue(p.name, v)}
                          />
                        )}
                        <Input
                          value={values[p.name] ?? ''}
                          onChange={(e) => setValue(p.name, e.target.value)}
                          placeholder={p.placeholder || 'brand'}
                          className="font-mono w-32 text-sm"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-muted-foreground h-8"
                          onClick={() => setValue(p.name, p.defaultValue ?? '')}
                        >
                          Reset
                        </Button>
                      </div>
                    ) : p.isSlug ? (
                      <div className="relative">
                        {values[p.name] && icons.some((i) => i.s === values[p.name]) && (
                          <img
                            src={`/api/asset/${values[p.name]}.svg?background=transparent${currentIconHex ? `&color=${currentIconHex}` : ''}`}
                            alt=""
                            aria-hidden="true"
                            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none z-10"
                          />
                        )}
                        <Input
                          value={values[p.name] ?? ''}
                          onChange={(e) => handleSlugInput(p.name, e.target.value)}
                          onFocus={() => {
                            fetchIcons();
                            handleSlugInput(p.name, values[p.name] ?? '');
                          }}
                          onBlur={() => setTimeout(() => clearSuggestions(), 150)}
                          placeholder={p.placeholder}
                          className={`font-mono text-sm${values[p.name] ? ' pl-8' : ''}`}
                        />
                        {activeSlugParam === p.name && suggestions.length > 0 && (
                          <div data-lenis-prevent className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-lg shadow-xl z-50 overflow-hidden max-h-44 overflow-y-auto">
                            {suggestions.map((i) => (
                              <button
                                key={i.s}
                                className="w-full text-left px-3 py-2 hover:bg-accent flex items-center gap-2.5 text-xs transition"
                                onMouseDown={() => pickSlug(p.name, i.s)}
                              >
                                <img
                                  src={`/api/asset/${i.s}.svg?background=transparent&color=${i.c}`}
                                  alt=""
                                  aria-hidden="true"
                                  className="w-4 h-4 shrink-0"
                                />
                                <span className="font-mono text-foreground">{i.s}</span>
                                <span className="text-muted-foreground truncate">{i.t}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <Input
                        type={p.type === 'integer' ? 'number' : 'text'}
                        value={values[p.name] ?? ''}
                        onChange={(e) => setValue(p.name, e.target.value)}
                        placeholder={p.placeholder}
                        className="font-mono text-sm"
                        min={p.type === 'integer' ? 1 : undefined}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* URL preview */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-mono">Request URL</span>
              <button
                onClick={copyUrl}
                className="text-xs text-violet-400 hover:text-violet-300 font-medium flex items-center gap-1 transition"
              >
                <Copy className="h-3 w-3" /> Copy
              </button>
            </div>
            <div className="bg-muted/50 border rounded-lg px-3 py-2 font-mono text-xs text-foreground overflow-x-auto whitespace-nowrap">
              {currentUrl}
            </div>
            {apiKey && (
              <div className="bg-muted/50 border rounded-lg px-3 py-2 font-mono text-xs text-muted-foreground flex items-center gap-2">
                <Key className="h-3 w-3 shrink-0" />
                <span className="text-muted-foreground">X-API-Key:</span>
                <span className="text-foreground tracking-widest">{'•'.repeat(Math.min(apiKey.length, 20))}</span>
              </div>
            )}
          </div>

          {/* Execute button */}
          <Button onClick={execute} disabled={loading} className="w-full gap-2">
            <Play className="h-4 w-4" />
            {loading ? 'Executing…' : 'Execute'}
          </Button>

          {/* Response */}
          {response && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Response</span>
                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${statusClass}`}>
                  {response.status || 'ERR'} {response.statusText}
                </span>
                <span className="text-xs text-muted-foreground font-mono ml-auto">
                  {response.elapsed}ms{response.size ? ` · ${fmtBytes(response.size)}` : ''}
                </span>
              </div>

              {response.rateLimit && <RateLimitBar rl={response.rateLimit} />}

              <div className="border rounded-xl overflow-hidden bg-background">
                {response.error && (
                  <div className="p-4 text-sm text-red-500 font-mono">{response.error}</div>
                )}

                {response.imageUrl && (() => {
                  const slug = values['slug'] ?? 'icon';
                  const url  = response.requestUrl ?? '';
                  const tabs: { id: ImageTab; label: string }[] = [
                    { id: 'preview',  label: 'Preview'  },
                    { id: 'markdown', label: 'Markdown' },
                    { id: 'html',     label: 'HTML'     },
                    { id: 'css',      label: 'CSS'      },
                    { id: 'url',      label: 'URL'      },
                  ];
                  const snippets: Record<Exclude<ImageTab, 'preview'>, string> = {
                    markdown: `![${slug}](${url})`,
                    html:     `<img src="${url}" alt="${slug}" />`,
                    css:      `background-image: url('${url}');`,
                    url,
                  };
                  return (
                    <>
                      <div className="flex border-b">
                        {tabs.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => setImageTab(t.id)}
                            className={`px-3 py-2 text-xs font-medium transition-colors ${
                              imageTab === t.id
                                ? 'border-b-2 border-primary text-foreground -mb-px'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                      {imageTab === 'preview' ? (
                        <div
                          className="p-5 flex items-center justify-center min-h-[120px]"
                          style={{
                            backgroundImage: 'repeating-conic-gradient(#d0d0d0 0% 25%, #ffffff 0% 50%)',
                            backgroundSize: '16px 16px',
                          }}
                        >
                          <img src={response.imageUrl} alt={slug} className="max-h-48 object-contain" />
                        </div>
                      ) : (
                        <div className="relative">
                          <pre className="p-4 text-[11px] font-mono leading-relaxed whitespace-pre-wrap break-all text-emerald-400">
                            {snippets[imageTab]}
                          </pre>
                          <button
                            onClick={() => navigator.clipboard.writeText(snippets[imageTab])}
                            className="absolute top-2 right-2 text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition"
                          >
                            <Copy className="h-3 w-3" /> Copy
                          </button>
                        </div>
                      )}
                    </>
                  );
                })()}

                {response.body && (
                  <>
                    <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
                      <span className="text-[11px] font-mono text-muted-foreground">{response.contentType}</span>
                      <button
                        onClick={copyBody}
                        className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition"
                      >
                        <Copy className="h-3 w-3" /> Copy
                      </button>
                    </div>
                    <pre data-lenis-prevent className="p-4 text-[11px] font-mono leading-relaxed overflow-auto max-h-72">
                      <code dangerouslySetInnerHTML={{ __html: highlightJson(response.body) }} />
                    </pre>
                    {response.truncated && (
                      <p className="px-4 pb-3 text-[11px] text-muted-foreground">
                        {response.totalItems
                          ? `Showing 15 of ${response.totalItems} items.`
                          : 'Response truncated.'}{' '}
                        Copy for full content.
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
