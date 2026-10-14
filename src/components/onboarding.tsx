import type { Profile } from "@/domain/models";
import { MelissaCharacter } from "./brand";
import { ProfileForm } from "./profile-form";

export function Onboarding({
  busy,
  onSave,
}: {
  busy: boolean;
  onSave: (profile: Profile) => Promise<void>;
}) {
  return (
    <section className="onboarding enter">
      <div className="welcome-story">
        <p className="eyebrow">A LITTLE MORE CONFIDENT. A LITTLE MORE YOU.</p>
        <h1>
          Find your words.
          <br />
          <em>Find your world.</em>
        </h1>
        <p className="hero-description">
          A thoughtful English companion for the conversations that matter to
          you.
        </p>
        <div className="welcome-character">
          <span className="welcome-circle" aria-hidden="true" />
          <MelissaCharacter priority />
          <span className="welcome-annotation">
            Hello, I’m Melissa.
            <br />
            Let’s begin with you.
          </span>
        </div>
        <p className="welcome-footnote">
          Room to make mistakes. Space to keep going.
        </p>
      </div>
      <div className="onboarding-form">
        <span className="number-label">YOUR FIRST PAGE</span>
        <h2>Make yourself at home.</h2>
        <p>A few small details to make this space yours.</p>
        <ProfileForm profile={null} busy={busy} onSave={onSave} />
      </div>
    </section>
  );
}
