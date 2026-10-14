"use client";
import {
  ArrowRightIcon,
  ArrowTopRightIcon,
  ClockIcon,
  BookmarkIcon,
} from "@radix-ui/react-icons";
import type { Snapshot } from "@/domain/models";
import { goalLabels } from "@/domain/curriculum";
import { MelissaCharacter } from "./brand";

export function Studio({
  snapshot,
  busy,
  onStart,
  onResume,
  onLibrary,
  onNotebook,
}: {
  snapshot: Snapshot;
  busy: boolean;
  onStart: (id: string) => void;
  onResume: () => void;
  onLibrary: () => void;
  onNotebook: () => void;
}) {
  const profile = snapshot.state.profile!;
  const active = snapshot.state.sessions.find((s) => s.status === "active");
  const lesson =
    snapshot.lessons.find((l) => l.goal === profile.goal) ??
    snapshot.lessons[0];
  const finished = snapshot.state.sessions.filter(
    (s) => s.status === "completed" && s.turnCount > 0,
  ).length;
  return (
    <div className="studio enter">
      <section className="studio-hero">
        <div className="hero-copy">
          <p className="eyebrow">YOUR ENGLISH, A LITTLE MORE YOU</p>
          <h1>
            Small talk.
            <br />
            <em>Big possibilities.</em>
          </h1>
          <p className="hero-description">
            Hello, {profile.displayName}. A new conversation is a small
            beginning. Let’s see where it takes you.
          </p>
          <button
            className="button primary"
            disabled={busy || !lesson}
            onClick={() => (active ? onResume() : lesson && onStart(lesson.id))}
          >
            {busy
              ? "Getting ready…"
              : active
                ? "Continue our conversation"
                : "Start a conversation"}
            <ArrowRightIcon />
          </button>
        </div>
        <div className="hero-art">
          <span className="hero-orbit" aria-hidden="true" />
          <span className="character-note">
            a little courage,
            <br />a little curiosity.
          </span>
          <MelissaCharacter priority />
          <span className="character-signature">
            Meet Melissa <span>your English companion</span>
          </span>
        </div>
      </section>
      <div className="studio-divider">
        <span>A space for your next chapter</span>
        <span>
          {profile.level} · {profile.dailyMinutes} minutes at a time
        </span>
      </div>
      <section className="studio-bottom" aria-label="Your learning space">
        <article className="daily-feature">
          <div className="feature-top">
            <span className="number-label">01 / YOUR NEXT CONVERSATION</span>
            <ClockIcon />
          </div>
          <h2>
            {active?.lesson.title ??
              lesson?.title ??
              "Find your next conversation"}
          </h2>
          <p>
            {active
              ? "Your conversation is right where you left it. Come back when you’re ready."
              : lesson?.description}
          </p>
          <div className="feature-bottom">
            <span>
              {goalLabels[active?.lesson.goal ?? lesson?.goal ?? profile.goal]}
            </span>
            <button
              className="round-button"
              disabled={busy || !lesson}
              onClick={() =>
                active ? onResume() : lesson && onStart(lesson.id)
              }
              aria-label={
                active ? "Resume practice" : `Practice ${lesson?.title}`
              }
            >
              <ArrowTopRightIcon />
            </button>
          </div>
        </article>
        <article className="library-feature">
          <span className="number-label">02 / MADE FOR YOUR WORLD</span>
          <h2>
            Life doesn’t follow
            <br />a textbook.
          </h2>
          <p>Create a lesson around something you actually want to say.</p>
          <button className="text-button" onClick={onLibrary}>
            Explore your lesson library <ArrowRightIcon />
          </button>
          <span className="library-decoration" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </article>
        <button className="notebook-feature" onClick={onNotebook}>
          <BookmarkIcon />
          <span className="notebook-count">
            {String(finished).padStart(2, "0")}
          </span>
          <span>
            Conversations
            <br />
            worth keeping.
          </span>
          <span className="notebook-link">
            Open your notebook <ArrowTopRightIcon />
          </span>
        </button>
      </section>
    </div>
  );
}
