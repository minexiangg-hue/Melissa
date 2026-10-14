"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { SpeakerLoudIcon, StopIcon } from "@radix-ui/react-icons";

const subscribeToDevice = () => () => {};
const supportsSpeech = () =>
  "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;

export function SpeechButton({ text }: { text: string }) {
  const available = useSyncExternalStore(
    subscribeToDevice,
    supportsSpeech,
    () => false,
  );
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const supported =
      "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
    return () => {
      if (supported) window.speechSynthesis.cancel();
    };
  }, []);
  function speak() {
    if (!available) return;
    window.speechSynthesis.cancel();
    if (speaking) {
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.9;
    const voices = window.speechSynthesis.getVoices();
    const voice =
      voices.find((item) => item.lang === "en-US") ??
      voices.find((item) => item.lang.startsWith("en"));
    if (voice) utterance.voice = voice;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = (event) => {
      setSpeaking(false);
      if (event.error !== "interrupted" && event.error !== "canceled")
        setError("A voice isn’t available on this device.");
    };
    setError("");
    window.speechSynthesis.speak(utterance);
  }
  if (!available) return null;
  return (
    <span className="speech-control">
      <button
        type="button"
        className="listen-button"
        onClick={speak}
        aria-label={
          speaking ? "Stop reading aloud" : "Listen with device voice"
        }
        title="Uses your browser’s voice; availability varies by device"
      >
        {speaking ? <StopIcon /> : <SpeakerLoudIcon />}
        {speaking ? "Stop" : "Listen"}
      </button>
      {error && <small role="status">{error}</small>}
    </span>
  );
}
