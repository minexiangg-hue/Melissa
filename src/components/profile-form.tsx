"use client";
import { useState, type FormEvent } from "react";
import type { Profile } from "@/domain/models";
import { goalLabels, levelDescriptions } from "@/domain/curriculum";
import { ArrowRightIcon } from "@radix-ui/react-icons";
export function ProfileForm({
  profile,
  busy,
  onSave,
}: {
  profile: Profile | null;
  busy: boolean;
  onSave: (profile: Profile) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Profile>(
    profile ?? {
      displayName: "",
      nativeLanguage: "Chinese",
      level: "B1",
      goal: "everyday",
      dailyMinutes: 10,
    },
  );
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.displayName.trim()) {
      setError("Enter a name or nickname.");
      return;
    }
    setError("");
    await onSave(draft);
  }
  return (
    <form className="profile-form" onSubmit={submit}>
      <div className="field">
        <label htmlFor="displayName">What should we call you?</label>
        <input
          id="displayName"
          name="displayName"
          autoComplete="nickname"
          required
          maxLength={40}
          placeholder="A name or nickname"
          value={draft.displayName}
          onChange={(e) => setDraft({ ...draft, displayName: e.target.value })}
        />
      </div>
      <div className="field-pair">
        <div className="field">
          <label htmlFor="nativeLanguage">First language</label>
          <select
            id="nativeLanguage"
            value={draft.nativeLanguage}
            onChange={(e) =>
              setDraft({
                ...draft,
                nativeLanguage: e.target.value as Profile["nativeLanguage"],
              })
            }
          >
            <option>Chinese</option>
            <option>English</option>
            <option>Other</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="dailyMinutes">Daily practice goal</label>
          <select
            id="dailyMinutes"
            value={draft.dailyMinutes}
            onChange={(e) =>
              setDraft({
                ...draft,
                dailyMinutes: Number(e.target.value) as Profile["dailyMinutes"],
              })
            }
          >
            <option value={5}>5 minutes</option>
            <option value={10}>10 minutes</option>
            <option value={15}>15 minutes</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="goal">What brings you here?</label>
        <select
          id="goal"
          value={draft.goal}
          onChange={(e) =>
            setDraft({ ...draft, goal: e.target.value as Profile["goal"] })
          }
        >
          {Object.entries(goalLabels).map(([key, label]) => (
            <option value={key} key={key}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="level">Your English level</label>
        <select
          id="level"
          aria-describedby="level-help"
          value={draft.level}
          onChange={(e) =>
            setDraft({ ...draft, level: e.target.value as Profile["level"] })
          }
        >
          {Object.entries(levelDescriptions).map(([key, label]) => (
            <option value={key} key={key}>
              {key} · {label}
            </option>
          ))}
        </select>
        <p id="level-help" className="field-help">
          A starting point, not a test result. You can change this anytime.
        </p>
      </div>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      <button className="button primary" disabled={busy} type="submit">
        {busy
          ? "Saving…"
          : profile
            ? "Save preferences"
            : "Make room for practice"}
        <ArrowRightIcon />
      </button>
      <p className="field-help">
        Saved in this browser’s guest session for 30 days. No email needed.
      </p>
    </form>
  );
}
