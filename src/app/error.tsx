"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="fallback">
      <h1>Something interrupted your practice.</h1>
      <p>Try opening it again. Your saved practice is kept on the server.</p>
      <button className="button primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
