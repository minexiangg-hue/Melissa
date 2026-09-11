import Link from "next/link";
export default function NotFound() {
  return (
    <main className="fallback">
      <h1>This page isn’t here.</h1>
      <p>Your practice space is one step away.</p>
      <Link className="button primary" href="/">
        Back to practice
      </Link>
    </main>
  );
}
