import { env } from './env';

/**
 * Especificación OpenAPI 3.0 de la API de ollamyn.
 * Se sirve en /docs mediante swagger-ui-express.
 */
export const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'ollamyn API',
    version: '1.0.0',
    description:
      'API REST profesional y multi-proveedor de ollamyn. Las apps Android, web ' +
      'y otros clientes se comunican exclusivamente con esta API, sin conocer qué ' +
      'proveedor real (OpenAI, NVIDIA, Anthropic, Google, local...) atiende cada modelo.',
  },
  servers: [{ url: `${env.PUBLIC_API_URL}/api`, description: 'ollamyn API' }],
  tags: [
    { name: 'Auth', description: 'Registro, inicio de sesión y tokens' },
    { name: 'Users', description: 'Perfil del usuario autenticado' },
    { name: 'Admin', description: 'Administración (requiere rol admin)' },
    { name: 'Models', description: 'Catálogo de modelos de IA' },
    { name: 'Chats', description: 'Gestión de conversaciones' },
    { name: 'AI', description: 'Generación de respuestas de IA' },
    { name: 'Files', description: 'Archivos adjuntos' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string', example: 'Datos de entrada inválidos' },
              details: { type: 'object', nullable: true },
            },
          },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          username: { type: 'string' },
          email: { type: 'string', format: 'email' },
          role: { type: 'string', enum: ['user', 'admin'] },
          status: { type: 'string', enum: ['active', 'suspended', 'deleted'] },
          plan: { type: 'string', enum: ['free', 'premium'] },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      AuthTokens: {
        type: 'object',
        properties: {
          accessToken: { type: 'string' },
          refreshToken: { type: 'string' },
          tokenType: { type: 'string', example: 'Bearer' },
          expiresIn: { type: 'integer', example: 900 },
        },
      },
      Model: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string', example: 'ollamyn-pro' },
          slug: { type: 'string', example: 'ollamyn-pro' },
          description: { type: 'string', nullable: true },
          enabled: { type: 'boolean' },
          contextWindow: { type: 'integer' },
          supportsImages: { type: 'boolean' },
          supportsFiles: { type: 'boolean' },
          supportsStreaming: { type: 'boolean' },
        },
      },
      Chat: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          userId: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          modelId: { type: 'string', format: 'uuid', nullable: true },
          archived: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
    responses: {
      Unauthorized: {
        description: 'No autenticado',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      RateLimited: {
        description: 'Límite de uso superado',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              success: false,
              error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Has alcanzado tu límite temporal.' },
            },
          },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/register': {
      post: {
        tags: ['Auth'],
        summary: 'Registrar un usuario',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username', 'email', 'password'],
                properties: {
                  username: { type: 'string', example: 'juan' },
                  email: { type: 'string', format: 'email', example: 'juan@ollamyn.com' },
                  password: { type: 'string', example: 'Password123' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Usuario creado' },
          '400': { description: 'Validación', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '409': { description: 'Email o usuario en uso', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/login': {
      post: {
        tags: ['Auth'],
        summary: 'Iniciar sesión',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Sesión iniciada' },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Renovar tokens',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['refreshToken'],
                properties: { refreshToken: { type: 'string' } },
              },
            },
          },
        },
        responses: { '200': { description: 'Nuevos tokens' }, '401': { $ref: '#/components/responses/Unauthorized' } },
      },
    },
    '/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Cerrar sesión (revoca el refresh token)',
        security: [],
        requestBody: {
          content: {
            'application/json': {
              schema: { type: 'object', properties: { refreshToken: { type: 'string' } } },
            },
          },
        },
        responses: { '200': { description: 'Sesión cerrada' } },
      },
    },
    '/me': {
      get: { tags: ['Users'], summary: 'Ver mi perfil', responses: { '200': { description: 'Perfil' }, '401': { $ref: '#/components/responses/Unauthorized' } } },
      patch: {
        tags: ['Users'],
        summary: 'Actualizar mi perfil',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { username: { type: 'string' }, email: { type: 'string', format: 'email' } },
              },
            },
          },
        },
        responses: { '200': { description: 'Actualizado' } },
      },
      delete: { tags: ['Users'], summary: 'Eliminar mi cuenta', responses: { '200': { description: 'Eliminada' } } },
    },
    '/users': {
      get: {
        tags: ['Users'],
        summary: 'Listar usuarios (admin)',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer' } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['active', 'suspended', 'deleted'] } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Lista paginada' }, '403': { description: 'Prohibido' } },
      },
    },
    '/users/{id}': {
      get: {
        tags: ['Users'],
        summary: 'Ver un usuario (admin)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Usuario' } },
      },
      patch: {
        tags: ['Users'],
        summary: 'Actualizar rol/estado/plan (admin)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Actualizado' } },
      },
    },
    '/models': {
      get: {
        tags: ['Models'],
        summary: 'Listar modelos habilitados',
        responses: { '200': { description: 'Lista de modelos' }, '401': { $ref: '#/components/responses/Unauthorized' } },
      },
    },
    '/models/{slug}': {
      get: {
        tags: ['Models'],
        summary: 'Obtener un modelo por slug',
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Modelo' }, '404': { description: 'No encontrado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } } },
      },
    },
    '/chats': {
      get: {
        tags: ['Chats'],
        summary: 'Listar mis chats',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'includeArchived', in: 'query', schema: { type: 'boolean', default: false } },
        ],
        responses: { '200': { description: 'Lista paginada' } },
      },
      post: {
        tags: ['Chats'],
        summary: 'Crear un chat',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { title: { type: 'string' }, model: { type: 'string', example: 'ollamyn-pro' } },
              },
            },
          },
        },
        responses: { '201': { description: 'Chat creado' } },
      },
    },
    '/chats/{id}': {
      get: {
        tags: ['Chats'],
        summary: 'Ver un chat con mensajes',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Chat' }, '404': { description: 'No encontrado' } },
      },
      patch: {
        tags: ['Chats'],
        summary: 'Actualizar un chat',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Actualizado' } },
      },
      delete: {
        tags: ['Chats'],
        summary: 'Eliminar un chat',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Eliminado' } },
      },
    },
    '/chat': {
      post: {
        tags: ['AI'],
        summary: 'Generar una respuesta de IA (alias de /chat/completions)',
        description: 'Idéntico a POST /chat/completions. Mismo cuerpo y misma respuesta (JSON o SSE).',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['model', 'message'],
                properties: {
                  chatId: { type: 'string', format: 'uuid' },
                  model: { type: 'string', example: 'ollamyn-pro' },
                  message: { type: 'string', example: 'Hola' },
                  stream: { type: 'boolean', default: false },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Respuesta generada (JSON) o flujo SSE' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '429': { $ref: '#/components/responses/RateLimited' },
        },
      },
    },
    '/chat/completions': {
      post: {
        tags: ['AI'],
        summary: 'Generar una respuesta de IA (streaming opcional)',
        description:
          'Envía un mensaje a un modelo. Con `stream: true` la respuesta se ' +
          'transmite mediante Server-Sent Events (text/event-stream) con eventos ' +
          '`meta`, `delta`, `done` y, finalmente, `data: [DONE]`.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['model', 'message'],
                properties: {
                  chatId: { type: 'string', format: 'uuid', description: 'Opcional: continúa un chat existente' },
                  model: { type: 'string', example: 'ollamyn-pro' },
                  message: { type: 'string', example: 'Explícame cómo funciona PostgreSQL' },
                  stream: { type: 'boolean', default: false },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Respuesta generada (JSON) o flujo SSE' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '404': { description: 'Modelo no encontrado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '429': { $ref: '#/components/responses/RateLimited' },
          '502': { description: 'Error del proveedor de IA', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/files': {
      get: { tags: ['Files'], summary: 'Listar mis archivos', responses: { '200': { description: 'Lista' } } },
      post: {
        tags: ['Files'],
        summary: 'Subir un archivo',
        requestBody: {
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  file: { type: 'string', format: 'binary' },
                  chatId: { type: 'string', format: 'uuid' },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'Archivo registrado' } },
      },
    },
    '/admin/users': {
      get: {
        tags: ['Admin'],
        summary: 'Listar usuarios (admin)',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer' } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['active', 'suspended', 'deleted'] } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Lista paginada' }, '403': { description: 'Prohibido' } },
      },
    },
    '/admin/users/{id}': {
      get: {
        tags: ['Admin'],
        summary: 'Ver un usuario (admin)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Usuario' } },
      },
      patch: {
        tags: ['Admin'],
        summary: 'Actualizar rol/estado/plan (admin)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  role: { type: 'string', enum: ['user', 'admin'] },
                  status: { type: 'string', enum: ['active', 'suspended', 'deleted'] },
                  plan: { type: 'string', enum: ['free', 'premium'] },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Actualizado' } },
      },
      delete: {
        tags: ['Admin'],
        summary: 'Eliminar (borrado lógico) un usuario (admin)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Eliminado' } },
      },
    },
    '/admin/health': {
      get: {
        tags: ['Admin'],
        summary: 'Health check extendido (admin)',
        responses: { '200': { description: 'Estado de PostgreSQL, Redis, proveedores y sistema' } },
      },
    },
  },
} as const;
