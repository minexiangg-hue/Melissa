/** Browser-only playback resources are created on an explicit user action. */
const MAX_CHUNK_CHARACTERS = 1600;
const MAX_READING_CHARACTERS = 12000;
const MAX_AUDIO_BYTES = 9 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 100000;

export type SpeechMode = "kokoro" | "device";
export interface SpeechState {
  owner: string | null;
  phase: "idle" | "loading" | "ready" | "playing" | "error";
  mode: SpeechMode | null;
  error: string;
  part: number;
  total: number;
}
export const IDLE_SPEECH: SpeechState = {
  owner: null,
  phase: "idle",
  mode: null,
  error: "",
  part: 0,
  total: 0,
};
interface Playback {
  owner: string;
  mode: SpeechMode;
  chunks: string[];
  index: number;
  failed: boolean;
}
class SpeechError extends Error {
  constructor(
    message: string,
    readonly code = "SPEECH_UNAVAILABLE",
  ) {
    super(message);
  }
}

/** Each chunk is a trimmed, unchanged substring of the original owned text. */
export function splitSpeechText(text: string): string[] {
  if (text.length > MAX_READING_CHARACTERS)
    throw new SpeechError("This passage is too long to read aloud in one go.");
  const chunks: string[] = [];
  let remaining = text.trim();
  while (remaining.length > MAX_CHUNK_CHARACTERS) {
    let end = MAX_CHUNK_CHARACTERS;
    // Never divide a UTF-16 surrogate pair, even in an unbroken long word.
    const before = remaining.charCodeAt(end - 1);
    if (before >= 0xd800 && before <= 0xdbff) end -= 1;
    const window = remaining.slice(0, end);
    const boundaries = [...window.matchAll(/[.!?。！？]["”’')\]]*(?=\s|$)/g)];
    const sentence = boundaries.at(-1);
    const paragraph = window.lastIndexOf("\n");
    const sentenceEnd = sentence ? sentence.index! + sentence[0].length : 0;
    const naturalEnd = Math.max(sentenceEnd, paragraph);
    if (naturalEnd > end / 3) end = naturalEnd;
    else {
      const spaces = [...window.matchAll(/\s+/g)];
      const wordEnd = spaces.at(-1)?.index ?? 0;
      if (wordEnd > end / 3) end = wordEnd;
    }
    const chunk = remaining.slice(0, end).trim();
    if (chunk) chunks.push(chunk);
    remaining = remaining.slice(end).trim();
  }
  if (remaining) chunks.push(remaining);
  if (!chunks.length) throw new SpeechError("There is no text to read yet.");
  return chunks;
}

async function readAudio(response: Response): Promise<Blob> {
  const contentType = response.headers
    .get("content-type")
    ?.split(";")[0]
    ?.trim();
  if (!["audio/wav", "audio/x-wav", "audio/wave"].includes(contentType ?? "")) {
    await response.body?.cancel();
    throw new SpeechError(
      "The voice service returned an unreadable audio response. Please try again.",
    );
  }
  const advertisedLength = Number(response.headers.get("content-length") ?? 0);
  if (advertisedLength > MAX_AUDIO_BYTES) {
    await response.body?.cancel();
    throw new SpeechError(
      "This audio clip is too large to play. Try a shorter passage.",
    );
  }
  const reader = response.body?.getReader();
  if (!reader)
    throw new SpeechError(
      "The voice service returned no audio. Please try again.",
    );
  const pieces: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > MAX_AUDIO_BYTES) {
        await reader.cancel();
        throw new SpeechError(
          "This audio clip is too large to play. Try a shorter passage.",
        );
      }
      pieces.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const buffer = new Uint8Array(length);
  let offset = 0;
  for (const piece of pieces) {
    buffer.set(piece, offset);
    offset += piece.length;
  }
  const signature = new TextDecoder("ascii");
  if (
    length < 44 ||
    signature.decode(buffer.subarray(0, 4)) !== "RIFF" ||
    signature.decode(buffer.subarray(8, 12)) !== "WAVE"
  )
    throw new SpeechError(
      "The voice service returned incomplete audio. Please try again.",
    );
  return new Blob([buffer.buffer], { type: "audio/wav" });
}

/** One owner, one playback channel, no persisted text or audio cache. */
export class SpeechController {
  private state: SpeechState = IDLE_SPEECH;
  private listeners = new Set<() => void>();
  private playback: Playback | null = null;
  private request: AbortController | null = null;
  private audio: HTMLAudioElement | null = null;
  private audioUrl: string | null = null;
  private utterance: SpeechSynthesisUtterance | null = null;
  private deadline: ReturnType<typeof setTimeout> | null = null;
  constructor(private readonly onSessionExpired: () => void) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(state: SpeechState) {
    this.state = state;
    for (const listener of this.listeners) listener();
  }
  private update(playback: Playback, phase: SpeechState["phase"], error = "") {
    if (this.playback !== playback || (playback.failed && phase !== "error"))
      return;
    this.publish({
      owner: playback.owner,
      mode: playback.mode,
      phase,
      error,
      part: playback.index + 1,
      total: playback.chunks.length,
    });
  }
  private clearDeadline() {
    if (this.deadline !== null) clearTimeout(this.deadline);
    this.deadline = null;
  }
  private releaseAudio() {
    if (this.audio) {
      this.audio.onended = null;
      this.audio.onerror = null;
      this.audio.onplaying = null;
      this.audio.pause();
      this.audio.removeAttribute("src");
      this.audio.load();
    }
    if (this.audioUrl) URL.revokeObjectURL(this.audioUrl);
    this.audioUrl = null;
  }
  private releaseDevice() {
    if (this.utterance) {
      this.utterance.onstart = null;
      this.utterance.onend = null;
      this.utterance.onerror = null;
      this.utterance = null;
      window.speechSynthesis.cancel();
    }
  }
  stop = (owner?: string) => {
    if (owner && this.state.owner !== owner) return;
    this.playback = null;
    this.request?.abort();
    this.request = null;
    this.clearDeadline();
    this.releaseAudio();
    this.audio = null;
    this.releaseDevice();
    this.publish(IDLE_SPEECH);
  };
  private fail(playback: Playback, error: unknown) {
    if (this.playback !== playback || playback.failed) return;
    playback.failed = true;
    this.request?.abort();
    this.request = null;
    this.clearDeadline();
    this.releaseAudio();
    this.releaseDevice();
    this.update(
      playback,
      "error",
      error instanceof SpeechError
        ? error.message
        : "We couldn’t prepare the audio. Please try again.",
    );
    if (error instanceof SpeechError && error.code === "UNAUTHENTICATED")
      this.onSessionExpired();
  }
  start = (owner: string, text: string, mode: SpeechMode, startIndex = 0) => {
    this.stop();
    let chunks: string[];
    try {
      chunks = splitSpeechText(text);
    } catch (error) {
      this.publish({
        owner,
        mode,
        phase: "error",
        error:
          error instanceof Error
            ? error.message
            : "This text cannot be read aloud.",
        part: 0,
        total: 0,
      });
      return;
    }
    const playback: Playback = {
      owner,
      mode,
      chunks,
      index: Math.min(startIndex, chunks.length - 1),
      failed: false,
    };
    this.playback = playback;
    this.update(playback, "loading");
    if (mode === "device") {
      this.speakDevice(playback);
      return;
    }
    // Create the reusable element in the click handler, before awaiting fetch.
    this.audio = new Audio();
    this.audio.preload = "auto";
    void this.loadChunk(playback);
  };
  retry = (owner: string, text: string, mode: SpeechMode) => {
    const index =
      this.state.owner === owner &&
      this.state.mode === mode &&
      this.state.phase === "error"
        ? Math.max(0, this.state.part - 1)
        : 0;
    this.start(owner, text, mode, index);
  };
  playReady = (owner: string) => {
    const playback = this.playback;
    if (playback && playback.owner === owner && this.state.phase === "ready")
      void this.playAudio(playback);
  };
  private async loadChunk(playback: Playback) {
    if (this.playback !== playback || playback.failed) return;
    this.releaseAudio();
    this.update(playback, "loading");
    const request = new AbortController();
    this.request = request;
    let timedOut = false;
    this.deadline = setTimeout(() => {
      timedOut = true;
      request.abort();
    }, REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/v1/speech/synthesis`,
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          signal: request.signal,
          headers: { "Content-Type": "application/json", Accept: "audio/wav" },
          body: JSON.stringify({
            requestId: crypto.randomUUID(),
            text: playback.chunks[playback.index],
          }),
        },
      );
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new SpeechError(
          typeof error?.error?.message === "string"
            ? error.error.message.slice(0, 500)
            : "Melissa’s voice is unavailable right now. Please try again.",
          response.status === 401 ? "UNAUTHENTICATED" : error?.error?.code,
        );
      }
      const blob = await readAudio(response);
      if (this.playback !== playback || request.signal.aborted) return;
      this.clearDeadline();
      this.request = null;
      this.audioUrl = URL.createObjectURL(blob);
      const audio = this.audio!;
      audio.src = this.audioUrl;
      audio.onplaying = () => this.update(playback, "playing");
      audio.onended = () => this.advance(playback);
      audio.onerror = () =>
        this.fail(
          playback,
          new SpeechError(
            "This browser couldn’t play the audio. Try again or use a device voice.",
          ),
        );
      await this.playAudio(playback);
    } catch (error) {
      if (this.playback !== playback) return;
      this.fail(
        playback,
        timedOut
          ? new SpeechError("The audio is taking too long. Please try again.")
          : error,
      );
    } finally {
      // An older aborted request must not clear the next owner's deadline.
      if (this.request === request) {
        this.clearDeadline();
        this.request = null;
      }
    }
  }
  private async playAudio(playback: Playback) {
    if (this.playback !== playback || playback.failed || !this.audio) return;
    try {
      await this.audio.play();
      if (this.playback === playback && !playback.failed)
        this.update(playback, "playing");
    } catch (error) {
      if (this.playback !== playback || playback.failed) return;
      if (error instanceof DOMException && error.name === "NotAllowedError")
        this.update(playback, "ready");
      else
        this.fail(
          playback,
          new SpeechError(
            "This browser couldn’t play the audio. Try again or use a device voice.",
          ),
        );
    }
  }
  private advance(playback: Playback) {
    if (this.playback !== playback || playback.failed) return;
    this.clearDeadline();
    if (playback.index + 1 >= playback.chunks.length) {
      this.stop(playback.owner);
      return;
    }
    playback.index += 1;
    if (playback.mode === "kokoro") void this.loadChunk(playback);
    else this.speakDevice(playback);
  }
  private speakDevice(playback: Playback) {
    if (
      !("speechSynthesis" in window) ||
      !("SpeechSynthesisUtterance" in window)
    ) {
      this.fail(
        playback,
        new SpeechError("A device voice isn’t available in this browser."),
      );
      return;
    }
    this.releaseDevice();
    const utterance = new SpeechSynthesisUtterance(
      playback.chunks[playback.index],
    );
    this.utterance = utterance;
    utterance.lang = "en-US";
    utterance.rate = 0.9;
    const voices = window.speechSynthesis.getVoices();
    const voice =
      voices.find((item) => item.lang === "en-US") ??
      voices.find((item) => item.lang.startsWith("en"));
    if (voice) utterance.voice = voice;
    this.update(playback, "loading");
    utterance.onstart = () => this.update(playback, "playing");
    utterance.onend = () => {
      this.utterance = null;
      this.advance(playback);
    };
    utterance.onerror = () =>
      this.fail(
        playback,
        new SpeechError("The device voice could not finish. Please try again."),
      );
    this.deadline = setTimeout(
      () =>
        this.fail(
          playback,
          new SpeechError(
            "The device voice stopped responding. Please try again.",
          ),
        ),
      180000,
    );
    try {
      window.speechSynthesis.speak(utterance);
    } catch {
      this.fail(
        playback,
        new SpeechError("A device voice isn’t available right now."),
      );
    }
  }
}
