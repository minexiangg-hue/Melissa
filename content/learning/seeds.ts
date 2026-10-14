import type { MaterialSeed } from "@/domain/learning/models";
import { everydayScenes } from "./scenes/everyday";
import { travelScenes } from "./scenes/travel";
import { workScenes } from "./scenes/work";

/** Original, reviewed starter scenes. AI adapts these authoring seeds to a new topic. */
export const materialSeeds: MaterialSeed[] = [
  ...everydayScenes,
  ...travelScenes,
  ...workScenes,
];
