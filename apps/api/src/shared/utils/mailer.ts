import nodemailer from 'nodemailer';
import { env } from '../../config/env.js';
import { AppError } from '../errors/app-error.js';

export interface TwoFactorEmailParams {
  to: string;
  fullName: string;
  code: string;
  purpose: 'LOGIN' | 'ENABLE';
  expiresInMinutes: number;
}

export interface EmailDeliveryResult {
  deliveredVia: 'smtp' | 'console';
  devPreviewCode?: string;
}

export const isSmtpConfigured = (): boolean =>
  Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);

export const maskEmail = (email: string): string => {
  const [local = '', domain = ''] = email.trim().split('@');
  if (!domain) return '***';
  if (local.length <= 2) {
    return `${local[0] || '*'}***@${domain}`;
  }
  return `${local.slice(0, 2)}***@${domain}`;
};

export const sendTwoFactorCodeEmail = async (
  params: TwoFactorEmailParams,
): Promise<EmailDeliveryResult> => {
  const actionLabel =
    params.purpose === 'ENABLE'
      ? 'enable two-factor authentication on your account'
      : 'complete signing in to your account';

  const subject = `${params.code} is your ${env.WORKSPACE_NAME} verification code`;
  const text = [
    `Hello ${params.fullName},`,
    '',
    `Use the 6-digit code below to ${actionLabel}:`,
    '',
    `  ${params.code}`,
    '',
    `This code expires in ${params.expiresInMinutes} minutes. If you did not request this code, you can safely ignore this email.`,
    '',
    `${env.WORKSPACE_NAME} · Clock In`,
  ].join('\n');

  const html = `
    <div style="font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #F7F9FB; color: #111827;">
      <div style="background: #FFFFFF; border: 1px solid #E6ECF2; border-radius: 16px; padding: 28px;">
        <div style="font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #6B7A8C;">
          ${env.WORKSPACE_NAME}
        </div>
        <h2 style="margin: 8px 0 12px; font-size: 20px; color: #111827;">Verification Code</h2>
        <p style="margin: 0 0 20px; font-size: 14px; color: #475569; line-height: 1.5;">
          Hello ${params.fullName}, use the 6-digit code below to ${actionLabel}:
        </p>
        <div style="background: #EEF3F7; border: 1px solid #DCE6EE; border-radius: 12px; padding: 18px; text-align: center; font-size: 32px; font-weight: 800; letter-spacing: 0.25em; color: #1E3A54; font-family: monospace;">
          ${params.code}
        </div>
        <p style="margin: 20px 0 0; font-size: 12px; color: #6B7A8C; line-height: 1.5;">
          This code expires in ${params.expiresInMinutes} minutes. If you did not request this code, please ignore this email or contact your Super Admin.
        </p>
      </div>
    </div>
  `;

  if (isSmtpConfigured()) {
    const transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: env.SMTP_FROM,
      to: params.to,
      subject,
      text,
      html,
    });

    return { deliveredVia: 'smtp' };
  }

  if (env.NODE_ENV === 'production') {
    throw new AppError(
      'Email delivery is not configured on this server. Contact a Super Admin.',
      503,
      'SMTP_NOT_CONFIGURED',
    );
  }

  if (env.NODE_ENV === 'development') {
    console.log(
      `\n[2FA DEV MAILER] Verification code for ${params.to} (${params.purpose}): ${params.code} (expires in ${params.expiresInMinutes}m)\n`,
    );
  }

  return {
    deliveredVia: 'console',
    devPreviewCode: env.NODE_ENV === 'development' ? params.code : undefined,
  };
};

export const mailerService = {
  sendTwoFactorCodeEmail,
};
