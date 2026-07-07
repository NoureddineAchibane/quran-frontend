import { test, expect } from '@playwright/test';
import { mockNetwork } from './helpers';

test.describe('mode selection', () => {
  test.beforeEach(async ({ page }) => { await mockNetwork(page); });

  test('mode screen is the first decision — all three modes offered', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /ورد يومي/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /حفظ/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /قراءة حرة/ })).toBeVisible();
  });

  test('selecting a mode reveals the wizard and shows the mode chip', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /ورد يومي/ }).click();
    // Overlay gone, step 1 (reciter picker) revealed
    await expect(page.getByText('اختر نوع جلستك اليوم')).toBeHidden();
    await expect(page.getByText('اختر القارئ')).toBeVisible();
    // Topbar chip reflects the active mode
    await expect(page.getByRole('button', { name: /تغيير الوضع/ })).toContainText('ورد');
  });

  test('hifd mode sorts surahs shortest-first in step 2', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /^حفظ/ }).click();
    await page.getByRole('button', { name: /القارئ عبد الباسط/ }).first().click();
    await page.getByRole('button', { name: /اختر السورة/ }).click();
    const options = page.getByRole('option');
    // الإخلاص (4 ayahs) must come before الفاتحة (7) before البقرة (286)
    await expect(options.first()).toContainText('الإخلاص');
    await expect(options.last()).toContainText('البقرة');
  });

  test('free mode hides the finish/tracking controls', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /قراءة حرة/ }).click();
    await page.getByRole('button', { name: /القارئ عبد الباسط/ }).first().click();
    await page.getByRole('button', { name: /اختر السورة/ }).click();
    await page.getByRole('option', { name: /الإخلاص/ }).click();
    await page.getByRole('button', { name: /حدد الآيات/ }).click();
    await page.getByRole('button', { name: /استمع الآن/ }).click();
    // Tracking hint only exists for wird/hifd sessions
    await expect(page.getByText(/سيظهر هنا زر تسجيل الإنجاز/)).toBeHidden();
  });
});
