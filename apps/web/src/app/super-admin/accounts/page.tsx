'use client';

import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import { formatShortDayAndDate } from '../../../lib/format-date';
import { PageHeader } from '../../../components/layout';
import { Badge, Button, Card, Input, Modal } from '../../../components/ui';

interface StaffItem {
  id: string;
  fullName: string;
  email: string;
  role: 'RECEPTIONIST' | 'SUPER_ADMIN';
  isActive: boolean;
  createdAt: string;
}

export default function StaffAccountsPage() {
  const [staffList, setStaffList] = useState<StaffItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffItem | null>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'RECEPTIONIST' | 'SUPER_ADMIN'>('RECEPTIONIST');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        ...(search ? { search } : {}),
        ...(roleFilter ? { role: roleFilter } : {}),
      });
      const res = await apiClient<StaffItem[]>(`/api/v1/staff?${params.toString()}`);
      setStaffList(res.data || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, [search, roleFilter]);

  const openCreateModal = () => {
    setEditingStaff(null);
    setFullName('');
    setEmail('');
    setPassword('');
    setRole('RECEPTIONIST');
    setErrorMsg(null);
    setShowModal(true);
  };

  const openEditModal = (staff: StaffItem) => {
    setEditingStaff(staff);
    setFullName(staff.fullName);
    setEmail(staff.email);
    setPassword('');
    setRole(staff.role);
    setErrorMsg(null);
    setShowModal(true);
  };

  const handleSave = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      setSaving(true);
      if (editingStaff) {
        await apiClient(`/api/v1/staff/${editingStaff.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            fullName,
            email,
            role,
            ...(password ? { password } : {}),
          }),
        });
        setSuccessMsg('Staff account updated.');
      } else {
        if (!password || password.length < 8) {
          setErrorMsg('Password must be at least 8 characters long.');
          return;
        }
        await apiClient('/api/v1/staff', {
          method: 'POST',
          body: JSON.stringify({ fullName, email, password, role }),
        });
        setSuccessMsg('Staff account created.');
      }

      setShowModal(false);
      fetchStaff();
    } catch (err: any) {
      setErrorMsg(err.message || 'Operation failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (staff: StaffItem) => {
    if (staff.isActive) {
      if (!confirm(`Deactivate ${staff.fullName}'s account?`)) {
        return;
      }
    }
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await apiClient(`/api/v1/staff/${staff.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !staff.isActive }),
      });
      setSuccessMsg(`Staff account ${staff.isActive ? 'deactivated' : 'activated'}.`);
      fetchStaff();
    } catch (err: any) {
      alert(err.message || 'Failed to update account status.');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="DARE ADEBOYE INNOVATION HUB · SUPER ADMIN"
        title="Staff Accounts"
        description="Create and manage Receptionist and Super Admin accounts."
        actions={
          <Button onClick={openCreateModal}>
            <Plus className="w-4 h-4" />
            Add staff member
          </Button>
        }
      />

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 text-emerald-800 rounded-xl text-sm font-medium border border-emerald-200">
          {successMsg}
        </div>
      )}

      <Card className="p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3.5 py-2 border border-[#DCE3EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#34526E]/20 focus:border-[#34526E]"
          />
        </div>
        <div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full sm:w-auto px-3.5 py-2 border border-[#DCE3EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#34526E]/20 focus:border-[#34526E] bg-white"
          >
            <option value="">All Roles</option>
            <option value="RECEPTIONIST">Receptionists</option>
            <option value="SUPER_ADMIN">Super Admins</option>
          </select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-[#475569]">
            <thead className="bg-[#F9FBFC] border-b border-[#E6ECF2] text-[#6B7A8C] text-[11px] uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-6 py-3.5">Name</th>
                <th className="px-6 py-3.5">Email</th>
                <th className="px-6 py-3.5">Role</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Created</th>
                <th className="px-6 py-3.5 text-right">Manage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2F6]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-[#6B7A8C]">
                    Loading staff accounts...
                  </td>
                </tr>
              ) : staffList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-[#6B7A8C]">
                    No staff accounts found.
                  </td>
                </tr>
              ) : (
                staffList.map((s) => (
                  <tr key={s.id} className="hover:bg-[#F9FBFC] transition">
                    <td className="px-6 py-4 font-semibold text-[#111827]">{s.fullName}</td>
                    <td className="px-6 py-4">{s.email}</td>
                    <td className="px-6 py-4">
                      <Badge tone={s.role === 'SUPER_ADMIN' ? 'info' : 'neutral'}>
                        {s.role.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <Badge tone={s.isActive ? 'success' : 'danger'}>
                        {s.isActive ? 'Active' : 'Deactivated'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-xs text-[#6B7A8C]">
                      {formatShortDayAndDate(s.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-right space-x-3 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openEditModal(s)}
                        className="text-xs font-semibold text-[#34526E] hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleStatus(s)}
                        className={`text-xs font-semibold hover:underline ${
                          s.isActive ? 'text-red-600' : 'text-emerald-700'
                        }`}
                      >
                        {s.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={showModal}
        title={editingStaff ? 'Edit Staff Account' : 'Create Staff Account'}
        onClose={() => setShowModal(false)}
      >
        {errorMsg && (
          <div className="p-3 bg-red-50 text-red-700 rounded-xl text-xs font-medium border border-red-200">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Full Name"
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. Grace Adeyemi"
          />

          <Input
            label="Email Address"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="staff@clockin.workspace"
          />

          <Input
            label={editingStaff ? 'New Password (optional)' : 'Password'}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={editingStaff ? 'Leave blank to keep current' : 'Min. 8 characters'}
          />

          <div className="space-y-1.5">
            <label className="block text-[13px] font-semibold text-[#1F2937]">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as any)}
              className="w-full px-3.5 py-2.5 border border-[#DCE3EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#34526E]/20 focus:border-[#34526E] bg-white"
            >
              <option value="RECEPTIONIST">Receptionist</option>
              <option value="SUPER_ADMIN">Super Admin</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E6ECF2]">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={saving}>
              {saving ? 'Saving...' : editingStaff ? 'Update account' : 'Create account'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
