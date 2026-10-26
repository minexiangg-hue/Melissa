"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { IDLE_SPEECH, SpeechController } from "./speech-client";

const subscribeToDevice = () => () => {};
const supportsDeviceVoice = () =>
  "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
const noDeviceVoice = () => false;
const serverSpeechState = () => IDLE_SPEECH;
const SpeechContext = createContext<{
  controller: SpeechController;
  enabled: boolean;
  blocked: boolean;
  deviceAvailable: boolean;
} | null>(null);

export function SpeechProvider({
  enabled,
  blocked,
  sessionEpoch,
  onSessionExpired,
  children,
}: {
  enabled: boolean;
  blocked: boolean;
  sessionEpoch: number;
  onSessionExpired: () => void;
  children: ReactNode;
}) {
  const [controller] = useState(() => new SpeechController(onSessionExpired));
  const deviceAvailable = useSyncExternalStore(
    subscribeToDevice,
    supportsDeviceVoice,
    noDeviceVoice,
  );
  useEffect(() => {
    controller.stop();
    return () => controller.stop();
  }, [controller, enabled, blocked, sessionEpoch]);
  useEffect(() => {
    const stop = () => controller.stop();
    window.addEventListener("pagehide", stop);
    return () => window.removeEventListener("pagehide", stop);
  }, [controller]);
  return (
    <SpeechContext.Provider
      value={{ controller, enabled, blocked, deviceAvailable }}
    >
      {children}
    </SpeechContext.Provider>
  );
}
export function useSpeech() {
  const context = useContext(SpeechContext);
  if (!context) throw new Error("SpeechButton must be inside SpeechProvider.");
  const state = useSyncExternalStore(
    context.controller.subscribe,
    context.controller.getSnapshot,
    serverSpeechState,
  );
  return { ...context, state };
}
