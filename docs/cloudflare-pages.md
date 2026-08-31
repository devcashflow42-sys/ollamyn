# Desplegar ollamyn en Cloudflare Pages + Neon

Esta guía usa **solo el panel web** de Cloudflare y Neon (sin terminal).

La API vive en la carpeta **`functions/`** (Cloudflare Pages Functions) y la base
de datos es **Neon** (PostgreSQL serverless). El sitio estático mínimo está en
**`public/`**.

---

## 1. Crear la base de datos en Neon

1. Entra en <https://console.neon.tech> y crea un proyecto (elige la región más
   cercana a tus usuarios).
2. Abre **SQL Editor**.
3. Copia y pega el contenido de **`db/schema.sql`** de este repo y pulsa **Run**.
4. Copia y pega el contenido de **`db/seed.sql`** y pulsa **Run** (crea los
   modelos `ollamyn-*`).
5. Ve a **Dashboard → Connection string** y copia la cadena de conexión
   (la que termina en `?sslmode=require`). La necesitarás como `DATABASE_URL`.

---

## 2. Conectar el repositorio a Cloudflare Pages

Si ya tienes el proyecto de Pages creado, ve a sus **Settings**. Si no:

1. Cloudflare Dashboard → **Workers & Pages → Create → Pages → Connect to Git**.
2. Elige el repositorio `ollamyn`.

### Configuración de build (¡importante!)

En **Settings → Builds & deployments → Build configurations**:

| Campo | Valor |
|---|---|
| Framework preset | **None** |
| Build command | *(déjalo vacío)* |
| Build output directory | **`public`** |
| Root directory | *(vacío / la raíz)* |

> El error `Output directory "Public" not found` era por esto: estaba en
> `Public` (mayúscula) y sin la carpeta. Ahora existe `public/` y el
> `wrangler.toml` ya fija `pages_build_output_dir = "public"`.

### Compatibilidad con Node

En **Settings → Functions → Compatibility flags**, añade `nodejs_compat`
tanto en **Production** como en **Preview** (necesario para el driver de Neon).
El `wrangler.toml` ya lo incluye, pero configúralo también aquí por seguridad.

---

## 3. Variables de entorno (secretos)

En **Settings → Environment variables**, añade estas para **Production** (y
Preview si quieres probar). Marca los secretos como **Encrypt**.

| Variable | Valor | Obligatoria |
|---|---|---|
| `DATABASE_URL` | La cadena de conexión de Neon (paso 1) | ✅ |
| `JWT_SECRET` | Texto largo y aleatorio | ✅ |
| `JWT_REFRESH_SECRET` | Otro distinto, largo y aleatorio | ✅ |
| `CORS_ORIGINS` | `https://tu-web.com` (o `*` para probar) | recomendada |
| `OPENAI_API_KEY` | Clave de OpenAI | opcional |
| `NVIDIA_API_KEY` | Clave de NVIDIA | opcional |
| `ANTHROPIC_API_KEY` | Clave de Anthropic/Claude | opcional |
| `GOOGLE_API_KEY` | Clave de Google/Gemini | opcional |

> Genera los `JWT_*` con cualquier generador de cadenas aleatorias (48+ caracteres).
> Sin claves de IA, el modelo **`ollamyn-local`** funciona igual (modo demo).

---

## 4. Desplegar

En **Deployments**, pulsa **Retry deployment** (o haz un push al repo).
Cuando termine, tu API estará en:

```
https://<tu-proyecto>.pages.dev
```

Comprueba:
- `https://<tu-proyecto>.pages.dev/health` → `{"status":"ok","database":"connected"}`
- `https://<tu-proyecto>.pages.dev/` → página de bienvenida

---

## 5. Crear tu usuario administrador

1. Regístrate (desde tu web, Postman o con este `fetch` en la consola del navegador):

   ```js
   fetch('https://<tu-proyecto>.pages.dev/api/register', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ username: 'admin', email: 'tu@email.com', password: 'TuPassword123' })
   }).then(r => r.json()).then(console.log);
   ```

2. En el **SQL Editor de Neon**, promuévete a administrador:

   ```sql
   UPDATE users SET role = 'admin', plan = 'premium' WHERE email = 'tu@email.com';
   ```

---

## Endpoints disponibles

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/register` | Crear cuenta |
| POST | `/api/login` | Iniciar sesión |
| POST | `/api/logout` | Cerrar sesión (revoca refresh token) |
| POST | `/api/refresh` | Renovar tokens |
| GET · PATCH · DELETE | `/api/me` | Perfil propio |
| GET | `/api/users` · `/api/users/:id` | Usuarios (admin) |
| GET | `/api/models` | Modelos disponibles |
| GET | `/api/models/:slug` | Un modelo |
| GET/POST | `/api/chats` | Listar / crear chats |
| GET/PATCH/DELETE | `/api/chats/:id` | Ver / editar / borrar chat |
| POST | `/api/chat` · `/api/chat/completions` | Hablar con la IA (streaming) |
| GET · PATCH · DELETE | `/api/admin/users/:id` | Gestión de usuarios (admin) |
| GET | `/api/health` | Estado del servicio |
| GET | `/api/docs` | Referencia de la API |

### Ejemplo de streaming (Server-Sent Events)

```js
const res = await fetch('https://<tu-proyecto>.pages.dev/api/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
  body: JSON.stringify({ model: 'ollamyn-local', message: 'Hola', stream: true }),
});
const reader = res.body.getReader();
const decoder = new TextDecoder();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  console.log(decoder.decode(value)); // eventos: meta, delta, done, [DONE]
}
```

---

## Notas técnicas

- **Runtime:** Cloudflare Workers (no Node.js). Por eso se usan `jose` (JWT),
  **PBKDF2/WebCrypto** (contraseñas) y el **driver serverless de Neon**, todos
  compatibles con Workers.
- **Rate limiting:** por plan (gratuito 20/h, premium 500/h), contando el uso en
  la tabla `ai_usage`. Configurable con `RATE_LIMIT_AI_FREE_MAX` /
  `RATE_LIMIT_AI_PREMIUM_MAX`.
- **Llaves por usuario (futuro):** la arquitectura permite añadir que cada
  usuario use sus propias claves; hoy las claves son del servidor.
- El backend **Express** (`src/`) sigue en el repo como alternativa para
  auto-alojamiento (Fly.io, VPS...), pero Cloudflare Pages usa **solo**
  `functions/` y `public/`.
