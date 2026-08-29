import { z } from 'zod';

export const updateProfileSchema = z
  .object({
    username: z
      .string()
      .min(3)
      .max(32)
      .regex(/^[a-zA-Z0-9_.-]+$/)
      .optional(),
    email: z.string().email().max(255).toLowerCase().optional(),
  })
  .refine((d) => d.username !== undefined || d.email !== undefined, {
    message: 'Debes proporcionar al menos un campo para actualizar',
  });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z
    .string()
    .min(8, 'La nueva contraseña debe tener al menos 8 caracteres')
    .max(128)
    .regex(/[a-zA-Z]/, 'La contraseña debe contener al menos una letra')
    .regex(/[0-9]/, 'La contraseña debe contener al menos un número'),
});

export const adminUpdateUserSchema = z
  .object({
    role: z.enum(['user', 'admin']).optional(),
    status: z.enum(['active', 'suspended', 'deleted']).optional(),
    plan: z.enum(['free', 'premium']).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'Debes proporcionar al menos un campo para actualizar',
  });

export const adminListUsersQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['active', 'suspended', 'deleted']).optional(),
  search: z.string().max(255).optional(),
});
