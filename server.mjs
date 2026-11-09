#!/usr/bin/env node
// MCP local de EspoCRM (DTR). Sin dependencias. Transporte stdio, JSON-RPC por líneas. Licencia GPL-3.0.
// Variables: ESPOCRM_URL (p. ej. https://tu-crm.example.com), ESPOCRM_API_KEY (clave del usuario API).
// Sin herramienta de borrado a propósito.
import readline from 'node:readline';

const BASE = (process.env.ESPOCRM_URL || '').replace(/\/+$/, '');
const KEY = process.env.ESPOCRM_API_KEY || '';
const ENTITIES = ['Lead', 'Account', 'Contact', 'Opportunity', 'Task', 'Meeting', 'Call'];

async function api(method, path, { query, body } = {}) {
  if (!BASE) throw new Error('Falta ESPOCRM_URL');
  if (!KEY) throw new Error('Falta ESPOCRM_API_KEY');
  const url = new URL(`${BASE}/api/v1/${path}`);
  for (const [k, v] of Object.entries(query || {})) {
    if (v === undefined || v === null || v === '') continue;
    if (typeof v === 'object') {
      const flat = (o, p) => Object.entries(o).forEach(([kk, vv]) => {
        const key = `${p}[${kk}]`;
        typeof vv === 'object' && vv !== null ? flat(vv, key) : url.searchParams.append(key, vv);
      });
      flat(v, k);
    } else url.searchParams.set(k, v);
  }
  const r = await fetch(url, {
    method,
    headers: { 'X-Api-Key': KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`EspoCRM ${r.status} ${r.headers.get('X-Status-Reason') || ''} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

const ent = { type: 'string', enum: ENTITIES, description: 'Entidad de EspoCRM' };
const TOOLS = [
  {
    name: 'espocrm_find',
    description: 'Busca registros. textFilter busca por nombre/correo. orderBy p. ej. createdAt. Devuelve total y lista.',
    inputSchema: { type: 'object', properties: {
      entityType: ent,
      textFilter: { type: 'string' },
      select: { type: 'string', description: 'Campos separados por comas, p. ej. name,status,emailAddress,source,createdAt' },
      maxSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      offset: { type: 'integer', minimum: 0 },
      orderBy: { type: 'string' },
      order: { type: 'string', enum: ['asc', 'desc'] },
      where: { type: 'array', description: 'Filtros EspoCRM, p. ej. [{"type":"equals","attribute":"status","value":"New"}]', items: { type: 'object' } },
    }, required: ['entityType'], additionalProperties: false },
  },
  {
    name: 'espocrm_read',
    description: 'Lee un registro por id con todos sus campos.',
    inputSchema: { type: 'object', properties: { entityType: ent, id: { type: 'string' } }, required: ['entityType', 'id'], additionalProperties: false },
  },
  {
    name: 'espocrm_create',
    description: 'Crea un registro. data usa los nombres de campo de EspoCRM (Lead: firstName, lastName, emailAddress, accountName, status, source, description).',
    inputSchema: { type: 'object', properties: { entityType: ent, data: { type: 'object' } }, required: ['entityType', 'data'], additionalProperties: false },
  },
  {
    name: 'espocrm_update',
    description: 'Actualiza campos de un registro (solo los indicados en data).',
    inputSchema: { type: 'object', properties: { entityType: ent, id: { type: 'string' }, data: { type: 'object' } }, required: ['entityType', 'id', 'data'], additionalProperties: false },
  },
  {
    name: 'espocrm_add_note',
    description: 'Añade una nota (Post en el stream) a un registro.',
    inputSchema: { type: 'object', properties: { entityType: ent, id: { type: 'string' }, text: { type: 'string' } }, required: ['entityType', 'id', 'text'], additionalProperties: false },
  },
];

function check(a) { if (!ENTITIES.includes(a.entityType)) throw new Error(`entityType no permitido: ${a.entityType}`); }

async function callTool(name, a = {}) {
  check(a);
  switch (name) {
    case 'espocrm_find': {
      const q = { maxSize: a.maxSize || 20, offset: a.offset, orderBy: a.orderBy, order: a.order, textFilter: a.textFilter, select: a.select };
      if (a.where) q.where = Object.fromEntries(a.where.map((w, i) => [i, w]));
      const r = await api('GET', a.entityType, { query: q });
      return { total: r.total, list: r.list };
    }
    case 'espocrm_read': return api('GET', `${a.entityType}/${encodeURIComponent(a.id)}`);
    case 'espocrm_create': return api('POST', a.entityType, { body: a.data });
    case 'espocrm_update': return api('PUT', `${a.entityType}/${encodeURIComponent(a.id)}`, { body: a.data });
    case 'espocrm_add_note': return api('POST', 'Note', { body: { type: 'Post', post: a.text, parentType: a.entityType, parentId: a.id } });
    default: throw new Error(`Herramienta desconocida: ${name}`);
  }
}

const send = (m) => process.stdout.write(JSON.stringify(m) + '\n');
const rl = readline.createInterface({ input: process.stdin });
rl.on('line', async (line) => {
  let m; try { m = JSON.parse(line); } catch { return; }
  const { id, method, params } = m;
  if (id === undefined) return; // notificaciones
  try {
    if (method === 'initialize') {
      send({ jsonrpc: '2.0', id, result: { protocolVersion: params?.protocolVersion || '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'espocrm-dtr', version: '1.0.0' } } });
    } else if (method === 'tools/list') {
      send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
    } else if (method === 'tools/call') {
      try {
        const out = await callTool(params.name, params.arguments);
        send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(out, null, 1) }] } });
      } catch (e) {
        send({ jsonrpc: '2.0', id, result: { isError: true, content: [{ type: 'text', text: String(e.message || e) }] } });
      }
    } else if (method === 'ping') {
      send({ jsonrpc: '2.0', id, result: {} });
    } else {
      send({ jsonrpc: '2.0', id, error: { code: -32601, message: `Método no soportado: ${method}` } });
    }
  } catch (e) {
    send({ jsonrpc: '2.0', id, error: { code: -32603, message: String(e.message || e) } });
  }
});
