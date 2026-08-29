# ollamyn API

Backend/API REST profesional, seguro y escalable de **ollamyn**: una plataforma
multi‑proveedor de inteligencia artificial. Las aplicaciones (Android, web y
otros clientes) se comunican **exclusivamente** con esta API y nunca conocen qué
proveedor real (OpenAI, NVIDIA, Anthropic/Claude, Google/Gemini o un modelo
local sobre GPU NVIDIA) atiende cada modelo público `ollamyn-*`.

```
Cliente Android / Web
        ↓
   ollamyn API   ← autenticación, límites, historial, abstracción de proveedores
        ↓
 Servicios de IA (OpenAI · NVIDIA · Anthropic · Google · local)
        ↓
   PostgreSQL
```

El cliente **nunca** se conecta directamente a PostgreSQL ni a los proveedores.

---

## Tecnologías

- **Node.js + TypeScript**
- **Express** (API REST)
- **PostgreSQL + Prisma ORM** (migraciones incluidas)
- **JWT** (access + refresh con rotación y revocación) · **bcrypt**
- **Redis** *(opcional)* para rate limiting distribuido (fallback en memoria)
- **Docker / docker‑compose**
- **Swagger / OpenAPI** en `/docs`
- **pino** para logging estructurado (con redacción de secretos)
- **Zod** para validación de entrada

---

## Arquitectura

```
src/
├── server.ts              # Arranque + apagado ordenado
├── app.ts                 # Ensamblado de Express (helmet, cors, rate limit, rutas)
├── config/                # env, database, redis, logger, swagger, upload
├── routes/                # Definición de rutas por módulo
├── controllers/           # Orquestación HTTP (thin)
├── services/              # Lógica de negocio
│   ├── auth · user · chat · model · file · completion · rateLimit
│   └── ai/                # Sistema multi‑proveedor
│       ├── provider.interface.ts     # Interfaz común AIProvider
│       ├── openai-compatible.provider.ts
│       ├── openai · nvidia · anthropic · google · local .provider.ts
│       ├── provider.registry.ts      # Registro de proveedores
│       └── ai.service.ts             # Selecciona el proveedor según el modelo
├── repositories/          # Único acceso a Prisma
├── middleware/            # auth, admin, rateLimit, validate, error
├── validators/            # Esquemas Zod
├── utils/                 # errores, respuestas, jwt, password, tokens
└── types/                 # Tipos compartidos
prisma/
├── schema.prisma          # users, ai_models, chats, messages, files, ai_usage
├── migrations/            # Migraciones versionadas
└── seed.ts                # Admin inicial + catálogo de modelos ollamyn-*
```

### Sistema multi‑proveedor

Todos los proveedores implementan la misma interfaz:

```ts
interface AIProvider {
  isConfigured(): boolean;
  generate(request): Promise<AIResponse>;
  stream(request): AsyncIterable<AIStreamChunk>;
}
```

El `AIService` decide qué proveedor usar leyendo el campo interno `provider` del
modelo en la base de datos. Para reasignar `ollamyn-pro` de OpenAI a NVIDIA (o a
un modelo propio) basta con **cambiar un registro en la base de datos**: las apps
Android y web no requieren ningún cambio.

---

## Requisitos

- Node.js ≥ 20
- PostgreSQL 14+ (o usar `docker compose`)
- *(Opcional)* Redis

---

## Puesta en marcha

### Opción A — Docker (recomendada)

Levanta API + PostgreSQL + Redis:

```bash
cp .env.example .env        # edita los secretos (JWT_SECRET, etc.)
docker compose up -d
```

La API queda en `http://localhost:3000`. El contenedor aplica las migraciones
automáticamente (`prisma migrate deploy`) al arrancar.

Para cargar el administrador y los modelos de ejemplo:

```bash
docker compose exec api npm run db:seed
```

### Opción B — Local

```bash
# 1. Dependencias
npm install

# 2. Configuración
cp .env.example .env        # ajusta DATABASE_URL y los secretos

# 3. Base de datos (crea la BD 'ollamyn' primero)
npm run prisma:migrate      # crea/aplica migraciones en desarrollo
npm run db:seed             # admin + modelos ollamyn-*

# 4. Arrancar
npm run dev                 # desarrollo con recarga en caliente
# o
npm run build && npm start  # producción
```

En **producción** aplica migraciones con:

```bash
npx prisma migrate deploy
```

---

## Variables de entorno

Todas las claves viven **exclusivamente** en `.env` (nunca en el código ni en el
repositorio). Consulta `.env.example` para la lista completa. Las más
importantes:

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Cadena de conexión a PostgreSQL |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Secretos de firma JWT (usa `openssl rand -hex 48`) |
| `REDIS_URL` | *(Opcional)* rate limiting distribuido |
| `CORS_ORIGINS` | Orígenes permitidos (coma‑separados o `*`) |
| `RATE_LIMIT_AI_FREE_MAX` / `_PREMIUM_MAX` | Límite de solicitudes de IA por hora |
| `OPENAI_API_KEY` · `NVIDIA_API_KEY` · `ANTHROPIC_API_KEY` · `GOOGLE_API_KEY` | Claves de proveedores |
| `LOCAL_AI_BASE_URL` | Backend local (Ollama/vLLM) compatible con OpenAI |

