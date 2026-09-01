export interface ModuleDef {
  id: string;
  label: string;
  description: string;
}

export const ALL_MODULES: ModuleDef[] = [
  {
    id: "tilemap",
    label: "Tilemap Editor",
    description: "Grid-based level design",
  },
  {
    id: "particle",
    label: "Particle Editor",
    description: "Visual particle system authoring",
  },
  {
    id: "vn",
    label: "VN Graph",
    description: "Visual novel dialogue trees",
  },
  {
    id: "visual-script",
    label: "Visual Script",
    description: "Node-based scripting",
  },
  {
    id: "sequence",
    label: "Sequence Editor",
    description: "Cutscene and timeline authoring",
  },
  {
    id: "audio",
    label: "Audio Mixer",
    description: "Runtime audio mixing",
  },
  {
    id: "profiler",
    label: "Profiler",
    description: "Performance profiling",
  },
  {
    id: "git",
    label: "Git",
    description: "Source control panel",
  },
  {
    id: "i18n",
    label: "Localisation",
    description: "i18n string management",
  },
];

export const DEFAULT_ENABLED_MODULES: string[] = [
  "particle",
  "audio",
  "profiler",
  "git",
];
