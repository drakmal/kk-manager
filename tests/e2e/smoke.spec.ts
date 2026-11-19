import { expect, test } from '@playwright/test';

test('play an Easy Isnin and resume on Selasa after a reload', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./');
  for (const name of ['Easy', 'Medium', 'Hard']) await expect(page.getByRole('region', { name })).toBeVisible();
  await page.getByRole('region', { name: 'Easy' }).getByRole('button', { name: 'Start' }).click();
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByText(/^Isnin \d\d:\d\d$/)).toBeVisible();

  const report = page.getByRole('heading', { name: 'End of day · Isnin' });
  for (let i = 0; i < 30 && !(await report.isVisible()); i++) {
    const dialog = page.getByRole('dialog');
    if (await dialog.isVisible()) await dialog.getByRole('button').first().click();
    else await page.getByRole('button', { name: 'Skip ahead' }).click();
  }
  await expect(report).toBeVisible();
  await page.getByRole('button', { name: 'Continue to Selasa' }).click();
  await expect(page.getByText(/^Selasa \d\d:\d\d$/)).toBeVisible();

  await page.reload();
  await page.getByRole('button', { name: 'Continue (Selasa)' }).click();
  await expect(page.getByText(/^Selasa \d\d:\d\d$/)).toBeVisible();
  expect(errors).toEqual([]);
});
