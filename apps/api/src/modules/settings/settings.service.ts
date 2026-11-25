import { settingsRepository, SettingsRepository } from './settings.repository.js';
import { auditService, AuditService } from '../audit/audit.service.js';
import { prisma } from '../../shared/db/prisma.js';
import { env } from '../../config/env.js';
import { BadRequestError } from '../../shared/errors/app-error.js';

export interface WorkspaceSettings {
  workspaceName: string;
  workspaceTimezone: string;
}

export class SettingsService {
  private cache: WorkspaceSettings | null = null;

  constructor(
    private repo: SettingsRepository = settingsRepository,
    private audit: AuditService = auditService,
  ) {}

  /**
   * Validates whether a timezone identifier is a valid IANA timezone (FR-20).
   */
  isValidIanaTimezone(tz: string): boolean {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Retrieves workspace settings with environment fallback (FR-20).
   */
  async getSettings(): Promise<WorkspaceSettings> {
    if (this.cache) return this.cache;

    const all = await this.repo.getAll();
    const map = new Map(all.map((s) => [s.key, s.value]));

    const settings: WorkspaceSettings = {
      workspaceName: map.get('workspace_name') || env.WORKSPACE_NAME,
      workspaceTimezone: map.get('workspace_timezone') || env.WORKSPACE_TIMEZONE,
    };

    this.cache = settings;
    return settings;
  }

  /**
   * Updates workspace settings inside a transaction and records an audit log entry (FR-20).
   */
  async updateSettings(
    actorId: string,
    updates: Partial<WorkspaceSettings>,
  ): Promise<WorkspaceSettings> {
    if (updates.workspaceTimezone) {
      if (!this.isValidIanaTimezone(updates.workspaceTimezone)) {
        throw new BadRequestError(`Invalid IANA timezone: ${updates.workspaceTimezone}`);
      }
    }

    const current = await this.getSettings();

    const result = await prisma.$transaction(async (tx) => {
      const oldValues: Record<string, string> = {};
      const newValues: Record<string, string> = {};

      if (updates.workspaceName !== undefined && updates.workspaceName !== current.workspaceName) {
        oldValues.workspaceName = current.workspaceName;
        newValues.workspaceName = updates.workspaceName;
        await this.repo.set('workspace_name', updates.workspaceName, tx);
      }

      if (
        updates.workspaceTimezone !== undefined &&
        updates.workspaceTimezone !== current.workspaceTimezone
      ) {
        oldValues.workspaceTimezone = current.workspaceTimezone;
        newValues.workspaceTimezone = updates.workspaceTimezone;
        await this.repo.set('workspace_timezone', updates.workspaceTimezone, tx);
      }

      if (Object.keys(newValues).length > 0) {
        await this.audit.record(
          {
            actorId,
            action: 'UPDATE_SETTINGS',
            recordType: 'SETTING',
            recordId: 'WORKSPACE_SETTINGS',
            oldValues,
            newValues,
          },
          tx,
        );
      }

      return {
        workspaceName: newValues.workspaceName ?? current.workspaceName,
        workspaceTimezone: newValues.workspaceTimezone ?? current.workspaceTimezone,
      };
    });

    this.cache = result;
    return result;
  }

  invalidateCache(): void {
    this.cache = null;
  }
}

export const settingsService = new SettingsService();