> **Modo demostración:** el modelo `ollamyn-local` funciona **sin ninguna clave**
> (respuesta simulada), lo que permite probar de inmediato el flujo completo
> (streaming, historial, registro de uso). Configura una clave real para activar
> `ollamyn-fast` (NVIDIA), `ollamyn-pro` (OpenAI), `ollamyn-reasoning`
> (Anthropic/Claude) y `ollamyn-vision` (Google/Gemini).

---

## Endpoints principales (`/api/v1`)

**Autenticación**
- `POST /auth/register` · `POST /auth/login` · `POST /auth/refresh` · `POST /auth/logout` · `GET /auth/me`

**Usuarios**
- `GET /users/me` · `PATCH /users/me` · `POST /users/me/password` · `DELETE /users/me`

**Administración** *(rol `admin`)*
- `GET /admin/users` · `GET /admin/users/:id` · `PATCH /admin/users/:id` · `GET /admin/health`

**Modelos de IA**
- `GET /models` · `GET /models/:slug` *(solo modelos habilitados)*

**Chats**
- `POST /chats` · `GET /chats` · `GET /chats/:id` · `PATCH /chats/:id` · `DELETE /chats/:id`

**Mensajes e IA**
- `POST /chat/completions` — ruta principal (streaming opcional)

**Archivos**
- `POST /files` · `GET /files` · `GET /files/:id` · `DELETE /files/:id`

**Salud**
- `GET /health` (público) · `GET /api/v1/admin/health` (detallado)

**Documentación**
- `GET /docs` (Swagger UI) · `GET /openapi.json`

### Ejemplo: generar respuesta con streaming

```bash
curl -N -X POST http://localhost:3000/api/v1/chat/completions \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"model":"ollamyn-local","message":"Explícame cómo funciona PostgreSQL","stream":true}'
```

Con `stream: true` la respuesta llega por **Server‑Sent Events**:

```
data: {"type":"meta","chatId":"...","model":"ollamyn-local"}
data: {"type":"delta","delta":"Postgre"}
data: {"type":"delta","delta":"SQL es..."}
data: {"type":"done","chatId":"...","usage":{"inputTokens":...,"outputTokens":...,"totalTokens":...,"latencyMs":...}}
data: [DONE]
```

Si el cliente cierra la conexión, el servidor **aborta la generación** y guarda
la respuesta parcial (estado `canceled`).

### Formato estándar de respuestas

Éxito:

```json
{ "success": true, "data": { } }
```

Error (nunca expone stack traces en producción):

```json
{ "success": false, "error": { "code": "MODEL_NOT_FOUND", "message": "El modelo solicitado no existe." } }
```

Límite superado → **HTTP 429**:

```json
{ "success": false, "error": { "code": "RATE_LIMIT_EXCEEDED", "message": "Has alcanzado tu límite temporal." } }
```

---

## Modelo de datos

`users` · `refresh_tokens` · `ai_models` · `chats` · `messages` · `files` ·
`ai_usage`. Todas las entidades usan **UUID**. El campo `passwordHash` **nunca**
se devuelve al cliente; los datos internos del proveedor (`provider`,
`providerModel`, `config`) tampoco se exponen.

---

## Seguridad

- Contraseñas hasheadas con bcrypt · JWT de acceso + refresh con rotación y revocación
- Validación de entrada con Zod · protección frente a SQL Injection vía Prisma
- Helmet · CORS configurable · rate limiting global y por plan · límite de tamaño de body
- Permisos por usuario · middleware administrativo
- Logging con redacción de contraseñas, tokens y claves API
- Secretos exclusivamente en `.env`

---

## Scripts

| Script | Acción |
|---|---|
| `npm run dev` | Desarrollo con recarga en caliente |
| `npm run build` | Genera Prisma Client y compila TypeScript |
| `npm start` | Ejecuta la build de producción |
| `npm run typecheck` | Comprobación de tipos |
| `npm run prisma:migrate` | Migraciones (desarrollo) |
| `npm run prisma:deploy` | Migraciones (producción) |
| `npm run db:seed` | Semilla (admin + modelos) |

---

## Extensibilidad

La arquitectura está preparada para incorporar, sin romper el contrato con las
apps: generación y análisis de imágenes, voz (TTS/STT), búsqueda web, ejecución
de herramientas, memoria del usuario, RAG y embeddings, almacenamiento de
archivos en la nube, modelos propios sobre GPU NVIDIA y múltiples servidores de
inferencia. Añadir un proveedor nuevo se reduce a implementar `AIProvider` y
registrarlo en `provider.registry.ts`.

El objetivo final: que las apps de ollamyn solo necesiten hablar con una API
estable como `https://api.ollamyn.com/api/v1/`, sin importar qué modelo o
proveedor se utilice internamente.
