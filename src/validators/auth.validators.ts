import { z } from 'zod';

const password = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(128, 'La contraseña es demasiado larga')
  .regex(/[a-zA-Z]/, 'La contraseña debe contener al menos una letra')
  .regex(/[0-9]/, 'La contraseña debe contener al menos un número');

export const registerSchema = z.object({
  username: z
    .string()
    .min(3, 'El usuario debe tener al menos 3 caracteres')
    .max(32)
    .regex(/^[a-zA-Z0-9_.-]+$/, 'El usuario solo admite letras, números, ., _ y -'),
  email: z.string().email('Email inválido').max(255).toLowerCase(),
  password,
});

export const loginSchema = z.object({
  email: z.string().email('Email inválido').max(255).toLowerCase(),
  password: z.string().min(1, 'La contraseña es obligatoria').max(128),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10, 'refreshToken es obligatorio'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
