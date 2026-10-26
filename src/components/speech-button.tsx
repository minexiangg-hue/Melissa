"use client";
import { useEffect, useId } from "react";
import {
  PlayIcon,
  ReloadIcon,
  SpeakerLoudIcon,
  StopIcon,
} from "@radix-ui/react-icons";
import { useSpeech } from "./speech-context";

export function SpeechButton({ text }: { text: string }) {
  const id = useId();
  const { controller, state, enabled, blocked, deviceAvailable } = useSpeech();
  useEffect(() => () => controller.stop(id), [controller, id, text]);
  if (!enabled && !deviceAvailable) return null;
  const own = state.owner === id;
  const phase = own ? state.phase : "idle";
  const mode = own ? state.mode! : enabled ? "kokoro" : "device";
  const voice = mode === "kokoro" ? "Melissa voice" : "Device voice";
  const pending = phase === "loading";
  const playing = phase === "playing";
  const ready = phase === "ready";
  const failed = phase === "error";
  const action = blocked
    ? "Reconnect to listen"
    : pending
      ? "Cancel"
      : playing
        ? "Stop"
        : ready
          ? "Play"
          : failed
            ? "Retry"
            : "Listen";
  const Icon =
    pending || playing
      ? StopIcon
      : ready
        ? PlayIcon
        : failed
          ? ReloadIcon
          : SpeakerLoudIcon;
  function activate() {
    if (blocked) return;
    if (pending || playing) controller.stop(id);
    else if (ready) controller.playReady(id);
    else if (failed) controller.retry(id, text, mode);
    else controller.start(id, text, enabled ? "kokoro" : "device");
  }
  return (
    <span className="speech-control">
      <button
        type="button"
        className="listen-button"
        onClick={activate}
        disabled={blocked}
        aria-label={`${action} with ${voice.toLowerCase()}`}
        aria-describedby={
          own && (failed || ready || pending)
            ? `${id}-speech-status`
            : undefined
        }
      >
        <Icon />
        <span>{action}</span>
        <span className="speech-voice-label">{voice}</span>
      </button>
      {ready && (
        <button
          type="button"
          className="listen-button speech-secondary"
          onClick={() => controller.stop(id)}
        >
          Cancel audio
        </button>
      )}
      {own && state.total > 1 && phase !== "error" && (
        <small>
          Part {state.part} of {state.total}
        </small>
      )}
      {own && (failed || ready || pending) && (
        <small
          id={`${id}-speech-status`}
          className={failed ? "speech-error" : ""}
          role="status"
        >
          {failed
            ? state.error
            : ready
              ? "Audio is ready. Tap Play to hear it."
              : mode === "kokoro"
                ? "Preparing audio… You can cancel anytime."
                : "Starting your device voice…"}
        </small>
      )}
      {failed && mode === "kokoro" && deviceAvailable && !blocked && (
        <button
          type="button"
          className="listen-button speech-secondary"
          onClick={() => controller.start(id, text, "device")}
        >
          Use device voice instead
        </button>
      )}
    </span>
  );
}
