import { DownloadIcon, InfoCircledIcon } from "@radix-ui/react-icons";
import type { Profile, Snapshot } from "@/domain/models";
import { ProfileForm } from "./profile-form";
export const teacherLabels = {
  demo: "Practice demo",
  "openai-compatible": "Connected AI",
  codex: "Codex companion",
};
export function Preferences({
  snapshot,
  busy,
  onSave,
  onExport,
  onDelete,
}: {
  snapshot: Snapshot;
  busy: boolean;
  onSave: (profile: Profile) => Promise<void>;
  onExport: () => void;
  onDelete: () => void;
}) {
  return (
    <section className="preferences enter">
      <div className="page-heading">
        <p className="eyebrow">MAKE YOURSELF AT HOME</p>
        <h1>
          Your pace.
          <br />
          <em>Your preferences.</em>
        </h1>
        <p>A few details to help Melissa meet you where you are.</p>
      </div>
      <div className="preferences-grid">
        <div className="preferences-form">
          <h2>A little about you</h2>
          <ProfileForm
            key={JSON.stringify(snapshot.state.profile)}
            profile={snapshot.state.profile}
            busy={busy}
            onSave={onSave}
          />
        </div>
        <aside className="data-settings">
          <h2>Your space, your data.</h2>
          <p>
            Your profile and practice records are saved on this server and
            linked to a private cookie in this browser. There is no account
            recovery or cross-device sync yet.
          </p>
          <p>
            Your guest session expires after 30 days. Clearing browser cookies
            disconnects you from your records.
          </p>
          <button
            className="button secondary"
            disabled={busy}
            onClick={onExport}
          >
            Export my practice data <DownloadIcon />
          </button>
          <button
            className="text-button danger"
            disabled={busy}
            onClick={onDelete}
          >
            Delete my profile and practice data
          </button>
          <div className="integration-status">
            <h3>A note on this edition</h3>
            <dl>
              <div>
                <dt>English companion</dt>
                <dd>{teacherLabels[snapshot.capabilities.teacher]}</dd>
              </div>
              <div>
                <dt>Personal lessons</dt>
                <dd>
                  {snapshot.capabilities.materialGeneration
                    ? "Available"
                    : "Not connected"}
                </dd>
              </div>
              <div>
                <dt>Read aloud</dt>
                <dd>Device voice, where available</dd>
              </div>
              <div>
                <dt>Microphone</dt>
                <dd>Not connected yet</dd>
              </div>
            </dl>
            <p className="field-help">
              <InfoCircledIcon />
              {snapshot.capabilities.teacher === "demo"
                ? "Demo replies are scripted. They do not assess your English."
                : "AI can make mistakes. Your messages are sent to the configured AI provider to create replies and lessons."}
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
