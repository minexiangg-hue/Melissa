"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowRightIcon,
  CheckIcon,
  ChatBubbleIcon,
  InfoCircledIcon,
  PaperPlaneIcon,
} from "@radix-ui/react-icons";
import type { Lesson, Session, Snapshot } from "@/domain/models";
export function LessonPicker({
  snapshot,
  busy,
  onStart,
}: {
  snapshot: Snapshot;
  busy: boolean;
  onStart: (id: string) => void;
}) {
  const [selected, setSelected] = useState(snapshot.lessons[0]!.id);
  const lesson =
    snapshot.lessons.find((item) => item.id === selected) ??
    snapshot.lessons[0]!;
  return (
    <div className="lesson-layout enter">
      <section className="lesson-feature">
        <div className="section-kicker">A little practice, every day</div>
        <h1>
          Find your words.
          <br />
          <span>Make them yours.</span>
        </h1>
        <p className="lead">
          A space to try, make mistakes, and feel a little more comfortable
          speaking English.
        </p>
        <div
          className="lesson-selection"
          role="group"
          aria-label="Choose a conversation"
        >
          {snapshot.lessons.map((item: Lesson) => (
            <button
              className={
                lesson.id === item.id
                  ? "lesson-option selected"
                  : "lesson-option"
              }
              key={item.id}
              aria-pressed={lesson.id === item.id}
              onClick={() => setSelected(item.id)}
            >
              <span>
                {item.goal === "everyday"
                  ? "Everyday"
                  : item.goal === "travel"
                    ? "Travel"
                    : "At work"}
              </span>
              <span className="option-icon">
                {lesson.id === item.id ? <CheckIcon /> : <ArrowRightIcon />}
              </span>
            </button>
          ))}
        </div>
        <div className="selected-lesson">
          <div className="meta">
            {lesson.level} practice · {snapshot.state.profile!.dailyMinutes}
            -minute goal
          </div>
          <h2>{lesson.title}</h2>
          <p>{lesson.description}</p>
          <button
            className="button primary"
            disabled={busy}
            onClick={() => onStart(lesson.id)}
          >
            {busy ? "Getting ready…" : "Start a conversation"}
            <ArrowRightIcon />
          </button>
        </div>
      </section>
      <aside className="practice-note">
        <div className="note-symbol">
          <ChatBubbleIcon />
        </div>
        <h2>
          Small steps.
          <br />
          More confidence.
        </h2>
        <p>
          Try saying your answer out loud before you type. A simple sentence is
          a good place to start.
        </p>
        <div className="note-divider" />
        <h3>In this conversation</h3>
        <ol className="objective-preview">
          {lesson.objectives.map((objective, i) => (
            <li key={objective.id}>
              <span>0{i + 1}</span>
              {objective.title}
            </li>
          ))}
        </ol>
        <div className="demo-note">
          <InfoCircledIcon />
          <p>
            This preview uses a scripted teacher. Live AI and voice practice are
            still to come.
          </p>
        </div>
      </aside>
    </div>
  );
}
export function PracticeRoom({
  session,
  busy,
  onSend,
  onFinish,
}: {
  session: Session;
  busy: boolean;
  onSend: (text: string) => Promise<boolean>;
  onFinish: () => void;
}) {
  const [draft, setDraft] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "instant", block: "nearest" });
  }, [session.messages.length, session.turnCount]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim() || busy) return;
    if (await onSend(draft.trim())) {
      setDraft("");
      input.current?.focus();
    }
  }
  return (
    <div className="room-layout enter">
      <section className="conversation" aria-label="Practice conversation">
        <header className="conversation-header">
          <div>
            <span className="meta">{session.level} · Guided text practice</span>
            <h1>{session.lesson.title}</h1>
          </div>
          <button
            className="button secondary compact"
            disabled={busy}
            onClick={onFinish}
          >
            Finish practice
          </button>
        </header>
        <div
          className="messages"
          role="log"
          aria-label="Conversation messages"
          aria-live="polite"
          aria-relevant="additions text"
        >
          {session.memory.archivedMessages > 0 && (
            <p className="context-note">
              Earlier turns are condensed into your practice record. Showing the
              latest conversation.
            </p>
          )}
          {session.messages.map((message) => (
            <article key={message.id} className={`message ${message.role}`}>
              <div className="message-avatar" aria-hidden="true">
                {message.role === "assistant" ? <ChatBubbleIcon /> : "You"}
              </div>
              <div className="message-body">
                <span className="message-name">
                  {message.role === "assistant" ? "Your teacher" : "You"}
                </span>
                <p>{message.text}</p>
              </div>
            </article>
          ))}
          {busy && (
            <p className="working" role="status">
              Getting your next prompt ready…
            </p>
          )}
          <div ref={bottom} />
        </div>
        <form className="composer" onSubmit={submit}>
          <label htmlFor="reply">Your turn</label>
          <textarea
            ref={input}
            id="reply"
            value={draft}
            maxLength={2000}
            rows={3}
            placeholder="Try saying it out loud, then type your answer…"
            onChange={(e) => setDraft(e.target.value)}
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
          <div className="composer-actions">
            <span id="reply-hint">
              Enter to send · Shift + Enter for a new line
            </span>
            <button
              className="button primary compact"
              disabled={busy || !draft.trim()}
              type="submit"
            >
              Send
              <PaperPlaneIcon />
            </button>
          </div>
        </form>
      </section>
      <aside className="lesson-guide">
        <span className="section-kicker">Your conversation guide</span>
        <h2>
          One thought <br />
          at a time.
        </h2>
        <p>Keep it simple. You can ask for an example whenever you need one.</p>
        <ol className="objectives">
          {session.lesson.objectives.map((o, i) => (
            <li
              key={o.id}
              className={
                session.practicedObjectiveIds.includes(o.id) ? "practiced" : ""
              }
            >
              <span className="objective-number">
                {session.practicedObjectiveIds.includes(o.id) ? (
                  <CheckIcon />
                ) : (
                  i + 1
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
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => setDraft("Could you give me an example?")}
        >
          Help me get started
        </button>
        <div className="voice-note">
          <InfoCircledIcon />
          <div>
            <strong>Voice practice is coming</strong>
            <p>
              Microphone input and spoken replies aren’t connected in this
              preview.
            </p>
          </div>
        </div>
        <p className="field-help">
          {session.turnCount} of 40 turns used. Checkmarks show participation,
          not proficiency.
        </p>
      </aside>
    </div>
  );
}
