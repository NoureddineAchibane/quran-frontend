import { test, expect } from '@playwright/test';
import { mockNetwork, goToRangeStep } from './helpers';

test.describe('ayah range selection', () => {
  test.beforeEach(async ({ page }) => { await mockNetwork(page); });

  test('whole-surah default loads every ayah of the surah', async ({ page }) => {
    await goToRangeStep(page);
    await expect(page.getByText('نطاق الآيات')).toBeVisible();
    await page.getByRole('button', { name: /استمع الآن/ }).click();
    // 4 mocked ayahs of الإخلاص rendered in the mushaf panel
    await expect(page.getByText('نص الآية رقم 1 من سورة 112')).toBeVisible();
    await expect(page.getByText('نص الآية رقم 4 من سورة 112')).toBeVisible();
  });

  test('custom range limits the loaded ayahs', async ({ page }) => {
    await goToRangeStep(page);
    // Switch off "whole surah" and pick 2–3
    await page.getByText('السورة كاملة').click();
    const selects = page.locator('select');
    await selects.first().selectOption('2');
    await selects.nth(1).selectOption('3');
    await page.getByRole('button', { name: /استمع الآن/ }).click();
    await expect(page.getByText('نص الآية رقم 2 من سورة 112')).toBeVisible();
    await expect(page.getByText('نص الآية رقم 3 من سورة 112')).toBeVisible();
    await expect(page.getByText('نص الآية رقم 1 من سورة 112')).toBeHidden();
    await expect(page.getByText('نص الآية رقم 4 من سورة 112')).toBeHidden();
  });

  test('ayahs are keyboard-focusable with accessible names', async ({ page }) => {
    await goToRangeStep(page);
    await page.getByRole('button', { name: /استمع الآن/ }).click();
    const ayah = page.getByRole('button', { name: /^الآية ٢$/ });
    await expect(ayah).toBeVisible();
    await ayah.focus();
    await expect(ayah).toBeFocused();
  });
});
