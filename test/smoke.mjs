// Prueba de humo sin CRM real: levanta un EspoCRM falso y habla con server.mjs por stdio.
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const seen = [];
const fake = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    seen.push({ method: req.method, url: req.url, key: req.headers['x-api-key'], body });
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(req.method === 'GET' ? { total: 1, list: [{ id: '1', name: 'Demo' }] } : { id: '1' }));
  });
});
await new Promise((r) => fake.listen(0, r));
const port = fake.address().port;

const server = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'server.mjs');
const child = spawn('node', [server], { env: { ...process.env, ESPOCRM_URL: `http://127.0.0.1:${port}`, ESPOCRM_API_KEY: 'clave-de-prueba' } });
const out = [];
child.stdout.on('data', (d) => d.toString().split('\n').filter(Boolean).forEach((l) => out.push(JSON.parse(l))));

const send = (m) => child.stdin.write(JSON.stringify(m) + '\n');
send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } });
send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'espocrm_find', arguments: { entityType: 'Lead', textFilter: 'demo', where: [{ type: 'equals', attribute: 'status', value: 'New' }] } } });
send({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'espocrm_update', arguments: { entityType: 'Lead', id: 'abc', data: { status: 'Assigned' } } } });
send({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'espocrm_find', arguments: { entityType: 'User' } } });
await new Promise((r) => setTimeout(r, 1500));
child.kill(); fake.close();

const ok = (c, msg) => { if (!c) { console.error('FALLA:', msg); process.exitCode = 1; } else console.log('ok  ', msg); };
const names = out.find((o) => o.id === 2)?.result.tools.map((t) => t.name) || [];
ok(names.length === 5 && !names.some((n) => /delete/i.test(n)), 'cinco herramientas y ninguna de borrado');
ok(seen[0]?.key === 'clave-de-prueba', 'envía la clave en X-Api-Key');
ok(seen[0]?.url.includes('textFilter=demo') && decodeURIComponent(seen[0].url).includes('where[0][attribute]=status'), 'find envía textFilter y where');
ok(seen[1]?.method === 'PUT' && seen[1].url === '/api/v1/Lead/abc', 'update usa PUT sobre el registro');
ok(out.find((o) => o.id === 5)?.result.isError === true, 'rechaza entidades no permitidas');
