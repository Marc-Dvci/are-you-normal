import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const player = () => `e2e${Math.random().toString(36).slice(2, 8)}`;

/** WCAG 2.2 A and AA rules; any violation fails the screen. */
const checkA11y = async (page: Page, screen: string) => {
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== 'running')
  );
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    result.violations.map(
      (v) =>
        `${screen}: ${v.id} ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`
    )
  ).toEqual([]);
};

const guessWithKeys = async (page: Page, presses: number) => {
  const crowd = page.getByRole('slider');
  await crowd.focus();
  for (let i = 0; i < presses; i++) await crowd.press('ArrowRight');
  await expect(crowd).toHaveAttribute('aria-valuenow', String(presses));
};

const playQuestion = async (page: Page, last: boolean) => {
  await page.locator('.form .row').first().click();
  await expect(page.locator('.guess-screen')).toBeVisible();
  await guessWithKeys(page, 30);
  await page.getByRole('button', { name: 'Lock my guess' }).click();
  await expect(page.locator('.reveal-screen')).toBeVisible();
  await expect(page.getByRole('img', { name: /^Stamped: / })).toBeVisible();
  await expect(page.locator('.source')).toContainText('Source:');
  await page
    .getByRole('button', { name: last ? 'See my day' : 'Next question' })
    .click();
};

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`${scheme} mode`, () => {
    test.use({ colorScheme: scheme });

    test('the feed card shows the first question and passes axe', async ({
      page,
    }) => {
      await page.goto(`/splash.html?user=${player()}`);
      await expect(page.locator('h1.question')).toBeVisible();
      await expect(page.locator('.form .row')).not.toHaveCount(0);
      await checkA11y(page, 'splash');
    });

    test('a full day: answer, guess, reveal, day card, each screen passes axe', async ({
      page,
    }) => {
      await page.goto(`/game.html?user=${player()}`);
      await expect(page.locator('.screen')).toBeVisible();
      await checkA11y(page, 'ask');
      await page.locator('.form .row').first().click();
      await expect(page.locator('.guess-screen')).toBeVisible();
      await checkA11y(page, 'guess');
      await guessWithKeys(page, 25);
      await page.getByRole('button', { name: 'Lock my guess' }).click();
      await expect(page.locator('.reveal-screen')).toBeVisible();
      await page.waitForTimeout(1200);
      await checkA11y(page, 'reveal');
      await page.getByRole('button', { name: 'Next question' }).click();
      await playQuestion(page, false);
      await playQuestion(page, true);
      await expect(page.locator('.day-screen')).toBeVisible();
      await expect(page.locator('.stats')).toContainText('/300');
      await expect(
        page.getByRole('button', { name: 'Post my verdict' })
      ).toBeVisible();
      await checkA11y(page, 'day');
    });
  });
}

test('tapping an answer in the feed opens the game at the guess', async ({
  page,
}) => {
  await page.goto(`/splash.html?user=${player()}`);
  await page.locator('.form .row').nth(1).click();
  await expect(page).toHaveURL(/game\.html/);
  await expect(page.locator('.guess-screen')).toBeVisible();
});

test('a logged-out player finishes the day and is offered a login', async ({
  page,
}) => {
  await page.goto('/game.html?user=anon');
  for (let q = 0; q < 3; q++) await playQuestion(page, q === 2);
  await expect(page.locator('.day-screen')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Log in to keep a streak' })
  ).toBeVisible();
});

test('after playing, the feed card shows the verdict instead of the question', async ({
  page,
}) => {
  const user = player();
  await page.goto(`/game.html?user=${user}`);
  for (let q = 0; q < 3; q++) await playQuestion(page, q === 2);
  await expect(page.locator('.day-screen')).toBeVisible();
  await page.goto(`/splash.html?user=${user}`);
  await expect(page.locator('.splash-done')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'See my results' })
  ).toBeVisible();
});
