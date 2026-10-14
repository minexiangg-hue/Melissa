import type { KnowledgeSource } from "@/domain/learning/models";

/** Only reviewed notes enter generation. URLs are attribution, never runtime fetch targets. */
export const knowledgeSources: KnowledgeSource[] = [
  {
    id: "melissa-original",
    title: "Melissa conversation workshop",
    publisher: "Melissa",
    url: "https://github.com/minexiangg-hue/Melissa/tree/main/content/learning",
    license: "Apache-2.0 · original project content",
    licenseUrl: "https://github.com/minexiangg-hue/Melissa/blob/main/LICENSE",
    attribution:
      "Original scenarios, examples, exercises and teaching guidance authored for Melissa. No textbook passages imported.",
    notes: [
      "Teach one useful communication task through noticing, a short model, retrieval practice and an original spoken response.",
      "Use fictional people and situations. Recycle a small set of useful phrases in a new context.",
    ],
    usage: "original",
    reviewedAt: "2026-10-15",
  },
  {
    id: "nara-plain-language",
    title: "Plain language at work",
    publisher: "U.S. National Archives and Records Administration",
    url: "https://www.archives.gov/open/plain-writing/10-principles.html",
    license: "CC0-1.0 · NARA-produced U.S. Government works",
    licenseUrl: "https://www.archives.gov/global-pages/privacy.html",
    attribution:
      "Factual teaching notes based on NARA's plain-language guidance. Original examples by Melissa; no claim to original U.S. Government works. No endorsement implied.",
    notes: [
      "Make the reader's main need clear early; organize supporting details around that need.",
      "Prefer familiar words and explain necessary technical terms. Review the result for clarity.",
    ],
    usage: "facts-only",
    reviewedAt: "2026-10-15",
  },
  {
    id: "nps-wildlife",
    title: "A thoughtful visit to a national park",
    publisher: "U.S. National Park Service",
    url: "https://www.nps.gov/subjects/watchingwildlife/7ways.htm",
    license: "Public-domain NPS text · third-party media excluded",
    licenseUrl: "https://www.nps.gov/aboutus/disclaimer.htm",
    attribution:
      "Factual notes from the National Park Service. Original fictional scenes by Melissa; no claim to original U.S. Government works. No images, logos or third-party works imported. No endorsement implied.",
    notes: [
      "Wildlife-viewing rules differ among parks; visitors should check the particular park's guidance before a trip.",
      "Visitors can observe animals from a distance and keep food and rubbish in suitable closed containers.",
    ],
    usage: "facts-only",
    reviewedAt: "2026-10-15",
  },
  {
    id: "nasa-earth",
    title: "A small conversation about our planet",
    publisher: "NASA Science",
    url: "https://science.nasa.gov/earth/facts/",
    license: "Factual notes only · NASA educational-use guidelines",
    licenseUrl: "https://www.nasa.gov/nasa-brand-center/images-and-media/",
    attribution:
      "Earth facts checked against NASA Science. Original educational text by Melissa. No NASA imagery, logo, or third-party material imported; no endorsement implied.",
    notes: [
      "Ocean covers approximately 71 percent of Earth's surface.",
      "Earth's axial tilt produces the seasons. Earth has one natural moon.",
    ],
    usage: "facts-only",
    reviewedAt: "2026-10-15",
  },
  {
    id: "cefr-reference",
    title: "The CEFR levels",
    publisher: "Council of Europe",
    url: "https://www.coe.int/en/web/common-european-framework-reference-languages/level-descriptions",
    license: "Reference link only · no descriptor text reproduced",
    licenseUrl: "https://www.coe.int/en/web/portal/disclaimer",
    attribution:
      "The A1–C2 level names refer to the Council of Europe's CEFR. Melissa's teaching guidance is original and is not an official CEFR assessment or endorsement.",
    notes: [],
    usage: "reference-only",
    reviewedAt: "2026-10-15",
  },
];
