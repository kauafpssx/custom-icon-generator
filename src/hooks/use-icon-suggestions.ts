import { useState, useRef, useCallback, useEffect } from 'react';

export interface IconSuggestion {
  s: string;
  t: string;
  c: string;
}

interface UseIconSuggestionsOptions {
  apiKey: string;
}

export function useIconSuggestions({ apiKey }: UseIconSuggestionsOptions) {
  const [icons, setIcons] = useState<IconSuggestion[]>([]);
  const [suggestions, setSuggestions] = useState<IconSuggestion[]>([]);
  const [activeSlugParam, setActiveSlugParam] = useState<string | null>(null);

  const fetchingRef = useRef(false);
  const iconsRef = useRef<IconSuggestion[]>([]);
  const apiKeyRef = useRef(apiKey);

  useEffect(() => { apiKeyRef.current = apiKey; });
  useEffect(() => { iconsRef.current = icons; }, [icons]);

  const fetchIcons = useCallback(async (onLoaded?: (list: IconSuggestion[]) => void) => {
    if (iconsRef.current.length > 0 || fetchingRef.current) return;

    try {
      const cached = sessionStorage.getItem('__si_icons_v1__');
      if (cached) {
        const list = JSON.parse(cached) as IconSuggestion[];
        // Batch with onLoaded so caller can setValues in the same React tick
        setIcons(list);
        onLoaded?.(list);
        return;
      }
    } catch { /* sessionStorage unavailable */ }

    fetchingRef.current = true;
    try {
      const headers: HeadersInit = {};
      if (apiKeyRef.current.trim()) headers['X-API-Key'] = apiKeyRef.current.trim();
      const res = await fetch('/api/icons', { headers });
      const data: { title: string; slug: string; hex: string }[] = await res.json();
      const loaded = data.map((i) => ({ s: i.slug, t: i.title, c: i.hex }));
      setIcons(loaded);
      onLoaded?.(loaded);
      try { sessionStorage.setItem('__si_icons_v1__', JSON.stringify(loaded)); } catch { /* quota */ }
    } catch {
      fetchingRef.current = false;
    }
  // stable: apiKeyRef always fresh, iconsRef always fresh — no deps needed
  }, []);

  const updateQuery = useCallback((paramName: string, q: string) => {
    if (!q.trim()) {
      setSuggestions([]);
      setActiveSlugParam(null);
      return;
    }
    const ql = q.toLowerCase();
    const hits = iconsRef.current
      .filter((i) => i.s.includes(ql) || i.t.toLowerCase().includes(ql))
      .slice(0, 8);
    setSuggestions(hits);
    setActiveSlugParam(paramName);
  }, []);

  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
    setActiveSlugParam(null);
  }, []);

  return { icons, suggestions, activeSlugParam, fetchIcons, updateQuery, clearSuggestions };
}
