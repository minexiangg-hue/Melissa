"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  BarChartIcon,
  ChatBubbleIcon,
  ExitIcon,
  GearIcon,
  ReaderIcon,
  ReloadIcon,
} from "@radix-ui/react-icons";
import type { Profile, Snapshot } from "@/domain/models";
import { api, ApiError } from "./api-client";
import { ProfileForm } from "./profile-form";
import { LessonPicker, PracticeRoom } from "./practice-room";
import { ProgressView } from "./progress-view";

type View = "practice" | "progress" | "profile";
export function TeacherApp() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [view, setView] = useState<View>("practice");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const bootstrap = useRef<Promise<Snapshot> | null>(null);
  const lock = useRef(false);
  const pendingMessage = useRef<{ requestId: string; text: string } | null>(
    null,
  );
  useEffect(() => {
    let mounted = true;
    bootstrap.current ??= api("bootstrap", "POST", {});
    bootstrap.current
      .then((data) => {
        if (mounted) setSnapshot(data);
      })
      .catch((err: unknown) => {
        if (mounted)
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load your practice.",
          );
      });
    return () => {
      mounted = false;
    };
  }, []);
  async function mutate(operation: () => Promise<Snapshot>): Promise<boolean> {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      setSnapshot(await operation());
      return true;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
      if (
        err instanceof ApiError &&
        ["CONFLICT", "NETWORK"].includes(err.code)
      ) {
        try {
          setSnapshot(await api("state"));
        } catch {
          /* Keep the current screen and draft available for retry. */
        }
      }
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function saveProfile(profile: Profile) {
    if (!snapshot) return;
    if (
      await mutate(() =>
        api("profile", "PUT", { revision: snapshot.state.revision, profile }),
      )
    ) {
      setView("practice");
      setNotice(
        "Your preferences are saved. They’ll apply to your next practice.",
      );
    }
  }
  async function sendMessage(text: string) {
    const active = snapshot?.state.sessions.find((s) => s.status === "active");
    if (!snapshot || !active) return false;
    if (pendingMessage.current?.text !== text)
      pendingMessage.current = { requestId: crypto.randomUUID(), text };
    const payload = {
      ...pendingMessage.current,
      revision: snapshot.state.revision,
    };
    const success = await mutate(() =>
      api(`sessions/${active.id}/messages`, "POST", payload),
    );
    if (success) pendingMessage.current = null;
    return success;
  }
  function exportData() {
    if (!snapshot) return;
    const blob = new Blob(
      [
        JSON.stringify(
          { exportedAt: new Date().toISOString(), ...snapshot.state },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "melissa-data.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function clearData() {
    if (
      !snapshot ||
      !window.confirm(
        "Delete your profile and all practice records for this guest session? This cannot be undone. Export your data first if you want to keep it.",
      )
    )
      return;
    await mutate(async () => {
      await api("data", "DELETE", { revision: snapshot.state.revision });
      pendingMessage.current = null;
      const fresh = await api("bootstrap", "POST", {});
      setView("practice");
      return fresh;
    });
  }
  const active = snapshot?.state.sessions.find((s) => s.status === "active");
  const profile = snapshot?.state.profile;
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to practice
      </a>
      <aside className="sidebar">
        <Link href="/" className="brand" aria-label="Melissa home">
          <span className="brand-mark">
            <ChatBubbleIcon />
          </span>
          <span>
            <b>Melissa</b>
          </span>
        </Link>
        <div className="sidebar-label">A little more confident.</div>
        <nav aria-label="Main navigation">
          {(
            [
              { id: "practice", label: "Practice", icon: ChatBubbleIcon },
              { id: "progress", label: "My progress", icon: BarChartIcon },
              { id: "profile", label: "Preferences", icon: GearIcon },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              aria-current={view === id ? "page" : undefined}
              onClick={() => {
                setView(id);
                setNotice("");
              }}
            >
              <Icon />
              {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <ReaderIcon />
          <p>
            Confidence comes
            <br />
            one conversation at a time.
          </p>
          {profile && (
            <div className="learner-chip">
              <span>{profile.displayName.slice(0, 1).toUpperCase()}</span>
              <div>
                <strong>{profile.displayName}</strong>
                <small>{profile.level} · Guest learner</small>
              </div>
            </div>
          )}
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span>
            {view === "practice"
              ? "Your daily English space"
              : view === "progress"
                ? "The work you’re putting in"
                : "Make yourself at home"}
          </span>
          <div className="mode-badge">Scripted demo</div>
        </header>
        <main id="main" tabIndex={-1}>
          {error && (
            <div className="alert error" role="alert">
              <span>{error}</span>
              <button
                className="button secondary compact"
                onClick={() => window.location.reload()}
              >
                <ReloadIcon />
                Refresh
              </button>
            </div>
          )}
          {notice && (
            <div className="alert notice" role="status">
              {notice}
            </div>
          )}
          {!snapshot ? (
            <div className="loading-state" role="status">
              <ChatBubbleIcon />
              <h1>
                {error ? "Let’s reconnect." : "Opening your practice space…"}
              </h1>
              <p>
                {error
                  ? "Refresh the page to try again."
                  : "Getting everything ready for your next conversation."}
              </p>
            </div>
          ) : !profile ? (
            <section className="onboarding enter">
              <div className="onboarding-copy">
                <span className="section-kicker">A good place to begin</span>
                <h1>
                  Your English.
                  <br />
                  Your own pace.
                </h1>
                <p className="lead">
                  Tell us a little about yourself. We’ll find a conversation to
                  start with.
                </p>
                <div className="onboarding-aside">
                  <span>01 / A starting point</span>
                  <p>
                    No placement test today. Pick the level that feels closest,
                    and adjust as you go.
                  </p>
                  <span>02 / A little consistency</span>
                  <p>Five focused minutes is a perfectly good beginning.</p>
                </div>
                <p className="field-help">
                  This is an early text practice preview with scripted replies.
                  It doesn’t assess your English.
                </p>
              </div>
              <div className="onboarding-form">
                <ProfileForm profile={null} busy={busy} onSave={saveProfile} />
              </div>
            </section>
          ) : view === "practice" ? (
            active ? (
              <PracticeRoom
                key={active.id}
                session={active}
                busy={busy}
                onSend={sendMessage}
                onFinish={() =>
                  void (async () => {
                    if (
                      await mutate(() =>
                        api(`sessions/${active.id}/finish`, "POST", {
                          revision: snapshot.state.revision,
                        }),
                      )
                    ) {
                      setView("progress");
                      pendingMessage.current = null;
                    }
                  })()
                }
              />
            ) : (
              <LessonPicker
                key={`${profile.level}-${profile.goal}`}
                snapshot={snapshot}
                busy={busy}
                onStart={(lessonId) =>
                  void mutate(() =>
                    api("sessions", "POST", {
                      revision: snapshot.state.revision,
                      lessonId,
                    }),
                  )
                }
              />
            )
          ) : view === "progress" ? (
            <ProgressView
              state={snapshot.state}
              onPractice={() => setView("practice")}
            />
          ) : (
            <section className="preferences enter">
              <span className="section-kicker">Made for your routine</span>
              <h1>A few things about you.</h1>
              <p className="lead">
                Preferences guide your next lesson. A practice already in
                progress keeps its original level.
              </p>
              <div className="preferences-grid">
                <ProfileForm
                  key={JSON.stringify(profile)}
                  profile={profile}
                  busy={busy}
                  onSave={saveProfile}
                />
                <aside className="data-settings">
                  <h2>Your space, your data.</h2>
                  <p>
                    Your profile and practice records are saved on this server
                    and linked to a private cookie in this browser. There is no
                    account recovery or cross-device sync yet.
                  </p>
                  <p>
                    The guest session expires after 30 days. Clearing browser
                    cookies disconnects you from your records.
                  </p>
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={exportData}
                  >
                    Export my practice data
                    <ExitIcon />
                  </button>
                  <button
                    className="text-button danger"
                    disabled={busy}
                    onClick={() => void clearData()}
                  >
                    Delete my profile and practice data
                  </button>
                  <div className="integration-status">
                    <h3>In this preview</h3>
                    <dl>
                      <div>
                        <dt>Teacher</dt>
                        <dd>Scripted demo</dd>
                      </div>
                      <div>
                        <dt>Voice & microphone</dt>
                        <dd>Not connected</dd>
                      </div>
                      <div>
                        <dt>Accounts & billing</dt>
                        <dd>Not connected</dd>
                      </div>
                    </dl>
                  </div>
                </aside>
              </div>
            </section>
          )}
        </main>
        <footer className="app-footer">
          <span>Room to make mistakes. Space to keep going.</span>
          {snapshot && (
            <span>
              {snapshot.state.usage.units.toLocaleString()} /{" "}
              {snapshot.dailyUnitLimit.toLocaleString()} demo units today{" "}
              <span title="An estimated demo allowance, not actual model tokens. Resets at midnight UTC.">
                (UTC)
              </span>
            </span>
          )}
        </footer>
      </div>
    </div>
  );
}
