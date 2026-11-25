/**
 * Re-exports shared Zod schemas, domain constants, and phone helpers from @clock-in/shared
 * so frontend forms validate with the exact same rules as the Express API.
 */
export {
  ROLES,
  ATTENDANCE_STATUS,
  ERROR_SEVERITY,
  ERROR_STATUS,
  RoleSchema,
  RegisterVisitorSchema,
  LookupVisitorSchema,
  ConfirmVisitorIdentitySchema,
  CheckInSchema,
  CheckOutSchema,
  LoginSchema,
  CreateStaffSchema,
  normalizePhoneNumber,
  isValidPhoneNumber,
  maskPhoneNumber,
  maskName,
} from '@clock-in/shared';

export type {
  Role,
  AttendanceStatus,
  ErrorSeverity,
  ErrorStatus,
  RegisterVisitorInput,
  LookupVisitorInput,
  ConfirmVisitorIdentityInput,
  LoginInput,
  CreateStaffInput,
} from '@clock-in/shared';
