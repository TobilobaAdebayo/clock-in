import { z } from 'zod';
import { ROLES } from '../constants/index.js';

export const RoleSchema = z.enum(ROLES);

// Visitor schemas
export const RegisterVisitorSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(100),
  phoneNumber: z
    .string()
    .trim()
    .min(7, 'Phone number is required')
    .max(20, 'Invalid phone number'),
  hostName: z.string().trim().max(150).optional(),
});

const isPhoneLike = (val: string) => {
  const trimmed = val.trim();
  if (!/^[+\d\s\-().]+$/.test(trimmed)) return false;
  const digits = trimmed.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
};

export const LookupVisitorSchema = z
  .object({
    phoneNumber: z.string().trim().optional(),
    identifier: z.string().trim().optional(),
  })
  .refine((data) => {
    const raw = data.phoneNumber || data.identifier || '';
    return raw.length >= 7 && raw.length <= 20 && isPhoneLike(raw);
  }, {
    message: 'Please enter a valid registered phone number',
  });

export const ConfirmVisitorIdentitySchema = z.object({
  lookupToken: z.string().min(1, 'Lookup token is required'),
  confirmationAnswer: z.string().trim().min(1, 'Confirmation is required'),
});

// Attendance schemas
export const CheckInSchema = z.object({
  visitorId: z.uuid().optional(),
  lookupToken: z.string().optional(),
  hostName: z.string().trim().max(150).optional(),
});

export const CheckOutSchema = z.object({
  visitorId: z.uuid().optional(),
  lookupToken: z.string().optional(),
});

// Staff auth schemas
export const LoginSchema = z.object({
  email: z.string().trim().pipe(z.email('Invalid email address')),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const CreateStaffSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: z.string().trim().pipe(z.email()),
  password: z.string().min(8),
  role: RoleSchema,
});
