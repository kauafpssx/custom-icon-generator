import { ENDPOINTS, API_TAGS, type ApiEndpoint, type ApiParam } from './api-endpoints';

// ── Postman Collection v2.1 ───────────────────────────────────────────────────

function buildPostmanUrl(baseUrl: string, ep: ApiEndpoint) {
  const pathParts = ep.path.replace(/^\//, '').split('/').map((seg) =>
    seg.startsWith('{') ? `:${seg.slice(1, -1)}` : seg
  );

  const queryParams = ep.params
    .filter((p) => p.loc === 'query')
    .map((p) => ({
      key: p.name,
      value: p.defaultValue ?? p.placeholder ?? '',
      description: p.desc,
      disabled: !p.required,
    }));

  const raw = (() => {
    let path = ep.path.replace(/\{(\w+)\}/g, ':$1');
    const qs = queryParams.filter((q) => !q.disabled);
    if (qs.length) path += '?' + qs.map((q) => `${q.key}=${q.value}`).join('&');
    return `{{base_url}}${path}`;
  })();

  return {
    raw,
    host: ['{{base_url}}'],
    path: pathParts,
    query: queryParams,
    variable: ep.params
      .filter((p) => p.loc === 'path')
      .map((p) => ({ key: p.name, value: p.defaultValue ?? p.placeholder ?? 'react' })),
  };
}

function buildPostmanItem(ep: ApiEndpoint, baseUrl: string) {
  return {
    name: ep.summary,
    request: {
      auth: { type: 'noauth' },
      method: 'GET',
      header: [
        {
          key: 'X-API-Key',
          value: '{{api_key}}',
          description: 'Optional. Omit for anonymous (30 req/min). Use Basic key (200 req/min) or Master key (unlimited).',
          disabled: true,
        },
      ],
      url: buildPostmanUrl(baseUrl, ep),
      description: ep.desc,
    },
    response: [],
  };
}

export function generatePostmanCollection(baseUrl: string): string {
  const items = API_TAGS.map((tag) => ({
    name: tag,
    item: ENDPOINTS.filter((e) => e.tag === tag).map((e) => buildPostmanItem(e, baseUrl)),
  }));

  const collection = {
    info: {
      _postman_id: crypto.randomUUID(),
      name: 'Custom Icon Generator API',
      description:
        'REST API for brand icons — SVG, PNG, ICO, and JSON formats.\n\n' +
        '**Rate limits**\n' +
        '- Anonymous (no key): 30 req/min per IP\n' +
        '- Basic key (`X-API-Key` header): 200 req/min\n' +
        '- Master key: unlimited\n\n' +
        `Base URL: ${baseUrl}`,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    auth: {
      type: 'apikey',
      apikey: [
        { key: 'key',   value: 'X-API-Key',   type: 'string' },
        { key: 'value', value: '{{api_key}}',  type: 'string' },
        { key: 'in',    value: 'header',       type: 'string' },
      ],
    },
    variable: [
      { key: 'base_url', value: baseUrl,  type: 'string' },
      { key: 'api_key',  value: '',        type: 'string', description: 'Leave empty for anonymous access' },
    ],
    item: items,
  };

  return JSON.stringify(collection, null, 2);
}

// ── Insomnia v4 Export ────────────────────────────────────────────────────────

let _idCounter = 0;
function uid(prefix: string) {
  return `${prefix}_${Date.now()}_${++_idCounter}`;
}

function buildInsomniaRequest(ep: ApiEndpoint, parentId: string, baseUrl: string) {
  const pathParams = ep.params.filter((p) => p.loc === 'path');
  const queryParams = ep.params.filter((p) => p.loc === 'query');

  let urlStr = `{{ _.base_url }}${ep.path}`;
  for (const p of pathParams) {
    urlStr = urlStr.replace(`{${p.name}}`, p.defaultValue ?? p.placeholder ?? 'react');
  }
  if (queryParams.length) {
    const qs = queryParams
      .filter((p) => p.required || p.defaultValue)
      .map((p) => `${p.name}=${p.defaultValue ?? p.placeholder ?? ''}`)
      .join('&');
    if (qs) urlStr += `?${qs}`;
  }

  const parameters: ApiParam[] = queryParams.map((p) => ({
    ...p,
    name: p.name,
  }));

  return {
    _id: uid('req'),
    _type: 'request',
    parentId,
    name: ep.summary,
    description: ep.desc,
    method: 'GET',
    url: urlStr,
    headers: [
      {
        name: 'X-API-Key',
        value: '{{ _.api_key }}',
        description: 'Optional API key for higher rate limits',
        disabled: true,
      },
    ],
    parameters: parameters.map((p) => ({
      name: p.name,
      value: p.defaultValue ?? p.placeholder ?? '',
      description: p.desc,
      disabled: !p.required && !p.defaultValue,
    })),
    body: {},
    authentication: {},
    metaSortKey: _idCounter * -1,
  };
}

export function generateInsomniaExport(baseUrl: string): string {
  _idCounter = 0;

  const workspaceId = uid('wrk');
  const envId = uid('env');

  const resources: object[] = [
    {
      _id: workspaceId,
      _type: 'workspace',
      name: 'Custom Icon Generator API',
      description: `REST API for brand icons. Base URL: ${baseUrl}`,
    },
    {
      _id: envId,
      _type: 'environment',
      parentId: workspaceId,
      name: 'Base Environment',
      data: {
        base_url: baseUrl,
        api_key: '',
      },
    },
  ];

  for (const tag of API_TAGS) {
    const folderId = uid('fld');
    resources.push({
      _id: folderId,
      _type: 'request_group',
      parentId: workspaceId,
      name: tag,
    });

    for (const ep of ENDPOINTS.filter((e) => e.tag === tag)) {
      resources.push(buildInsomniaRequest(ep, folderId, baseUrl));
    }
  }

  const exportObj = {
    _type: 'export',
    __export_format: 4,
    __export_date: new Date().toISOString(),
    __export_source: 'custom-icon-generator',
    resources,
  };

  return JSON.stringify(exportObj, null, 2);
}

// ── Download helper ───────────────────────────────────────────────────────────

export type CollectionFormat = 'postman' | 'insomnia';

export function downloadCollection(format: CollectionFormat): void {
  const baseUrl = window.location.origin;
  const content = format === 'postman'
    ? generatePostmanCollection(baseUrl)
    : generateInsomniaExport(baseUrl);

  const filename = format === 'postman'
    ? 'custom-icon-generator.postman_collection.json'
    : 'custom-icon-generator.insomnia.json';

  const blob = new Blob([content], { type: 'application/json' });
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(href);
}
