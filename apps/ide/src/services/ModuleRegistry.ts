export type ProjectType = "platformer" | "topdown" | "vn" | "puzzle" | "custom";

export interface ModuleDef {
  id: string;
  label: string;
  description: string;
  defaultFor: ProjectType[];
}

export const ALL_MODULES: ModuleDef[] = [
  {
    id: "tilemap",
    label: "Tilemap Editor",
    description: "Grid-based level design",
    defaultFor: ["platformer", "topdown", "puzzle"],
  },
  {
    id: "particle",
    label: "Particle Editor",
    description: "Visual particle system authoring",
    defaultFor: ["platformer", "topdown", "custom"],
  },
  {
    id: "vn",
    label: "VN Graph",
    description: "Visual novel dialogue trees",
    defaultFor: ["vn"],
  },
  {
    id: "visual-script",
    label: "Visual Script",
    description: "Node-based scripting",
    defaultFor: ["platformer", "topdown", "puzzle", "vn", "custom"],
  },
  {
    id: "sequence",
    label: "Sequence Editor",
    description: "Cutscene and timeline authoring",
    defaultFor: ["vn", "custom"],
  },
  {
    id: "audio",
    label: "Audio Mixer",
    description: "Runtime audio mixing",
    defaultFor: ["platformer", "topdown", "vn", "puzzle", "custom"],
  },
  {
    id: "profiler",
    label: "Profiler",
    description: "Performance profiling",
    defaultFor: ["platformer", "topdown", "vn", "puzzle", "custom"],
  },
  {
    id: "git",
    label: "Git",
    description: "Source control panel",
    defaultFor: ["platformer", "topdown", "vn", "puzzle", "custom"],
  },
  {
    id: "i18n",
    label: "Localisation",
    description: "i18n string management",
    defaultFor: ["custom"],
  },
];

export function defaultModulesFor(type: ProjectType): string[] {
  return ALL_MODULES.filter((m) => m.defaultFor.includes(type)).map(
    (m) => m.id,
  );
}
