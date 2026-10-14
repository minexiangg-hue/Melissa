"use client";
import { useState } from "react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  ExternalLinkIcon,
} from "@radix-ui/react-icons";
import type {
  LearningMaterial,
  KnowledgeSource,
} from "@/domain/learning/models";
import { SpeechButton } from "./speech-button";

export function MaterialReader({
  material,
  sources,
  busy,
  onBack,
  onStart,
}: {
  material: LearningMaterial;
  sources: KnowledgeSource[];
  busy: boolean;
  onBack: () => void;
  onStart: (id: string) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  return (
    <article className="material-reader enter">
      <button className="text-button" onClick={onBack}>
        <ArrowLeftIcon /> Your lesson library
      </button>
      <header className="material-heading">
        <p className="eyebrow">{material.level} / YOUR PERSONAL EDITION</p>
        <h1>{material.title}</h1>
        <p>{material.summary}</p>
        <div className="material-meta">
          <span>
            {material.provider === "demo"
              ? "Practice template"
              : "Created with AI"}
          </span>
          <span>{material.vocabulary.length} useful expressions</span>
          <span>{material.exercises.length} quick checks</span>
        </div>
      </header>
      <div className="material-columns">
        <div>
          <section className="reading-section">
            <span className="number-label">01 / READ A LITTLE</span>
            <h2>{material.reading.title}</h2>
            <div className="reading-prose">
              {material.reading.text.split(/\n+/).map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
            <SpeechButton text={material.reading.text} />
          </section>
          <section className="dialogue-section">
            <span className="number-label">02 / HEAR THE CONVERSATION</span>
            <h2>Words in good company.</h2>
            <div className="material-dialogue">
              {material.dialogue.map((line, i) => (
                <p key={i}>
                  <strong>{line.speaker}</strong>
                  <span>{line.text}</span>
                </p>
              ))}
            </div>
            <SpeechButton
              text={material.dialogue
                .map((line) => `${line.speaker}: ${line.text}`)
                .join("\n")}
            />
          </section>
        </div>
        <aside className="vocabulary-section">
          <span className="number-label">KEEP THESE CLOSE</span>
          <h2>Your word collection.</h2>
          <dl>
            {material.vocabulary.map((word, i) => (
              <div key={`${word.term}-${i}`}>
                <dt>{word.term}</dt>
                <dd>
                  {word.meaning}
                  <q>{word.example}</q>
                </dd>
              </div>
            ))}
          </dl>
        </aside>
      </div>
      <section className="exercise-section">
        <span className="number-label">03 / MAKE IT STICK</span>
        <h2>A small check-in.</h2>
        <p>Give it a try. You can change your answer and learn as you go.</p>
        <div className="exercise-grid">
          {material.exercises.map((exercise, i) => (
            <fieldset key={exercise.id} className="exercise">
              <legend>
                <span>{String(i + 1).padStart(2, "0")}</span>
                {exercise.prompt}
              </legend>
              <div className="answer-options">
                {exercise.options.map((option, index) => (
                  <label
                    key={index}
                    className={answers[exercise.id] === index ? "chosen" : ""}
                  >
                    <input
                      type="radio"
                      name={`exercise-${exercise.id}`}
                      checked={answers[exercise.id] === index}
                      onChange={() =>
                        setAnswers({ ...answers, [exercise.id]: index })
                      }
                    />
                    {option}
                  </label>
                ))}
              </div>
              {answers[exercise.id] !== undefined && (
                <div
                  className={`answer-feedback ${answers[exercise.id] === exercise.answerIndex ? "correct" : ""}`}
                  role="status"
                >
                  <strong>
                    {answers[exercise.id] === exercise.answerIndex
                      ? "That’s it."
                      : "Have another look."}
                  </strong>{" "}
                  {exercise.explanation}
                </div>
              )}
            </fieldset>
          ))}
        </div>
      </section>
      <div className="reader-finish">
        <span className="reader-finish-symbol">
          <CheckIcon />
        </span>
        <div>
          <h2>Now, make it a conversation.</h2>
          <p>Take these ideas into a guided practice with Melissa.</p>
        </div>
        <button
          className="button primary"
          onClick={() => onStart(material.id)}
          disabled={busy}
        >
          {busy ? "Getting ready…" : "Practice this lesson"}
          <ArrowRightIcon />
        </button>
      </div>
      <details className="source-details">
        <summary>About this lesson & source notes</summary>
        <p>
          Created for your practice. AI-generated material can contain mistakes;
          check details that matter. Exercise choices stay in this reading
          session.
        </p>
        {sources
          .filter((source) => material.sourceIds.includes(source.id))
          .map((source) => (
            <div key={source.id}>
              <a href={source.url} target="_blank" rel="noreferrer">
                {source.title} <ExternalLinkIcon />
              </a>
              <p>
                {source.attribution} · {source.license}
              </p>
            </div>
          ))}
      </details>
    </article>
  );
}
