import { afterEach, describe, expect, it } from "vitest";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import {
  KokoroSpeechProvider,
  MAX_SPEECH_AUDIO_BYTES,
  type KokoroSpeechProviderOptions,
} from "@/server/speech/provider";

const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((close) => close()));
});

const options: KokoroSpeechProviderOptions = {
  baseUrl: "http://127.0.0.1:1234",
  token: "private-kokoro-fixture-token",
  voice: "af_heart",
  speed: 0.9,
  timeoutMs: 1000,
};
const unavailable = {
  code: "PROVIDER_UNAVAILABLE",
  status: 503,
  message: "Melissa's voice is unavailable. Please try again.",
};
const signal = () => new AbortController().signal;

function wave(samples = 24): Buffer {
  const audio = Buffer.alloc(44 + samples * 2);
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
  audio.writeUInt32LE(samples * 2, 40);
  return audio;
}

function withExtraChunk(chunk: Buffer, at = 12): Buffer {
  const original = wave();
  const result = Buffer.concat([
    original.subarray(0, at),
    chunk,
    original.subarray(at),
  ]);
  result.writeUInt32LE(result.length - 8, 4);
  return result;
}

async function worker(
  handler: (request: IncomingMessage, response: ServerResponse) => void,
  overrides: Partial<KokoroSpeechProviderOptions> = {},
) {
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  cleanup.push(
    () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  );
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing fixture address.");
  return new KokoroSpeechProvider({
    ...options,
    baseUrl: `http://127.0.0.1:${address.port}/`,
    ...overrides,
  });
}

