import { expect, test, type Page } from "@playwright/test";

interface SpeechHarness {
  active: HTMLMediaElement | null;
  plays: string[];
  created: string[];
  revoked: string[];
  overlaps: number;
  blockNext: boolean;
  deviceStarts: number;
  deviceCancels: number;
  deviceActive: SpeechSynthesisUtterance | null;
  finish: () => void;
}
declare global {
  interface Window {
    __speechHarness: SpeechHarness;
  }
}

const wave = (() => {
  // A real, short mono PCM WAV; playback scheduling is controlled by the harness.
  const audio = Buffer.alloc(44 + 4800);
  audio.write("RIFF", 0);
  audio.writeUInt32LE(audio.length - 8, 4);
  audio.write("WAVEfmt ", 8);
  audio.writeUInt32LE(16, 16);
  audio.writeUInt16LE(1, 20);
  audio.writeUInt16LE(1, 22);
  audio.writeUInt32LE(24000, 24);
  audio.writeUInt32LE(48000, 28);
  audio.writeUInt16LE(2, 32);
  audio.writeUInt16LE(16, 34);
  audio.write("data", 36);
  audio.writeUInt32LE(4800, 40);
  return audio;
})();

async function setup(page: Page, assistantText?: string) {
  await page.addInitScript(() => {
    const state: SpeechHarness = {
      active: null,
      plays: [],
      created: [],
      revoked: [],
      overlaps: 0,
      blockNext: false,
      deviceStarts: 0,
      deviceCancels: 0,
      deviceActive: null,
      finish() {
        const active = state.active;
        state.active = null;
        active?.dispatchEvent(new Event("ended"));
      },
    };
    window.__speechHarness = state;
    const createUrl = URL.createObjectURL.bind(URL);
    const revokeUrl = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (blob) => {
      const url = createUrl(blob);
      state.created.push(url);
      return url;
    };
    URL.revokeObjectURL = (url) => {
      state.revoked.push(url);
      revokeUrl(url);
    };
    HTMLMediaElement.prototype.play = function () {
      if (state.blockNext) {
        state.blockNext = false;
        return Promise.reject(
          new DOMException("A user gesture is required", "NotAllowedError"),
        );
      }
      if (state.active && state.active !== this) state.overlaps += 1;
      state.active = this;
      state.plays.push(this.src);
      this.dispatchEvent(new Event("playing"));
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function () {
      if (state.active === this) state.active = null;
    };
    HTMLMediaElement.prototype.load = function () {};
    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      configurable: true,
      value: class {
        constructor(public text: string) {}
      },
    });
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        getVoices: () => [{ lang: "en-US" }],
        cancel: () => {
          state.deviceCancels += 1;
          state.deviceActive = null;
        },
        speak: (utterance: SpeechSynthesisUtterance) => {
          if (state.active) state.overlaps += 1;
          state.deviceStarts += 1;
          state.deviceActive = utterance;
          utterance.onstart?.call(
            utterance,
            new Event("start") as SpeechSynthesisEvent,
          );
        },
      },
    });
  });
  await page.route("**/api/v1/**", async (route) => {
    if (route.request().url().includes("/speech/")) {
      await route.fallback();
      return;
    }
    const response = await route.fetch();
    const data = await response.json();
    if (data.capabilities) data.capabilities.textToSpeech = true;
    if (assistantText && data.state?.sessions?.[0]) {
      const first = data.state.sessions[0].messages.find(
        (message: { role: string }) => message.role === "assistant",
      );
      if (first) first.text = assistantText;
    }
    await route.fulfill({ response, json: data });
  });
  await page.goto("./");
  await page.getByLabel("What should we call you?").fill("Voice learner");
  await page.getByRole("button", { name: "Make room for practice" }).click();
  await page
    .getByRole("button", { name: "Start a conversation", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Listen with melissa voice" }),
  ).toBeVisible();
}

const speechPath = "**/api/v1/speech/synthesis";
const listen = (page: Page) =>
  page.getByRole("button", { name: "Listen with melissa voice" });
const stop = (page: Page) =>
  page.getByRole("button", { name: "Stop with melissa voice" });

test("Kokoro playback is click-gated, exclusive, and released when leaving the view", async ({
  page,
}) => {
  await setup(page);
  const requests: { requestId: string; text: string }[] = [];
  await page.route(speechPath, async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ contentType: "audio/wav", body: wave });
  });
  expect(requests).toHaveLength(0);
  await page.getByLabel("Your turn").fill("I enjoy taking walks.");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(listen(page)).toHaveCount(2);
  await listen(page).first().click();
  await expect(stop(page)).toHaveCount(1);
  await listen(page).click();
  await expect.poll(() => requests.length).toBe(2);
  await expect(stop(page)).toHaveCount(1);
  expect(requests[0]!.requestId).not.toBe(requests[1]!.requestId);
  expect(requests[0]!.text).toContain("We have just met");
  expect(await page.evaluate(() => window.__speechHarness.overlaps)).toBe(0);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Your notebook" })
    .click();
  expect(
    await page.evaluate(() => window.__speechHarness.active === null),
  ).toBe(true);
  expect(
    await page.evaluate(
      () =>
        window.__speechHarness.created.length ===
        window.__speechHarness.revoked.length,
    ),
  ).toBe(true);
});

