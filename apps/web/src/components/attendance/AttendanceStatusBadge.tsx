import React from 'react';
import { Badge } from '../ui/Badge';

export function AttendanceStatusBadge({ checkOut }: { checkOut: string | null }) {
  return checkOut ? <Badge tone="neutral">Checked Out</Badge> : <Badge tone="success">Active</Badge>;
}
