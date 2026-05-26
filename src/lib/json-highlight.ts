export function highlightJson(json: string): string {
  const escaped = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return escaped.replace(
    /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\btrue\b|\bfalse\b|\bnull\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    (match) => {
      if (/^"/.test(match)) {
        if (/:$/.test(match)) return `<span class="text-violet-400">${match}</span>`;
        return `<span class="text-emerald-400">${match}</span>`;
      }
      if (/true|false/.test(match)) return `<span class="text-orange-400">${match}</span>`;
      if (/null/.test(match)) return `<span class="text-slate-400">${match}</span>`;
      return `<span class="text-cyan-400">${match}</span>`;
    }
  );
}
