"use client";
import { useState } from "react";
import {
  ArrowRightIcon,
  ChevronDownIcon,
  CheckIcon,
  BookmarkIcon,
} from "@radix-ui/react-icons";
import type { LearnerState } from "@/domain/models";

export function ProgressView({
  state,
  onPractice,
}: {
  state: LearnerState;
  onPractice: () => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const completed = state.sessions.filter(
    (s) => s.status === "completed" && s.turnCount > 0,
  );
  const turns = state.sessions.reduce((sum, s) => sum + s.turnCount, 0);
  const seconds = state.sessions.reduce((sum, s) => sum + s.activeSeconds, 0);
  const objectives = state.sessions.reduce(
    (sum, s) => sum + s.practicedObjectiveIds.length,
    0,
  );
  return (
    <section className="progress-view enter">
      <div className="page-heading">
        <p className="eyebrow">YOUR PERSONAL NOTEBOOK</p>
        <h1>
          Look how far
          <br />
          <em>your words go.</em>
        </h1>
        <p>Every attempt leaves a little something behind. Here’s yours.</p>
      </div>
      <div className="stats-grid">
        {[
          [completed.length, "Practices finished"],
          [turns, "Conversation turns"],
          [Math.floor(seconds / 60), "Active minutes, estimated"],
          [objectives, "Objectives tried"],
        ].map(([number, label]) => (
          <div key={label}>
            <strong>{String(number).padStart(2, "0")}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <div className="section-heading">
        <h2>Your conversations</h2>
        <button className="text-button" onClick={onPractice}>
          Back to practice <ArrowRightIcon />
        </button>
      </div>
      {state.sessions.length === 0 ? (
        <div className="empty-notebook">
          <BookmarkIcon />
          <h3>A fresh page. A good beginning.</h3>
          <p>
            Your first conversation will appear here. Start with one simple
            sentence.
          </p>
          <button className="button primary" onClick={onPractice}>
            Find a conversation <ArrowRightIcon />
          </button>
        </div>
      ) : (
        <ul className="history-list">
          {state.sessions.map((session) => (
            <li key={session.id}>
              <button
                className="history-row"
                aria-expanded={expanded === session.id}
                aria-controls={`record-${session.id}`}
                onClick={() =>
                  setExpanded(expanded === session.id ? null : session.id)
                }
              >
                <span className="history-icon">
                  {session.status === "completed" ? (
                    <CheckIcon />
                  ) : (
                    <BookmarkIcon />
                  )}
                </span>
                <span className="history-title">
                  <strong>{session.lesson.title}</strong>
                  <span>
                    {session.level} · {session.turnCount} turns ·{" "}
                    {session.practicedObjectiveIds.length}/
                    {session.lesson.objectives.length} objectives tried
                  </span>
                </span>
                <span className="history-status">
                  <span>
                    {session.status === "active"
                      ? "In progress"
                      : session.turnCount === 0
                        ? "Closed without practice"
                        : "Finished"}
                  </span>
                  <time dateTime={session.startedAt}>
                    {new Date(session.startedAt).toLocaleDateString("en", {
                      month: "short",
                      day: "numeric",
                    })}
                  </time>
                </span>
                <ChevronDownIcon
                  className={expanded === session.id ? "rotated" : ""}
                />
              </button>
              <div
                id={`record-${session.id}`}
                hidden={expanded !== session.id}
                className="history-transcript"
              >
                {session.memory.archivedMessages > 0 && (
                  <p className="field-help">
                    Earlier messages have been condensed. These are your most
                    recent turns.
                  </p>
                )}
                {session.messages.map((message) => (
                  <p key={message.id}>
                    <strong>
                      {message.role === "assistant" ? "Melissa" : "You"}
                    </strong>
                    <span>{message.text}</span>
                  </p>
                ))}
                {session.status === "active" && (
                  <button className="text-button" onClick={onPractice}>
                    Continue this conversation <ArrowRightIcon />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="measurement-note">
        A record of practice, not a CEFR assessment. Active minutes estimate
        time between messages, with idle gaps capped at two minutes. Vocabulary
        mastery and pronunciation are not measured.
      </p>
    </section>
  );
}
