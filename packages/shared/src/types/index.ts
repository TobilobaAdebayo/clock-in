import { z } from 'zod';
import {
  RegisterVisitorSchema,
  LookupVisitorSchema,
  ConfirmVisitorIdentitySchema,
  CheckInSchema,
  CheckOutSchema,
  LoginSchema,
  CreateStaffSchema,
} from '../schemas/index.js';

export type RegisterVisitorInput = z.infer<typeof RegisterVisitorSchema>;
export type LookupVisitorInput = z.infer<typeof LookupVisitorSchema>;
export type ConfirmVisitorIdentityInput = z.infer<typeof ConfirmVisitorIdentitySchema>;
export type CheckInInput = z.infer<typeof CheckInSchema>;
export type CheckOutInput = z.infer<typeof CheckOutSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type CreateStaffInput = z.infer<typeof CreateStaffSchema>;

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}
