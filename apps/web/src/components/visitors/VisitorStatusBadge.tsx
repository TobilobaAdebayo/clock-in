import React from 'react';
import { Badge } from '../ui/Badge';

export function VisitorStatusBadge({ isCheckedIn }: { isCheckedIn: boolean }) {
  return isCheckedIn ? (
    <Badge tone="success">Currently Checked In</Badge>
  ) : (
    <Badge tone="neutral">Clocked Out</Badge>
  );
}
