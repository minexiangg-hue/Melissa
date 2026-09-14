import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("learner can set up, practice, resume, finish, export and delete", async ({
  page,
}, testInfo) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("./");
  await expect(page).toHaveTitle("Melissa · A little more confident");
  await expect(page.getByRole("link", { name: "Melissa home" })).toBeVisible();
  await page.getByLabel("What should we call you?").fill("Mei");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.getByRole("button", { name: "Make room for practice" }).click();
  await expect(
    page.getByRole("heading", { name: "Find your words." }),
  ).toBeVisible();
  await page.screenshot({
    path: `.data/review-${testInfo.project.name}-home.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Start a conversation" }).click();
  await expect(
    page.getByRole("heading", { name: "A conversation over coffee" }),
  ).toBeVisible();
  await page.getByLabel("Your turn").fill("Hello, I am Mei. I live nearby.");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    page.getByText("Tried in this practice", { exact: true }),
  ).toHaveCount(1);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `.data/review-${testInfo.project.name}-room.png`,
    fullPage: true,
  });
  await page.reload();
  await expect(
    page.getByText("Hello, I am Mei. I live nearby.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Help me get started" }).click();
  await expect(page.getByLabel("Your turn")).toHaveValue(
    "Could you give me an example?",
  );
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByText(/Try this:/)).toBeVisible();
  await page.getByRole("button", { name: "Finish practice" }).click();
  await expect(
    page.getByRole("heading", { name: "Every attempt counts." }),
  ).toBeVisible();
  await expect(page.getByText("Finished", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Preferences", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export my practice data" }).click();
  expect((await download).suggestedFilename()).toBe("melissa-data.json");
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Delete my profile and practice data" })
    .click();
  await expect(page.getByLabel("What should we call you?")).toHaveValue("");
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("failed request keeps draft and allows retry", async ({ page }) => {
  await page.goto("./");
  await page.getByLabel("What should we call you?").fill("Lin");
  await page.getByRole("button", { name: "Make room for practice" }).click();
  await page.getByRole("button", { name: "Start a conversation" }).click();
  await page.route(
    "**/api/v1/sessions/*/messages",
    (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "PROVIDER_UNAVAILABLE",
            message: "The teacher is unavailable. Please try again.",
          },
        }),
      }),
    { times: 1 },
  );
  await page.getByLabel("Your turn").fill("Hi, I am Lin.");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "teacher is unavailable",
  );
  await expect(page.getByLabel("Your turn")).toHaveValue("Hi, I am Lin.");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByLabel("Your turn")).toHaveValue("");
  await expect(page.getByText("Hi, I am Lin.", { exact: true })).toBeVisible();
});
