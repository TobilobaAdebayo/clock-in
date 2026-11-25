'use client';

import React, { useEffect, useState } from 'react';
import { apiClient } from '../../../lib/api-client';
import { PageHeader } from '../../../components/layout';
import { Button, Card, Input } from '../../../components/ui';

interface WorkspaceSettings {
  workspaceName: string;
  workspaceTimezone: string;
}

export default function SuperAdminSettingsPage() {
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceTimezone, setWorkspaceTimezone] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        const res = await apiClient<WorkspaceSettings>('/api/v1/settings');
        if (res.data) {
          setWorkspaceName(res.data.workspaceName);
          setWorkspaceTimezone(res.data.workspaceTimezone);
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to load settings');
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleSave = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      setSaving(true);
      const res = await apiClient<WorkspaceSettings>('/api/v1/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          workspaceName: workspaceName.trim(),
          workspaceTimezone: workspaceTimezone.trim(),
        }),
      });

      if (res.data) {
        setWorkspaceName(res.data.workspaceName);
        setWorkspaceTimezone(res.data.workspaceTimezone);
      }
      setSuccessMsg('Settings saved.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-[#6B7A8C]">Loading settings...</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        eyebrow="DARE ADEBOYE INNOVATION HUB · SUPER ADMIN"
        title="System Settings"
        description="Update workspace name and timezone."
      />

      {errorMsg && (
        <div className="p-3.5 bg-red-50 text-red-700 rounded-xl text-sm border border-red-200">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 text-emerald-800 rounded-xl text-sm border border-emerald-200">
          {successMsg}
        </div>
      )}

      <Card className="p-6 sm:p-8">
        <form onSubmit={handleSave} className="space-y-5">
          <Input
            label="Workspace Name"
            type="text"
            required
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            placeholder="Dare Adeboye Innovation Hub"
          />

          <Input
            label="Timezone"
            type="text"
            required
            value={workspaceTimezone}
            onChange={(e) => setWorkspaceTimezone(e.target.value)}
            placeholder="Africa/Lagos"
            className="font-mono"
            helperText="e.g. Africa/Lagos, UTC, Europe/London"
          />

          <div className="pt-3 border-t border-[#E6ECF2] flex justify-end">
            <Button type="submit" isLoading={saving}>
              {saving ? 'Saving...' : 'Save settings'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
