import type { Env } from '../_lib/types';

/** GET /api/docs — referencia simple de la API (HTML). */
export const onRequestGet: PagesFunction<Env> = async () => {
  const rows: [string, string, string][] = [
    ['POST', '/api/register', 'Crear cuenta'],
    ['POST', '/api/login', 'Iniciar sesión'],
    ['POST', '/api/logout', 'Cerrar sesión (revoca refresh token)'],
    ['POST', '/api/refresh', 'Renovar tokens'],
    ['GET · PATCH · DELETE', '/api/me', 'Perfil propio'],
    ['GET', '/api/users', 'Listar usuarios (admin)'],
    ['GET · PATCH', '/api/users/:id', 'Ver / actualizar usuario (admin)'],
    ['GET', '/api/models', 'Modelos disponibles'],
    ['GET', '/api/models/:slug', 'Un modelo'],
    ['GET · POST', '/api/chats', 'Listar / crear chats'],
    ['GET · PATCH · DELETE', '/api/chats/:id', 'Ver / editar / borrar chat'],
    ['POST', '/api/chat', 'Hablar con la IA (alias)'],
    ['POST', '/api/chat/completions', 'Hablar con la IA (streaming)'],
    ['GET', '/api/admin/users', 'Listar usuarios (admin)'],
    ['GET · PATCH · DELETE', '/api/admin/users/:id', 'Gestionar usuario (admin)'],
    ['GET', '/api/health', 'Estado del servicio'],
  ];
  const tbody = rows
    .map(([m, path, desc]) => `<tr><td class="m">${m}</td><td><code>${path}</code></td><td>${desc}</td></tr>`)
    .join('');
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>ollamyn API · Docs</title>
<style>body{font:15px/1.6 system-ui,sans-serif;max-width:820px;margin:2rem auto;padding:0 1rem;color:#e7e9ee;background:#0b0d12}
h1{margin:0 0 .25rem}p{color:#8b94a7}table{width:100%;border-collapse:collapse;margin-top:1rem}
th,td{text-align:left;padding:.5rem .6rem;border-bottom:1px solid #222836;vertical-align:top}
th{color:#8b94a7;font-weight:600}.m{color:#6ea8fe;white-space:nowrap;font-size:.85em}
code{background:#171a22;padding:.1em .4em;border-radius:6px}</style></head>
<body><h1>ollamyn API</h1><p>Base: <code>/api</code> · Autenticación: <code>Authorization: Bearer &lt;accessToken&gt;</code></p>
<table><thead><tr><th>Método</th><th>Ruta</th><th>Descripción</th></tr></thead><tbody>${tbody}</tbody></table>
</body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
};
