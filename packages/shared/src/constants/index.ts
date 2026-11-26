export const ROLES = {
  SECURITY: 'SECURITY',
  RECEPTIONIST: 'RECEPTIONIST',
  SUPER_ADMIN: 'SUPER_ADMIN',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ATTENDANCE_STATUS = {
  CHECKED_IN: 'CHECKED_IN',
  CHECKED_OUT: 'CHECKED_OUT',
} as const;

export type AttendanceStatus = (typeof ATTENDANCE_STATUS)[keyof typeof ATTENDANCE_STATUS];

export const ERROR_SEVERITY = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
} as const;

export type ErrorSeverity = (typeof ERROR_SEVERITY)[keyof typeof ERROR_SEVERITY];

export const ERROR_STATUS = {
  OPEN: 'OPEN',
  INVESTIGATING: 'INVESTIGATING',
  RESOLVED: 'RESOLVED',
} as const;

export type ErrorStatus = (typeof ERROR_STATUS)[keyof typeof ERROR_STATUS];