test("preparation can be cancelled and a timed-out request offers an explicit retry", async ({
  page,
}) => {
  await setup(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(speechPath, async (route) => {
    await held;
    await route
      .fulfill({ contentType: "audio/wav", body: wave })
      .catch(() => {});
  });
  await listen(page).click();
  await page.getByRole("button", { name: "Cancel with melissa voice" }).click();
  await expect(listen(page)).toBeVisible();
  release();
  expect(await page.evaluate(() => window.__speechHarness.plays)).toEqual([]);
  await page.unroute(speechPath);
  let releaseTimeout!: () => void;
  const timeoutHeld = new Promise<void>((resolve) => {
    releaseTimeout = resolve;
  });
  await page.route(speechPath, async (route) => {
    await timeoutHeld;
    await route
      .fulfill({ contentType: "audio/wav", body: wave })
      .catch(() => {});
  });
  await page.clock.install();
  await listen(page).click();
  await expect(
    page.getByText("Preparing audio… You can cancel anytime."),
  ).toBeVisible();
  await page.clock.fastForward(100001);
  await expect(
    page.getByRole("button", { name: "Retry with melissa voice" }),
  ).toBeVisible();
  await expect(
    page.getByText("The audio is taking too long. Please try again."),
  ).toBeVisible();
  releaseTimeout();
  expect(await page.evaluate(() => window.__speechHarness.plays)).toEqual([]);
});

test("a blocked mobile autoplay offers Play without a second synthesis request", async ({
  page,
}) => {
  await setup(page);
  let requests = 0;
  await page.route(speechPath, async (route) => {
    requests += 1;
    await route.fulfill({ contentType: "audio/wav", body: wave });
  });
  await page.evaluate(() => {
    window.__speechHarness.blockNext = true;
  });
  await listen(page).click();
  await expect(
    page.getByRole("button", { name: "Play with melissa voice" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Play with melissa voice" }).click();
  await expect(stop(page)).toBeVisible();
  expect(requests).toBe(1);
  await stop(page).click();
  await expect(listen(page)).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        window.__speechHarness.created.length ===
        window.__speechHarness.revoked.length,
    ),
  ).toBe(true);
});

test("service failures retry explicitly and device fallback is clearly selected", async ({
  page,
}) => {
  await setup(page);
  const requests: string[] = [];
  let unavailable = true;
  await page.route(speechPath, async (route) => {
    requests.push(route.request().postDataJSON().requestId);
    if (unavailable)
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        json: {
          error: {
            code: "SPEECH_UNAVAILABLE",
            message: "Melissa’s voice is warming up. Please try again.",
          },
        },
      });
    else await route.fulfill({ contentType: "audio/wav", body: wave });
  });
  await listen(page).click();
  await expect(
    page.getByRole("button", { name: "Retry with melissa voice" }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.__speechHarness.deviceStarts)).toBe(
    0,
  );
  unavailable = false;
  await page.getByRole("button", { name: "Retry with melissa voice" }).click();
  await expect(stop(page)).toBeVisible();
  expect(requests).toHaveLength(2);
  expect(requests[0]).not.toBe(requests[1]);
  await stop(page).click();
  unavailable = true;
  await listen(page).click();
  await page.getByRole("button", { name: "Use device voice instead" }).click();
  await expect(
    page.getByRole("button", { name: "Stop with device voice" }),
  ).toBeVisible();
  expect(requests).toHaveLength(3);
  expect(await page.evaluate(() => window.__speechHarness.deviceStarts)).toBe(
    1,
  );
  await page.getByRole("button", { name: "Stop with device voice" }).click();
  expect(
    await page.evaluate(() => window.__speechHarness.deviceActive),
  ).toBeNull();
});

test("long passages preserve owned text and play bounded chunks in sequence", async ({
  page,
}) => {
  const passage =
    "A".repeat(1599) +
    "🙂" +
    "B".repeat(1000) +
    "\n\n" +
    "Now pause and read this sentence carefully. ".repeat(20);
  await setup(page, passage);
  const chunks: string[] = [];
  const ids: string[] = [];
  await page.route(speechPath, async (route) => {
    const body = route.request().postDataJSON();
    chunks.push(body.text);
    ids.push(body.requestId);
    await route.fulfill({ contentType: "audio/wav", body: wave });
  });
  await listen(page).click();
  await expect(stop(page)).toBeVisible();
  expect(chunks).toHaveLength(1);
  for (let index = 2; index <= 3; index += 1) {
    await page.evaluate(() => window.__speechHarness.finish());
    await expect.poll(() => chunks.length).toBe(index);
    await expect(stop(page)).toBeVisible();
  }
  await page.evaluate(() => window.__speechHarness.finish());
  await expect(listen(page)).toBeVisible();
  expect(new Set(ids).size).toBe(3);
  let offset = 0;
  for (const chunk of chunks) {
    expect(chunk.length).toBeLessThanOrEqual(1600);
    expect(chunk).not.toMatch(/^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/u);
    const position = passage.indexOf(chunk, offset);
    expect(position).toBeGreaterThanOrEqual(offset);
    expect(passage.slice(offset, position).trim()).toBe("");
    offset = position + chunk.length;
  }
  expect(passage.slice(offset).trim()).toBe("");
  expect(await page.evaluate(() => window.__speechHarness.overlaps)).toBe(0);
  expect(
    await page.evaluate(
      () =>
        window.__speechHarness.created.length ===
        window.__speechHarness.revoked.length,
    ),
  ).toBe(true);
});

test("speech authentication failures enter the existing reconnect flow", async ({
  page,
}) => {
  await setup(page);
  await page.route(speechPath, (route) =>
    route.fulfill({
      status: 401,
      json: {
        error: {
          code: "UNAUTHENTICATED",
          message: "Your guest session expired.",
        },
      },
    }),
  );
  await listen(page).click();
  await expect(
    page.getByRole("region", { name: "Reconnect your guest session" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Reconnect to listen with melissa voice",
    }),
  ).toBeDisabled();
  expect(await page.evaluate(() => window.__speechHarness.active)).toBeNull();
});
