import { z } from 'zod';
import { ROLES } from '../constants/index.js';

export const RoleSchema = z.enum(ROLES);

// Visitor schemas
export const RegisterVisitorSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(100),
  phoneNumber: z.string().trim().min(7, 'Invalid phone number').max(20),
  hostName: z.string().trim().max(150).optional(),
});

export const LookupVisitorSchema = z.object({
  phoneNumber: z.string().trim().min(7, 'Invalid phone number').max(20),
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
