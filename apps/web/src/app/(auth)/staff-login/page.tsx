'use client';

import React from 'react';
import { PortalLoginForm } from '../../../components/auth/PortalLoginForm';

export default function StaffLoginPage() {
  return (
    <PortalLoginForm
      title="Staff Portal"
      subtitle="Authorized Receptionist and Super Admin access only."
      placeholderEmail="admin@clockin.workspace"
      redirectOnLogin={true}
    />
  );
}
