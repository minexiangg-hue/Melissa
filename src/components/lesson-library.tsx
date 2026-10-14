"use client";
import { useState, type FormEvent } from "react";
import {
  ArrowRightIcon,
  ArrowTopRightIcon,
  MagicWandIcon,
  PlusIcon,
  ReaderIcon,
} from "@radix-ui/react-icons";
import type { Goal, Snapshot } from "@/domain/models";
import { goalLabels } from "@/domain/curriculum";
import type { LearningMaterial } from "@/domain/learning/models";
import { MaterialReader } from "./material-reader";

export function LessonLibrary({
  snapshot,
  busy,
  onStart,
  onGenerate,
}: {
  snapshot: Snapshot;
  busy: boolean;
  onStart: (id: string) => void;
  onGenerate: (topic: string, goal: Goal) => Promise<LearningMaterial | null>;
}) {
  const [filter, setFilter] = useState<Goal | "all">("all");
  const [topic, setTopic] = useState("");
  const [goal, setGoal] = useState<Goal>(snapshot.state.profile!.goal);
  const [selected, setSelected] = useState<LearningMaterial | null>(null);
  async function generate(event: FormEvent) {
    event.preventDefault();
    if (!topic.trim() || busy) return;
    const material = await onGenerate(topic.trim(), goal);
    if (material) {
      setFilter(goal);
      setSelected(material);
    }
  }
  if (selected)
    return (
      <MaterialReader
        key={selected.id}
        material={selected}
        sources={snapshot.knowledge.sources}
        busy={busy}
        onBack={() => setSelected(null)}
        onStart={onStart}
      />
    );
  const materials = (snapshot.state.materials ?? []).filter(
    (material) => filter === "all" || material.goal === filter,
  );
  const lessons = snapshot.lessons.filter(
    (lesson) => filter === "all" || lesson.goal === filter,
  );
  return (
    <section className="library-page enter">
      <div className="page-heading">
        <p className="eyebrow">THE LESSON LIBRARY</p>
        <h1>
          A world of things
          <br />
          <em>worth talking about.</em>
        </h1>
        <p>
          Everyday moments, new places, your next big idea. Start with what
          moves you.
        </p>
      </div>
      <section className="lesson-maker" aria-label="Create a personal lesson">
        <div className="maker-copy">
          <span className="maker-icon">
            <MagicWandIcon />
          </span>
          <h2>
            A lesson with
            <br />
            your name on it.
          </h2>
          <p>
            Pick a topic from your world. Melissa will turn it into a reading,
            useful words, and a conversation.
          </p>
        </div>
        <form onSubmit={generate} className="maker-form">
          <label htmlFor="lesson-topic">
            What would you like to talk about?
          </label>
          <textarea
            id="lesson-topic"
            placeholder="A first trip to London, my photography hobby, a job interview…"
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            required
            maxLength={120}
            rows={2}
            disabled={busy}
          />
          <div className="maker-actions">
            <label className="sr-only" htmlFor="lesson-goal">
              Lesson focus
            </label>
            <select
              id="lesson-goal"
              value={goal}
              onChange={(event) => setGoal(event.target.value as Goal)}
              disabled={busy}
            >
              {Object.entries(goalLabels).map(([key, label]) => (
                <option value={key} key={key}>
                  {label}
                </option>
              ))}
            </select>
            <button
              className="button primary"
              disabled={
                busy ||
                !topic.trim() ||
                !snapshot.capabilities.materialGeneration
              }
              type="submit"
            >
              {busy ? "Creating your lesson…" : "Create my lesson"}
              <PlusIcon />
            </button>
          </div>
          <p className="field-help">
            {snapshot.capabilities.teacher === "demo"
              ? "Demo mode creates a practice template. Connect an AI teacher for a fully personal lesson."
              : "Created for your level using our curated learning sources. This may take a moment."}
          </p>
        </form>
      </section>
      <div className="library-filters" role="group" aria-label="Filter lessons">
        {(["all", "everyday", "travel", "work"] as const).map((item) => (
          <button
            key={item}
            aria-pressed={filter === item}
            onClick={() => setFilter(item)}
          >
            {item === "all" ? "All conversations" : goalLabels[item]}
          </button>
        ))}
      </div>
      {materials.length > 0 && (
        <section className="personal-lessons">
          <div className="section-heading">
            <h2>Made for you</h2>
            <span>
              {materials.length} {materials.length === 1 ? "lesson" : "lessons"}
            </span>
          </div>
          <div className="material-list">
            {materials.map((material) => (
              <button
                className="material-item"
                key={material.id}
                onClick={() => setSelected(material)}
              >
                <span className="material-item-icon">
                  <ReaderIcon />
                </span>
                <span>
                  <small>
                    {material.level} · {goalLabels[material.goal]}
                  </small>
                  <strong>{material.title}</strong>
                  <span>{material.summary}</span>
                </span>
                <ArrowTopRightIcon />
              </button>
            ))}
          </div>
        </section>
      )}
      <div className="section-heading">
        <h2>Good places to begin</h2>
        <span>{snapshot.state.profile!.level} practice</span>
      </div>
      <div className="lesson-grid">
        {lessons.map((lesson, index) => (
          <article className={`lesson-card ${lesson.goal}`} key={lesson.id}>
            <div className="lesson-card-top">
              <span>{String(index + 1).padStart(2, "0")}</span>
              <span>{goalLabels[lesson.goal]}</span>
            </div>
            <div className="lesson-typography" aria-hidden="true">
              {lesson.goal === "everyday"
                ? "Hello."
                : lesson.goal === "travel"
                  ? "Let’s go."
                  : "What if?"}
            </div>
            <h3>{lesson.title}</h3>
            <p>{lesson.description}</p>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => onStart(lesson.id)}
            >
              Start practicing <ArrowRightIcon />
            </button>
          </article>
        ))}
      </div>
      <section className="source-shelf">
        <ReaderIcon />
        <div>
          <h2>A thoughtful starting point.</h2>
          <p>
            {snapshot.knowledge.seedCount} original learning seeds, informed by{" "}
            {snapshot.knowledge.sourceCount} carefully documented sources. A
            growing foundation for your next lesson.
          </p>
          <details>
            <summary>Explore the source notes</summary>
            <ul>
              {snapshot.knowledge.sources.map((source) => (
                <li key={source.id}>
                  <a href={source.url} target="_blank" rel="noreferrer">
                    {source.title}
                  </a>
                  <span>
                    {source.publisher} · {source.license}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        </div>
      </section>
    </section>
  );
}
