import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function createProfile(page: Page, name = "Mei") {
  await page.goto("./");
  await page.getByLabel("What should we call you?").fill(name);
  await page.getByRole("button", { name: "Make room for practice" }).click();
  await expect(
    page.getByRole("heading", { name: "Small talk." }),
  ).toBeVisible();
}
async function accessible(page: Page) {
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
}

test("learner can set up, practice, resume, finish, export and delete", async ({
  page,
}, testInfo) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("./");
  await expect(page).toHaveTitle("Melissa · A little more you");
  await expect(page.getByRole("link", { name: "Melissa home" })).toBeVisible();
  await page.getByLabel("What should we call you?").fill("Mei");
  await accessible(page);
  await page.getByRole("button", { name: "Make room for practice" }).click();
  await expect(
    page.getByRole("heading", { name: "Small talk." }),
  ).toBeVisible();
  await page.screenshot({
    path: `.data/review-${testInfo.project.name}-home.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Start a conversation", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A conversation over coffee" }),
  ).toBeVisible();
  await page.getByLabel("Your turn").fill("Hello, I am Mei. I live nearby.");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    page.getByText("Tried in this practice", { exact: true }),
  ).toHaveCount(1);
  await accessible(page);
  await page.screenshot({
    path: `.data/review-${testInfo.project.name}-room.png`,
    fullPage: true,
  });
  await page.reload();
  await expect(
    page.getByText("Hello, I am Mei. I live nearby.", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Your turn")
    .fill("Keep this draft while I look around.");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Your notebook", exact: true })
    .click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "In conversation", exact: true })
    .click();
  await expect(page.getByLabel("Your turn")).toHaveValue(
    "Keep this draft while I look around.",
  );
  await page.getByRole("button", { name: "Help me get started" }).click();
  await expect(page.getByLabel("Your turn")).toHaveValue(
    "Could you give me an example?",
  );
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByText(/Try this:/)).toBeVisible();
  await page.getByRole("button", { name: "Finish practice" }).click();
  await expect(
    page.getByRole("heading", { name: "Look how far" }),
  ).toBeVisible();
  await expect(page.getByText("Finished", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: /A conversation over coffee.*Finished/ })
    .click();
  await expect(
    page.getByText("Hello, I am Mei. I live nearby.", { exact: true }),
  ).toBeVisible();
  await accessible(page);
  await page.getByRole("button", { name: "Preferences", exact: true }).click();
  await accessible(page);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export my practice data" }).click();
  expect((await download).suggestedFilename()).toBe("melissa-data.json");
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Delete my profile and practice data" })
    .click();
  await expect(page.getByLabel("What should we call you?")).toHaveValue("");
  expect(errors).toEqual([]);
  await accessible(page);
});

test("failed request preserves draft and a spent attempt gets a new request identity", async ({
  page,
}) => {
  await createProfile(page, "Lin");
  await page
    .getByRole("button", { name: "Start a conversation", exact: true })
    .click();
  const requestIds: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/messages"))
      requestIds.push(request.postDataJSON().requestId as string);
  });
  await page.route(
    "**/api/v1/sessions/*/messages",
    (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "RETRY_REQUIRED",
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
  expect(requestIds).toHaveLength(2);
  expect(requestIds[0]).not.toBe(requestIds[1]);
  await page.route(
    "**/api/v1/sessions/*/messages",
    async (route) => {
      await route.fetch();
      await route.abort("connectionreset");
    },
    { times: 1 },
  );
  await page
    .getByLabel("Your turn")
    .fill("I enjoy finding quiet places to read.");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "reach the server",
  );
  await expect(page.getByLabel("Your turn")).toHaveValue(
    "I enjoy finding quiet places to read.",
  );
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByLabel("Your turn")).toHaveValue("");
  await expect(
    page.getByText("I enjoy finding quiet places to read.", { exact: true }),
  ).toHaveCount(1);
  expect(requestIds).toHaveLength(4);
  expect(requestIds[2]).toBe(requestIds[3]);
});

test("learners generate, read, check, revisit, and practice a personal lesson", async ({
  page,
}, testInfo) => {
  test.setTimeout(90000);
  await createProfile(page);
  await page
    .getByRole("button", { name: "Lesson library", exact: true })
    .click();
  await accessible(page);
  await page
    .getByRole("button", { name: "Travel & discovery", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Find your way around" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Meet your new teammate" }),
  ).toHaveCount(0);
  await page
    .getByLabel("What would you like to talk about?")
    .fill("A museum visit");
  await page.getByLabel("Lesson focus").selectOption("travel");
  await page
    .getByRole("button", { name: "Create my lesson", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A small check-in." }),
  ).toBeVisible();
  const title = await page.locator(".material-heading h1").innerText();
  await accessible(page);
  const firstExercise = page.locator(".exercise").first();
  await firstExercise.getByRole("radio").first().check();
  await expect(firstExercise.getByRole("status")).toBeVisible();
  await page.screenshot({
    path: `.data/review-${testInfo.project.name}-material.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Your lesson library", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Made for you" }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Lesson library", exact: true })
    .click();
  await page.locator(".material-item").filter({ hasText: title }).click();
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Practice this lesson" }).click();
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Your turn")
    .fill("I would like to visit the museum, please.");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    page.getByText("I would like to visit the museum, please.", {
      exact: true,
    }),
  ).toBeVisible();
});

