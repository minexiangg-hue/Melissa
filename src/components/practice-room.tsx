"use client";
import { useEffect, useRef, type FormEvent } from "react";
import {
  ArrowLeftIcon,
  CheckIcon,
  PaperPlaneIcon,
  Pencil2Icon,
} from "@radix-ui/react-icons";
import type { Session } from "@/domain/models";
import { MelissaAvatar } from "./brand";
import { SpeechButton } from "./speech-button";

export function PracticeRoom({
  session,
  busy,
  draft,
  onDraft,
  onSend,
  onFinish,
  onBack,
}: {
  session: Session;
  busy: boolean;
  draft: string;
  onDraft: (text: string) => void;
  onSend: (text: string) => Promise<boolean>;
  onFinish: () => void;
  onBack: () => void;
}) {
  const bottom = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const messageList = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const list = messageList.current;
    if (!list) return;
    let atBottom = true;
    const trackPosition = () => {
      atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 40;
    };
    const observer = new ResizeObserver(() => {
      if (atBottom) list.scrollTop = list.scrollHeight;
    });
    list.addEventListener("scroll", trackPosition, { passive: true });
    observer.observe(list);
    return () => {
      observer.disconnect();
      list.removeEventListener("scroll", trackPosition);
    };
  }, []);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "instant", block: "nearest" });
  }, [session.messages.length, session.turnCount]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim() || busy) return;
    const submitted = draft.trim();
    if (await onSend(submitted)) {
      input.current?.focus();
    }
  }
  function help() {
    onDraft("Could you give me an example?");
    input.current?.focus();
  }
  return (
    <div className="practice-page enter">
      <div className="practice-topline">
        <button className="text-button" onClick={onBack}>
          <ArrowLeftIcon /> Your studio
        </button>
        <span>{session.level} / ONE CONVERSATION AT A TIME</span>
      </div>
      <div className="room-layout">
        <section className="conversation" aria-label="Practice conversation">
          <header className="conversation-header">
            <div>
              <p className="number-label">IN CONVERSATION WITH MELISSA</p>
              <h1>{session.lesson.title}</h1>
            </div>
            <button
              className="button secondary compact"
              disabled={busy}
              onClick={onFinish}
            >
              Finish practice <CheckIcon />
            </button>
          </header>
          <div
            className="messages"
            ref={messageList}
            role="log"
            aria-label="Conversation messages"
            aria-live="polite"
            aria-relevant="additions text"
          >
            {session.memory.archivedMessages > 0 && (
              <p className="context-note">
                Earlier turns are condensed into your practice record. Showing
                the latest conversation.
              </p>
            )}
            {session.messages.map((message) => (
              <article key={message.id} className={`message ${message.role}`}>
                <div className="message-avatar" aria-hidden="true">
                  {message.role === "assistant" ? (
                    <MelissaAvatar size={46} />
                  ) : (
                    <span>Y</span>
                  )}
                </div>
                <div className="message-body">
                  <span className="message-name">
                    {message.role === "assistant" ? "Melissa" : "You"}
                  </span>
                  <p>{message.text}</p>
                  {message.role === "assistant" && (
                    <SpeechButton text={message.text} />
                  )}
                </div>
              </article>
            ))}
            {busy && (
              <div className="working" role="status">
                <span className="thinking-dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                Melissa is finding the right words…
              </div>
            )}
            <div ref={bottom} />
          </div>
          <form className="composer" onSubmit={submit}>
            <label htmlFor="reply">
              Your turn <span>There’s no perfect way to begin.</span>
            </label>
            <div className="composer-input">
              <textarea
                ref={input}
                id="reply"
                value={draft}
                maxLength={2000}
                rows={3}
                placeholder="Put a little of your world into words…"
                onChange={(e) => onDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey &&
                    !e.nativeEvent.isComposing
                  ) {
                    e.preventDefault();
                    e.currentTarget.form?.requestSubmit();
                  }
                }}
                aria-describedby="reply-hint"
              />
              <button
                className="send-button"
                disabled={busy || !draft.trim()}
                type="submit"
                aria-label="Send"
              >
                <PaperPlaneIcon />
              </button>
            </div>
            <div className="composer-actions">
              <span id="reply-hint">
                Enter to send · Shift + Enter for a new line
              </span>
              <span>{draft.length} / 2,000</span>
            </div>
          </form>
        </section>
        <aside className="lesson-guide">
          <span className="guide-symbol">
            <Pencil2Icon />
          </span>
          <h2>
            A little
            <br />
            <em>direction.</em>
          </h2>
          <p>One thought at a time. We’ll find the words together.</p>
          <ol className="objectives">
            {session.lesson.objectives.map((o, i) => (
              <li
                key={o.id}
                className={
                  session.practicedObjectiveIds.includes(o.id)
                    ? "practiced"
                    : ""
                }
              >
                <span className="objective-number">
                  {session.practicedObjectiveIds.includes(o.id) ? (
                    <CheckIcon />
                  ) : (
                    String(i + 1).padStart(2, "0")
                  )}
                </span>
                <span>
                  {o.title}
                  <small>
                    {session.practicedObjectiveIds.includes(o.id)
                      ? "Tried in this practice"
                      : "Ready when you are"}
                  </small>
                </span>
              </li>
            ))}
          </ol>
          <button className="button secondary" disabled={busy} onClick={help}>
            Help me get started <Pencil2Icon />
          </button>
          <div className="guide-footnote">
            <strong>A note from Melissa</strong>
            <p>
              Making a mistake is a useful part of finding your voice. Try
              first. We can refine it together.
            </p>
          </div>
          <p className="field-help">
            {session.turnCount} of 40 turns used. Checkmarks show participation,
            not proficiency. Device voices are optional; microphone input is not
            available yet.
          </p>
        </aside>
      </div>
    </div>
  );
}
