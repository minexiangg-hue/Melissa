import "server-only";
import { AppError } from "@/domain/errors";
import type { TextToSpeechProvider } from "@/domain/ports";

export const MAX_SPEECH_TEXT_CHARACTERS = 1600;
export const MAX_SPEECH_TEXT_BYTES = 8 * 1024;
export const MAX_SPEECH_AUDIO_BYTES = 9_000_000;
export const MAX_SPEECH_DURATION_MS = 180_000;

export interface KokoroSpeechProviderOptions {
  baseUrl: string;
  token: string;
  voice: "af_heart";
  speed: number;
  timeoutMs: number;
}

function unavailable() {
  return new AppError(
    "PROVIDER_UNAVAILABLE",
    "Melissa's voice is unavailable. Please try again.",
    503,
  );
}

function endpointFor(options: KokoroSpeechProviderOptions): string {
  try {
    const url = new URL(options.baseUrl);
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !["http:", "https:"].includes(url.protocol) ||
      (url.protocol === "http:" &&
        !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) ||
      !/^[\x21-\x7e]{1,8192}$/.test(options.token) ||
      options.voice !== "af_heart" ||
      options.speed !== 0.9 ||
      !Number.isInteger(options.timeoutMs) ||
      options.timeoutMs < 1 ||
      options.timeoutMs > 90_000
    )
      throw new Error();
    url.pathname = `${url.pathname.replace(/\/+$/, "")}/v1/audio/speech`;
    return url.href;
  } catch {
    // Configuration errors must not expose credentials or private addresses.
    throw new Error("Invalid Kokoro speech configuration.");
  }
}

async function readAudio(response: Response): Promise<Buffer> {
  const length = response.headers.get("content-length");
  if (
    !response.body ||
    (length !== null &&
      (!/^\d+$/.test(length) || Number(length) > MAX_SPEECH_AUDIO_BYTES))
  )
    throw unavailable();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_SPEECH_AUDIO_BYTES) throw unavailable();
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  return Buffer.concat(chunks, size);
}

/** Accept bounded RIFF PCM audio, including correctly padded metadata chunks. */
function validateWave(audio: Buffer): void {
  if (
    audio.length < 46 ||
    audio.toString("latin1", 0, 4) !== "RIFF" ||
    audio.toString("latin1", 8, 12) !== "WAVE" ||
    audio.readUInt32LE(4) !== audio.length - 8
  )
    throw unavailable();

  let formatSeen = false;
  let dataSeen = false;
  let offset = 12;
  while (offset < audio.length) {
    if (audio.length - offset < 8) throw unavailable();
    const kind = audio.toString("latin1", offset, offset + 4);
    const size = audio.readUInt32LE(offset + 4);
    const start = offset + 8;
    const end = start + size;
    const next = end + (size % 2);
    if (next > audio.length) throw unavailable();

    if (kind === "fmt ") {
      if (
        formatSeen ||
        (size !== 16 && size !== 18) ||
        (size === 18 && audio.readUInt16LE(start + 16) !== 0) ||
        audio.readUInt16LE(start) !== 1 ||
        audio.readUInt16LE(start + 2) !== 1 ||
        audio.readUInt32LE(start + 4) !== 24_000 ||
        audio.readUInt32LE(start + 8) !== 48_000 ||
        audio.readUInt16LE(start + 12) !== 2 ||
        audio.readUInt16LE(start + 14) !== 16
      )
        throw unavailable();
      formatSeen = true;
    } else if (kind === "data") {
      if (
        !formatSeen ||
        dataSeen ||
        size === 0 ||
        size % 2 !== 0 ||
        (size / 48_000) * 1000 > MAX_SPEECH_DURATION_MS
      )
        throw unavailable();
      dataSeen = true;
    }
    offset = next;
  }
  if (!formatSeen || !dataSeen) throw unavailable();
}

/** The worker finishes before this resolves; the returned stream is buffered WAV. */
export class KokoroSpeechProvider implements TextToSpeechProvider {
  private readonly endpoint: string;
  private readonly options: Readonly<KokoroSpeechProviderOptions>;

  constructor(options: KokoroSpeechProviderOptions) {
    this.endpoint = endpointFor(options);
    this.options = { ...options };
  }

  async synthesize(text: string, signal: AbortSignal) {
    if (
      typeof text !== "string" ||
      !text.trim() ||
      text.length > MAX_SPEECH_TEXT_CHARACTERS ||
      Buffer.byteLength(text, "utf8") > MAX_SPEECH_TEXT_BYTES
    )
      throw new AppError(
        "VALIDATION",
        "Choose a shorter passage to read aloud.",
        422,
      );

    const controller = new AbortController();
    const combined = AbortSignal.any([signal, controller.signal]);
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs);
    let response: Response | undefined;
    try {
      combined.throwIfAborted();
      response = await fetch(this.endpoint, {
        method: "POST",
        redirect: "error",
        cache: "no-store",
        signal: combined,
        headers: {
          "Content-Type": "application/json",
          Accept: "audio/wav",
          Authorization: `Bearer ${this.options.token}`,
        },
        body: JSON.stringify({
          input: text,
          voice: this.options.voice,
          speed: this.options.speed,
        }),
      });
      if (
        response.status !== 200 ||
        response.headers
          .get("content-type")
          ?.split(";")[0]
          ?.trim()
          .toLowerCase() !== "audio/wav"
      )
        throw unavailable();
      const audio = await readAudio(response);
      combined.throwIfAborted();
      validateWave(audio);
      return {
        mimeType: "audio/wav",
        audio: new ReadableStream<Uint8Array>({
          start(stream) {
            stream.enqueue(audio);
            stream.close();
          },
        }),
      };
    } catch {
      // Do not forward worker bodies, raw network errors, audio, or credentials.
      throw unavailable();
    } finally {
      clearTimeout(timer);
      await response?.body?.cancel().catch(() => undefined);
    }
  }
}
