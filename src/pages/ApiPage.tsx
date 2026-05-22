import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { ENDPOINTS, API_TAGS, type ApiEndpoint } from '@/lib/api-endpoints';
import { EndpointModal } from '@/components/api/EndpointModal';

export default function ApiPage() {
  const [selected, setSelected] = useState<ApiEndpoint | null>(null);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 bg-background/90 backdrop-blur z-30">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-mono font-bold text-lg bg-gradient-to-r from-violet-500 to-indigo-500 bg-clip-text text-transparent">
              /api
            </span>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              {ENDPOINTS.length} endpoints
            </span>
          </div>
          <Link
            to="/"
            className="text-sm text-muted-foreground hover:text-foreground transition flex items-center gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" />
            Generator
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-8">
        <section>
          <h1 className="text-2xl font-bold">API Reference</h1>
          <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
            REST API for brand icons — SVG, PNG, and ICO formats. Click any endpoint to explore and
            test it interactively.
          </p>
          <div className="flex gap-2 mt-3 flex-wrap">
            {(['CORS: *', 'Cache: up to 1yr', 'JSON / SVG / PNG / ICO'] as const).map((tag) => (
              <span
                key={tag}
                className="text-[11px] px-2.5 py-1 rounded-full border text-muted-foreground font-mono"
              >
                {tag}
              </span>
            ))}
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
                    <span className="text-xs text-muted-foreground hidden sm:block truncate">
                      {ep.summary}
                    </span>
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
          open={!!selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
