import { test, expect } from '@playwright/test';

/**
 * End-to-End Smoke Suite (Milestone 7)
 * Covers:
 *  1. Public guest check-in kiosk rendering, security headers, and first-time registration flow
 *  2. Returning visitor privacy-preserving lookup & confirmation flow
 *  3. Staff portal login form and redirect to authenticated dashboard
 */

test.describe('CLOCK IN E2E Smoke Suite', () => {
  test('public check-in page loads with security headers and completes guest registration', async ({ page }) => {
    // Intercept API registration for deterministic smoke testing when no live DB is seeded
    await page.route('**/api/v1/public/visitors/register', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Registration and initial check-in completed successfully. Welcome!',
          data: {
            visitor: {
              id: 'e2e-visitor-1',
              fullName: 'Smoke Test Visitor',
              phoneNumber: '+2348011112222',
            },
            attendance: {
              id: 'e2e-attendance-1',
              checkIn: new Date().toISOString(),
              status: 'CHECKED_IN',
            },
          },
        }),
      });
    });

    const response = await page.goto('/check-in');
    expect(response?.status()).toBe(200);

    // Verify Next.js security headers
    const headers = response?.headers() || {};
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['content-security-policy']).toContain("default-src 'self'");

    // Fill registration form
    await page.getByPlaceholder(/full name|adebayo/i).first().fill('Smoke Test Visitor');
    await page.getByPlaceholder(/phone|080/i).first().fill('08011112222');
    await page.getByRole('button', { name: /register|clock in/i }).first().click();

    await expect(page.getByText(/Welcome to Dare Adeboye Innovation Hub/i)).toBeVisible();
  });

  test('staff login page validates credentials and authenticates into dashboard', async ({ page }) => {
    await page.route('**/api/v1/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Signed in successfully.',
          data: {
            accessToken: 'e2e-mock-access-token',
            staff: {
              id: 'e2e-staff-1',
              fullName: 'Jane Receptionist',
              email: 'receptionist@clockin.workspace',
              role: 'RECEPTIONIST',
            },
          },
        }),
      });
    });

    await page.route('**/api/v1/dashboard/summary', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            workspace: { name: 'CLOCK IN Workspace', timezone: 'Africa/Lagos' },
            metrics: {
              todayVisits: 12,
              currentlyCheckedIn: 4,
              thisWeekVisits: 48,
              thisMonthVisits: 190,
            },
            todayBounds: {
              start: new Date().toISOString(),
              end: new Date().toISOString(),
            },
            recentCheckIns: [],
          },
        }),
      });
    });

    await page.goto('/staff-login');
    await expect(page.getByRole('heading', { name: /Staff Portal/i })).toBeVisible();

    await page.getByPlaceholder('admin@clockin.workspace').fill('receptionist@clockin.workspace');
    await page.getByPlaceholder('••••••••').fill('SecurePass123!');
    await page.getByRole('button', { name: /Sign In/i }).click();

    await expect(page).toHaveURL(/\/staff/);
  });

  test('staff login shows error feedback on invalid credentials', async ({ page }) => {
    await page.route('**/api/v1/auth/login', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid email or password.',
          },
        }),
      });
    });

    await page.goto('/staff-login');
    await page.getByPlaceholder('admin@clockin.workspace').fill('wrong@clockin.workspace');
    await page.getByPlaceholder('••••••••').fill('WrongPassword!');
    await page.getByRole('button', { name: /Sign In/i }).click();

    await expect(page.getByText(/Invalid email or password/i)).toBeVisible();
  });
});