describe("Kokoro speech transport", () => {
  it("uses authenticated HTTP and resolves only after the complete WAV arrives", async () => {
    const audio = wave();
    let finish: (() => void) | undefined;
    let received!: () => void;
    const requestReceived = new Promise<void>((resolve) => {
      received = resolve;
    });
    let incoming: unknown;
    let auth: string | undefined;
    let path: string | undefined;
    const provider = await worker((req, res) => {
      auth = req.headers.authorization;
      path = req.url;
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        incoming = JSON.parse(body);
        res.writeHead(200, { "Content-Type": "audio/wav" });
        res.write(audio.subarray(0, 44));
        finish = () => res.end(audio.subarray(44));
        received();
      });
    });
    let finished = false;
    const pending = provider
      .synthesize("Hello, Melissa.", signal())
      .then((value) => {
        finished = true;
        return value;
      });
    await requestReceived;
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(finished).toBe(false);
    finish!();
    const result = await pending;
    expect(result.mimeType).toBe("audio/wav");
    expect(Buffer.from(await new Response(result.audio).arrayBuffer())).toEqual(
      audio,
    );
    expect(path).toBe("/v1/audio/speech");
    expect(auth).toBe(`Bearer ${options.token}`);
    expect(incoming).toEqual({
      input: "Hello, Melissa.",
      voice: "af_heart",
      speed: 0.9,
    });
    expect(JSON.stringify(incoming)).not.toContain(options.token);
  });

  it("accepts correctly padded WAV metadata without assuming a 44-byte data offset", async () => {
    const metadata = Buffer.alloc(10);
    metadata.write("JUNK");
    metadata.writeUInt32LE(1, 4);
    metadata[8] = 7;
    const audio = withExtraChunk(metadata);
    const provider = await worker((_req, res) => {
      res.setHeader("Content-Type", "audio/wav; charset=binary");
      res.end(audio);
    });
    const result = await provider.synthesize("Hello.", signal());
    expect(Buffer.from(await new Response(result.audio).arrayBuffer())).toEqual(
      audio,
    );
  });

  it.each([400, 401, 413, 429, 503])(
    "sanitizes worker HTTP %s responses",
    async (status) => {
      const provider = await worker((_req, res) => {
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: { code: options.token, message: "private learner text" },
          }),
        );
      });
      await expect(
        provider.synthesize("Hello.", signal()),
      ).rejects.toMatchObject(unavailable);
    },
  );

  it("rejects redirects without forwarding credentials to their target", async () => {
    let redirectedCalls = 0;
    const provider = await worker((req, res) => {
      if (req.url === "/target") redirectedCalls += 1;
      res.writeHead(307, { Location: "/target" });
      res.end();
    });
    await expect(provider.synthesize("Hello.", signal())).rejects.toMatchObject(
      unavailable,
    );
    expect(redirectedCalls).toBe(0);
  });

  it.each(["application/json", "audio/mpeg", "application/octet-stream"])(
    "rejects unexpected MIME type %s even with a WAV payload",
    async (mimeType) => {
      const provider = await worker((_req, res) => {
        res.setHeader("Content-Type", mimeType);
        res.end(wave());
      });
      await expect(
        provider.synthesize("Hello.", signal()),
      ).rejects.toMatchObject(unavailable);
    },
  );

  const malformed: Array<[string, () => Buffer]> = [
    ["short header", () => Buffer.from("RIFF")],
    [
      "high-bit container signature",
      () => {
        const b = wave();
        b[0] = 0xd2;
        return b;
      },
    ],
    [
      "wrong container",
      () => {
        const b = wave();
        b.write("RIFX");
        return b;
      },
    ],
    [
      "wrong RIFF length",
      () => {
        const b = wave();
        b.writeUInt32LE(0, 4);
        return b;
      },
    ],
    [
      "floating-point samples",
      () => {
        const b = wave();
        b.writeUInt16LE(3, 20);
        return b;
      },
    ],
    [
      "stereo",
      () => {
        const b = wave();
        b.writeUInt16LE(2, 22);
        return b;
      },
    ],
    [
      "wrong sample rate",
      () => {
        const b = wave();
        b.writeUInt32LE(48000, 24);
        return b;
      },
    ],
    [
      "wrong byte rate",
      () => {
        const b = wave();
        b.writeUInt32LE(24000, 28);
        return b;
      },
    ],
    [
      "wrong block alignment",
      () => {
        const b = wave();
        b.writeUInt16LE(1, 32);
        return b;
      },
    ],
    [
      "wrong bit depth",
      () => {
        const b = wave();
        b.writeUInt16LE(8, 34);
        return b;
      },
    ],
    ["empty samples", () => wave(0)],
    [
      "odd sample bytes",
      () => {
        const b = wave();
        b.writeUInt32LE(47, 40);
        return b;
      },
    ],
    [
      "chunk outside container",
      () => {
        const b = wave();
        b.writeUInt32LE(0xffffffff, 40);
        return b;
      },
    ],
    ["duplicate format", () => withExtraChunk(wave().subarray(12, 36), 36)],
    ["duplicate data", () => withExtraChunk(wave().subarray(36), 44 + 48)],
    [
      "missing data",
      () => {
        const b = wave();
        b.write("JUNK", 36);
        return b;
      },
    ],
    ["duration beyond 180 seconds", () => wave(24000 * 180 + 1)],
  ];
  it.each(malformed)("rejects %s", async (_name, makeAudio) => {
    const provider = await worker((_req, res) => {
      res.setHeader("Content-Type", "audio/wav");
      res.end(makeAudio());
    });
    await expect(provider.synthesize("Hello.", signal())).rejects.toMatchObject(
      unavailable,
    );
  });

  it.each(["declared", "chunked"])(
    "bounds %s oversized audio",
    async (mode) => {
      const provider = await worker((_req, res) => {
        res.setHeader("Content-Type", "audio/wav");
        if (mode === "declared") {
          res.setHeader("Content-Length", MAX_SPEECH_AUDIO_BYTES + 1);
          res.flushHeaders();
        } else {
          res.flushHeaders();
          res.end(Buffer.alloc(MAX_SPEECH_AUDIO_BYTES + 1));
        }
      });
      await expect(
        provider.synthesize("Hello.", signal()),
      ).rejects.toMatchObject(unavailable);
    },
  );

  it.each(["before headers", "during audio"])(
    "aborts on deadline %s",
    async (stage) => {
      const provider = await worker(
        (_req, res) => {
          if (stage === "during audio") {
            res.writeHead(200, { "Content-Type": "audio/wav" });
            res.write(wave().subarray(0, 44));
          }
        },
        { timeoutMs: 40 },
      );
      await expect(
        provider.synthesize("Hello.", signal()),
      ).rejects.toMatchObject(unavailable);
    },
  );

  it("honors caller cancellation while reading audio", async () => {
    let received!: () => void;
    const started = new Promise<void>((resolve) => {
      received = resolve;
    });
    const provider = await worker((_req, res) => {
      res.writeHead(200, { "Content-Type": "audio/wav" });
      res.write(wave().subarray(0, 44));
      received();
    });
    const controller = new AbortController();
    const pending = expect(
      provider.synthesize("Hello.", controller.signal),
    ).rejects.toMatchObject(unavailable);
    await started;
    controller.abort(new Error("private cancellation reason"));
    await pending;
  });

  it("does not send pre-cancelled or invalid input to the worker", async () => {
    let calls = 0;
    const provider = await worker((_req, res) => {
      calls += 1;
      res.end();
    });
    const controller = new AbortController();
    controller.abort();
    await expect(
      provider.synthesize("Hello.", controller.signal),
    ).rejects.toMatchObject(unavailable);
    for (const text of ["", "   ", "a".repeat(1601)])
      await expect(provider.synthesize(text, signal())).rejects.toMatchObject({
        code: "VALIDATION",
        status: 422,
      });
    expect(calls).toBe(0);
  });

  it("sanitizes a network failure", async () => {
    const provider = await worker((req) => req.socket.destroy());
    await expect(provider.synthesize("Hello.", signal())).rejects.toMatchObject(
      unavailable,
    );
  });
});

describe("Kokoro transport configuration", () => {
  it.each([
    "http://example.com",
    "http://10.0.0.1",
    "file:///tmp/worker",
    "https://username:private-token@example.com",
    "http://127.0.0.1?token=private-token",
    "http://127.0.0.1#private-token",
    "not a URL",
  ])("rejects unsafe endpoint %s", (baseUrl) => {
    expect(() => new KokoroSpeechProvider({ ...options, baseUrl })).toThrow(
      "Invalid Kokoro speech configuration.",
    );
  });

  it.each([
    "http://localhost:8000",
    "http://[::1]:8000",
    "https://speech.example.com",
  ])("accepts safe configured endpoint %s without contacting it", (baseUrl) => {
    expect(
      () => new KokoroSpeechProvider({ ...options, baseUrl }),
    ).not.toThrow();
  });

  it.each([
    { token: "" },
    { token: "private-token\r\nInjected: value" },
    { speed: 1 },
    { timeoutMs: 0 },
    { timeoutMs: 90_001 },
  ])("rejects invalid configuration safely", (override) => {
    expect(() => new KokoroSpeechProvider({ ...options, ...override })).toThrow(
      "Invalid Kokoro speech configuration.",
    );
  });
});
