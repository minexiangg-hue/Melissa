import { ArrowRightIcon, CheckIcon } from "@radix-ui/react-icons";
import type { LearnerState } from "@/domain/models";
export function ProgressView({
  state,
  onPractice,
}: {
  state: LearnerState;
  onPractice: () => void;
}) {
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
      <span className="section-kicker">Your practice, taking shape</span>
      <h1>Every attempt counts.</h1>
      <p className="lead">
        Build a habit at your own pace. Here’s what you’ve put into it so far.
      </p>
      <div className="stats-grid">
        <div>
          <strong>{completed.length.toString().padStart(2, "0")}</strong>
          <span>Practices finished</span>
        </div>
        <div>
          <strong>{turns.toString().padStart(2, "0")}</strong>
          <span>Conversation turns</span>
        </div>
        <div>
          <strong>
            {Math.floor(seconds / 60)
              .toString()
              .padStart(2, "0")}
          </strong>
          <span>Active minutes, estimated</span>
        </div>
        <div>
          <strong>{objectives.toString().padStart(2, "0")}</strong>
          <span>Objectives tried</span>
        </div>
      </div>
      <div className="history-header">
        <h2>Your practice notebook</h2>
        <button className="button secondary compact" onClick={onPractice}>
          Back to practice
          <ArrowRightIcon />
        </button>
      </div>
      {state.sessions.length === 0 ? (
        <div className="empty-state">
          <h3>A fresh page.</h3>
          <p>
            Your first conversation will appear here. Start with one simple
            sentence.
          </p>
        </div>
      ) : (
        <ul className="history-list">
          {state.sessions.map((session) => (
            <li key={session.id}>
              <span className="history-icon">
                <CheckIcon />
              </span>
              <div>
                <h3>{session.lesson.title}</h3>
                <p>
                  {session.level} · {session.turnCount} turns ·{" "}
                  {session.practicedObjectiveIds.length}/
                  {session.lesson.objectives.length} objectives tried
                </p>
              </div>
              <div className="history-status">
                <span>
                  {session.status === "active"
                    ? "In progress"
                    : session.turnCount === 0
                      ? "Closed without practice"
                      : "Finished"}
                </span>
                <time dateTime={session.startedAt}>
                  {new Date(session.startedAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </time>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="measurement-note">
        These are practice records, not a CEFR assessment. Active time is
        estimated from the time between messages, with idle gaps capped at two
        minutes. Voice, vocabulary mastery, and pronunciation are not measured.
      </p>
    </section>
  );
}
