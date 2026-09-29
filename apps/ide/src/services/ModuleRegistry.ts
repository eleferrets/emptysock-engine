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
    id: "room",
    label: "Room Editor",
    description: "Drag-and-drop placement of room/scene instances",
  },
  {
    id: "particle",
    label: "Particle Editor",
    description: "Visual particle system authoring",
  },
  {
    id: "vn",
    label: "Story Graph",
    description: "Visual novel and branching dialogue trees",
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
  {
    id: "shader",
    label: "Shader Editor",
    description: "GLSL snippet editor with live WebGL preview",
  },
  {
    id: "variables",
    label: "Variables",
    description: "Named integer variables and boolean switches store",
  },
  {
    id: "globals",
    label: "Game Globals",
    description: "Declare typed game-wide globals for ctx.globals",
  },
  {
    id: "vn-preview",
    label: "VN Preview",
    description: "Live Story Graph playback preview",
  },
  {
    id: "ui-placement",
    label: "UI Placement",
    description: "Drag-and-drop HUD and UI element layout",
  },
  {
    id: "database",
    label: "Database",
    description: "RPG actor, class, item and enemy database editor",
  },
  {
    id: "cg-gallery",
    label: "CG Gallery",
    description: "CG art viewer with unlock tracking",
  },
  {
    id: "navmesh",
    label: "NavMesh Editor",
    description: "Hand-author and edit NavMeshSystem polygon data",
  },
];

export const DEFAULT_ENABLED_MODULES: string[] = [
  "room",
  "particle",
  "audio",
  "profiler",
  "git",
];