test("dark appearance keeps onboarding and learning spaces accessible", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("./");
  await page.getByLabel("What should we call you?").waitFor();
  await accessible(page);
  await page.getByLabel("What should we call you?").fill("Jules");
  await page.getByRole("button", { name: "Make room for practice" }).click();
  await expect(
    page.getByRole("heading", { name: "Small talk." }),
  ).toBeVisible();
  await accessible(page);
  await page
    .getByRole("button", { name: "Start a conversation", exact: true })
    .click();
  await page.getByLabel("Your turn").waitFor();
  await accessible(page);
});

test("pending replies preserve new writing and expired guests can reconnect without losing drafts", async ({
  page,
  context,
}) => {
  test.setTimeout(90000);
  await createProfile(page, "Rae");
  await page
    .getByRole("button", { name: "Start a conversation", exact: true })
    .click();
  let releaseReply!: () => void;
  const release = new Promise<void>((resolve) => {
    releaseReply = resolve;
  });
  await page.route(
    "**/api/v1/sessions/*/messages",
    async (route) => {
      const response = await route.fetch();
      await release;
      await route.fulfill({ response });
    },
    { times: 1 },
  );
  await page.getByLabel("Your turn").fill("I am interested in photography.");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Send", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Your notebook", exact: true })
    .click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "In conversation", exact: true })
    .click();
  await page
    .getByLabel("Your turn")
    .fill("Here is the next thought I want to keep.");
  releaseReply();
  await expect(
    page.getByText("I am interested in photography.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Your turn")).toHaveValue(
    "Here is the next thought I want to keep.",
  );
  await expect(
    page.getByRole("button", { name: "Send", exact: true }),
  ).toBeEnabled();
  await context.clearCookies();
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Reconnect your guest session" }),
  ).toBeVisible();
  await expect(page.getByLabel("Your turn")).toHaveValue(
    "Here is the next thought I want to keep.",
  );
  await page
    .getByRole("button", { name: "Reconnect with a new session" })
    .click();
  await page.getByLabel("What should we call you?").fill("Rae again");
  await page.getByRole("button", { name: "Make room for practice" }).click();
  await page
    .getByRole("button", { name: "Start a conversation", exact: true })
    .click();
  await expect(page.getByLabel("Your turn")).toHaveValue(
    "Here is the next thought I want to keep.",
  );
  await page.getByRole("button", { name: "Preferences", exact: true }).click();
  await page.route(
    "**/api/v1/bootstrap",
    (route) => route.abort("connectionreset"),
    { times: 1 },
  );
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Delete my profile and practice data" })
    .click();
  await expect(
    page.getByRole("button", { name: "Try again", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("What should we call you?")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Export my practice data" }),
  ).toHaveCount(0);
  await expect(page.getByText("Rae again", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByLabel("What should we call you?")).toHaveValue("");
});

test("exports include lessons created in another tab and their source catalog", async ({
  page,
  context,
}) => {
  test.setTimeout(90000);
  await createProfile(page);
  const other = await context.newPage();
  await other.goto("./");
  await other
    .getByRole("button", { name: "Lesson library", exact: true })
    .click();
  await other
    .getByLabel("What would you like to talk about?")
    .fill("A work meeting");
  await other
    .getByRole("button", { name: "Create my lesson", exact: true })
    .click();
  await expect(
    other.getByRole("heading", { name: "A small check-in." }),
  ).toBeVisible();
  const lessonTitle = await other.locator(".material-heading h1").innerText();
  await page.getByRole("button", { name: "Preferences", exact: true }).click();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export my practice data" }).click();
  const download = await downloadEvent;
  const { readFile } = await import("node:fs/promises");
  const exported = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(exported.materials).toHaveLength(1);
  expect(exported.materials[0].title).toBe(lessonTitle);
  expect(exported.knowledge.sources.length).toBeGreaterThan(0);
  expect(exported).toHaveProperty("aiUsage");
  await other.close();
});
