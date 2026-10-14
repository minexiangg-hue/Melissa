"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowTopRightIcon,
  BookmarkIcon,
  ChatBubbleIcon,
  GearIcon,
  HomeIcon,
  ReaderIcon,
  ReloadIcon,
} from "@radix-ui/react-icons";
import type { Goal, Profile, Snapshot } from "@/domain/models";
import type { LearningMaterial } from "@/domain/learning/models";
import { api, ApiError } from "./api-client";
import { BrandMark, MelissaAvatar } from "./brand";
import { Onboarding } from "./onboarding";
import { Studio } from "./studio";
import { LessonLibrary } from "./lesson-library";
import { PracticeRoom } from "./practice-room";
import { ProgressView } from "./progress-view";
import { Preferences, teacherLabels } from "./preferences";

type View = "studio" | "library" | "practice" | "notebook" | "preferences";
const views: View[] = [
  "studio",
  "library",
  "practice",
  "notebook",
  "preferences",
];
export function TeacherApp() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [view, setView] = useState<View>("studio");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reconnectNeeded, setReconnectNeeded] = useState(false);
  const [recoveredDraft, setRecoveredDraft] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const bootstrap = useRef<Promise<Snapshot> | null>(null);
  const lock = useRef(false);
  const pendingMessage = useRef<{ requestId: string; text: string } | null>(
    null,
  );
  const pendingMaterial = useRef<{
    requestId: string;
    topic: string;
    goal: Goal;
  } | null>(null);
  useEffect(() => {
    let mounted = true;
    bootstrap.current ??= api("bootstrap", "POST", {});
    bootstrap.current
      .then((data) => {
        if (!mounted) return;
        setSnapshot(data);
        const hash = window.location.hash.slice(1) as View;
        setView(
          views.includes(hash)
            ? hash
            : data.state.sessions.some((s) => s.status === "active")
              ? "practice"
              : "studio",
        );
      })
      .catch((err: unknown) => {
        if (mounted)
          setError(
            err instanceof Error
              ? err.message
              : "Unable to open your practice space.",
          );
      });
    const onHash = () => {
      const hash = window.location.hash.slice(1) as View;
      if (views.includes(hash)) setView(hash);
    };
    window.addEventListener("hashchange", onHash);
    return () => {
      mounted = false;
      window.removeEventListener("hashchange", onHash);
    };
  }, []);
  function navigate(next: View) {
    setView(next);
    setNotice("");
    window.history.replaceState(null, "", `#${next}`);
    document.getElementById("main")?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  async function mutate(
    operation: () => Promise<Snapshot>,
  ): Promise<Snapshot | null> {
    if (lock.current) return null;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const data = await operation();
      setSnapshot(data);
      return data;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
      if (err instanceof ApiError && err.code === "UNAUTHENTICATED")
        setReconnectNeeded(true);
      if (err instanceof ApiError && err.code === "RETRY_REQUIRED") {
        pendingMessage.current = null;
        pendingMaterial.current = null;
      }
      if (
        err instanceof ApiError &&
        ["CONFLICT", "NETWORK"].includes(err.code)
      ) {
        try {
          setSnapshot(await api("state"));
        } catch (refreshError) {
          if (
            refreshError instanceof ApiError &&
            refreshError.code === "UNAUTHENTICATED"
          )
            setReconnectNeeded(true);
          /* Keep local drafts and the current screen for explicit recovery. */
        }
      }
      return null;
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
      navigate("studio");
      if (snapshot.state.profile)
        setNotice("Your preferences are saved for your next conversation.");
    }
  }
  async function startLesson(lessonId: string) {
    if (!snapshot) return;
    const current = snapshot.state.sessions.find(
      (session) => session.status === "active",
    );
    if (current && current.lesson.id !== lessonId) {
      navigate("practice");
      setNotice(
        "Finish this conversation before beginning a new one. Your lessons will be waiting in the library.",
      );
      return;
    }
    const data = await mutate(() =>
      api("sessions", "POST", { revision: snapshot.state.revision, lessonId }),
    );
    if (data) {
      pendingMessage.current = null;
      const nextSession = data.state.sessions.find(
        (session) => session.status === "active",
      );
      if (recoveredDraft && nextSession) {
        setDrafts((previous) => ({
          ...previous,
          [nextSession.id]: recoveredDraft,
        }));
        setRecoveredDraft("");
      }
      navigate("practice");
      if (recoveredDraft)
        setNotice(
          "Your unsent reply is ready below. Keep it or start with something new.",
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
    if (success) {
      pendingMessage.current = null;
      setDrafts((previous) =>
        previous[active.id]?.trim() === text
          ? { ...previous, [active.id]: "" }
          : previous,
      );
    }
    return !!success;
  }
  async function generateMaterial(
    topic: string,
    goal: Goal,
  ): Promise<LearningMaterial | null> {
    if (!snapshot) return null;
    if (
      pendingMaterial.current?.topic !== topic ||
      pendingMaterial.current?.goal !== goal
    )
      pendingMaterial.current = { requestId: crypto.randomUUID(), topic, goal };
    const request = pendingMaterial.current;
    const data = await mutate(() =>
      api("materials", "POST", {
        ...request,
        revision: snapshot.state.revision,
      }),
    );
    if (!data) return null;
    pendingMaterial.current = null;
    return (
      data.state.materials.find(
        (item) => item.requestId === request.requestId,
      ) ?? null
    );
  }
  async function finishPractice() {
    const active = snapshot?.state.sessions.find((s) => s.status === "active");
    if (!snapshot || !active) return;
    if (
      await mutate(() =>
        api(`sessions/${active.id}/finish`, "POST", {
          revision: snapshot.state.revision,
        }),
      )
    ) {
      pendingMessage.current = null;
      navigate("notebook");
    }
  }
  function downloadSnapshot(data: Snapshot) {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            {
              exportedAt: new Date().toISOString(),
              ...data.state,
              knowledge: data.knowledge,
              aiUsage: data.aiUsage,
              unsentDrafts: drafts,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "melissa-data.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function exportData() {
    const fresh = await mutate(() => api("state"));
    if (fresh) downloadSnapshot(fresh);
  }
  async function reconnect() {
    const current = snapshot?.state.sessions.find(
      (session) => session.status === "active",
    );
    const unsent = current ? (drafts[current.id] ?? "") : recoveredDraft;
    const fresh = await mutate(() => api("bootstrap", "POST", {}));
    if (!fresh) return;
    pendingMessage.current = null;
    pendingMaterial.current = null;
    setReconnectNeeded(false);
    setRecoveredDraft(unsent);
    navigate("studio");
    setNotice(
      "A fresh guest session is open. Set up your profile to continue; your unsent reply is kept for your next conversation.",
    );
  }
  async function clearData() {
    if (
      !snapshot ||
      !window.confirm(
        "Delete your profile, lessons, and all practice records for this guest session? This cannot be undone. Export your data first if you want to keep it.",
      )
    )
      return;
    await mutate(async () => {
      await api("data", "DELETE", { revision: snapshot.state.revision });
      setSnapshot(null);
      setReconnectNeeded(false);
      setRecoveredDraft("");
      pendingMessage.current = null;
      pendingMaterial.current = null;
      setDrafts({});
      const fresh = await api("bootstrap", "POST", {});
      navigate("studio");
      return fresh;
    });
  }
  const active = snapshot?.state.sessions.find((s) => s.status === "active");
  const profile = snapshot?.state.profile;
  return (
    <div
      className={`app-shell${view === "practice" && active ? " practice-active" : ""}`}
    >
      <a className="skip-link" href="#main">
        Skip to your learning space
      </a>
      <aside className="sidebar">
        <Link href="/" className="brand" aria-label="Melissa home">
          <BrandMark />
          <span>
            Melissa<span className="brand-period">.</span>
          </span>
        </Link>
        <p className="brand-caption">A LITTLE MORE YOU</p>
        <nav aria-label="Main navigation">
          {(
            [
              { id: "studio", label: "Your studio", icon: HomeIcon },
              { id: "library", label: "Lesson library", icon: ReaderIcon },
              ...(active
                ? [
                    {
                      id: "practice",
                      label: "In conversation",
                      icon: ChatBubbleIcon,
                    },
                  ]
                : []),
              { id: "notebook", label: "Your notebook", icon: BookmarkIcon },
              { id: "preferences", label: "Preferences", icon: GearIcon },
            ] as { id: View; label: string; icon: typeof HomeIcon }[]
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              aria-label={label}
              aria-current={view === id ? "page" : undefined}
              onClick={() => navigate(id)}
              disabled={!profile}
            >
              <Icon />
              <span className="desktop-nav-label">{label}</span>
              <span className="mobile-nav-label" aria-hidden="true">
                {
                  {
                    studio: "Studio",
                    library: "Lessons",
                    practice: "Practice",
                    notebook: "Notebook",
                    preferences: "Settings",
                  }[id]
                }
              </span>
              {id === "practice" && <i className="active-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="note-line" />
          <p>
            A little practice.
            <br />A wider world.
          </p>
          <span className="sidebar-note-caption">
            YOUR NEXT CHAPTER STARTS HERE.
          </span>
        </div>
        <div className="sidebar-bottom">
          {profile ? (
            <button
              className="learner-chip"
              onClick={() => navigate("preferences")}
            >
              <span className="learner-initial">
                {profile.displayName.slice(0, 1).toUpperCase()}
              </span>
              <span>
                <strong>{profile.displayName}</strong>
                <small>{profile.level} · Guest learner</small>
              </span>
              <ArrowTopRightIcon />
            </button>
          ) : (
            <div className="sidebar-greeting">
              <MelissaAvatar size={38} />
              <span>A good place to begin.</span>
            </div>
          )}
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span>
            {!profile
              ? "YOUR ENGLISH COMPANION"
              : view === "studio"
                ? "MAKE A LITTLE SPACE FOR YOURSELF"
                : view === "library"
                  ? "CURIOSITY LOOKS GOOD ON YOU"
                  : view === "practice"
                    ? "GOOD CONVERSATIONS START SMALL"
                    : view === "notebook"
                      ? "THE LITTLE THINGS ADD UP"
                      : "A SPACE THAT FEELS LIKE YOU"}
          </span>
          <div className="mode-badge">
            <i />
            {snapshot
              ? teacherLabels[snapshot.capabilities.teacher]
              : "Opening your space"}
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          {error && (
            <div className="alert error" role="alert">
              <span>{error}</span>
              {!snapshot && (
                <button
                  className="text-button"
                  onClick={() => window.location.reload()}
                >
                  <ReloadIcon /> Try again
                </button>
              )}
            </div>
          )}
          {reconnectNeeded && snapshot && (
            <section
              className="reconnect-panel"
              aria-label="Reconnect your guest session"
            >
              <h2>A fresh page is waiting.</h2>
              <p>
                Your guest session has expired. You can export the records still
                visible here before opening a new session. Your unsent reply
                will be kept for your next conversation.
              </p>
              <div>
                <button
                  className="button secondary compact"
                  disabled={busy}
                  onClick={() => downloadSnapshot(snapshot)}
                >
                  Export saved records
                </button>
                <button
                  className="button primary compact"
                  disabled={busy}
                  onClick={() => void reconnect()}
                >
                  Reconnect with a new session <ReloadIcon />
                </button>
              </div>
            </section>
          )}
          {notice && (
            <div className="alert notice" role="status">
              {notice}
            </div>
          )}
          {!snapshot ? (
            <div className="loading-state" role="status">
              <p className="eyebrow">A LITTLE SPACE FOR YOUR ENGLISH</p>
              <h1>{error ? "Let’s reconnect." : "Make yourself at home."}</h1>
              <div className="skeleton-line" />
              <div className="skeleton-line short" />
              <div className="skeleton-grid">
                <div />
                <div />
              </div>
              <p>
                {error
                  ? "Refresh the page to try again."
                  : "Melissa is opening your practice space…"}
              </p>
            </div>
          ) : !profile ? (
            <Onboarding busy={busy} onSave={saveProfile} />
          ) : view === "library" ? (
            <LessonLibrary
              snapshot={snapshot}
              busy={busy}
              onStart={(id) => void startLesson(id)}
              onGenerate={generateMaterial}
            />
          ) : view === "practice" && active ? (
            <PracticeRoom
              key={active.id}
              session={active}
              busy={busy}
              draft={drafts[active.id] ?? ""}
              onDraft={(text) =>
                setDrafts((previous) => ({ ...previous, [active.id]: text }))
              }
              onSend={sendMessage}
              onFinish={() => void finishPractice()}
              onBack={() => navigate("studio")}
            />
          ) : view === "notebook" ? (
            <ProgressView
              state={snapshot.state}
              onPractice={() => navigate(active ? "practice" : "studio")}
            />
          ) : view === "preferences" ? (
            <Preferences
              snapshot={snapshot}
              busy={busy}
              onSave={saveProfile}
              onExport={exportData}
              onDelete={() => void clearData()}
            />
          ) : (
            <Studio
              snapshot={snapshot}
              busy={busy}
              onStart={(id) => void startLesson(id)}
              onResume={() => navigate("practice")}
              onLibrary={() => navigate("library")}
              onNotebook={() => navigate("notebook")}
            />
          )}
        </main>
        <footer className="app-footer">
          <span>Made for the wonderfully imperfect way we learn.</span>
          <span>
            Melissa <span aria-hidden="true">✳</span> English, in good company.
          </span>
        </footer>
      </div>
    </div>
  );
}
