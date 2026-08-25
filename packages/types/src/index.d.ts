import { z } from 'zod';
export declare const ProjectManifestSchema: z.ZodObject<{
    name: z.ZodString;
    version: z.ZodString;
    engineVersion: z.ZodString;
    entryPoint: z.ZodDefault<z.ZodString>;
    targetResolution: z.ZodDefault<z.ZodObject<{
        width: z.ZodNumber;
        height: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        width: number;
        height: number;
    }, {
        width: number;
        height: number;
    }>>;
    physics: z.ZodDefault<z.ZodObject<{
        gravity: z.ZodDefault<z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            x: number;
            y: number;
        }, {
            x: number;
            y: number;
        }>>;
        enabled: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        gravity: {
            x: number;
            y: number;
        };
        enabled: boolean;
    }, {
        gravity?: {
            x: number;
            y: number;
        } | undefined;
        enabled?: boolean | undefined;
    }>>;
    audio: z.ZodDefault<z.ZodObject<{
        masterVolume: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        masterVolume: number;
    }, {
        masterVolume?: number | undefined;
    }>>;
    metadata: z.ZodDefault<z.ZodObject<{
        author: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
        icon: z.ZodOptional<z.ZodString>;
        tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        tags: string[];
        author?: string | undefined;
        description?: string | undefined;
        icon?: string | undefined;
    }, {
        author?: string | undefined;
        description?: string | undefined;
        icon?: string | undefined;
        tags?: string[] | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    version: string;
    engineVersion: string;
    entryPoint: string;
    targetResolution: {
        width: number;
        height: number;
    };
    physics: {
        gravity: {
            x: number;
            y: number;
        };
        enabled: boolean;
    };
    audio: {
        masterVolume: number;
    };
    metadata: {
        tags: string[];
        author?: string | undefined;
        description?: string | undefined;
        icon?: string | undefined;
    };
}, {
    name: string;
    version: string;
    engineVersion: string;
    entryPoint?: string | undefined;
    targetResolution?: {
        width: number;
        height: number;
    } | undefined;
    physics?: {
        gravity?: {
            x: number;
            y: number;
        } | undefined;
        enabled?: boolean | undefined;
    } | undefined;
    audio?: {
        masterVolume?: number | undefined;
    } | undefined;
    metadata?: {
        author?: string | undefined;
        description?: string | undefined;
        icon?: string | undefined;
        tags?: string[] | undefined;
    } | undefined;
}>;
export type ProjectManifest = z.infer<typeof ProjectManifestSchema>;
export declare const SaveSlotSchema: z.ZodObject<{
    slotId: z.ZodNumber;
    timestamp: z.ZodNumber;
    playtime: z.ZodNumber;
    currentScene: z.ZodString;
    data: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    slotId: number;
    timestamp: number;
    playtime: number;
    currentScene: string;
    data: Record<string, unknown>;
}, {
    slotId: number;
    timestamp: number;
    playtime: number;
    currentScene: string;
    data: Record<string, unknown>;
}>;
export type SaveSlot = z.infer<typeof SaveSlotSchema>;
export declare const ComponentDataSchema: z.ZodObject<{
    type: z.ZodString;
    data: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    type: string;
    data: Record<string, unknown>;
}, {
    type: string;
    data: Record<string, unknown>;
}>;
export declare const EntitySchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    active: z.ZodDefault<z.ZodBoolean>;
    components: z.ZodDefault<z.ZodArray<z.ZodObject<{
        type: z.ZodString;
        data: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    }, "strip", z.ZodTypeAny, {
        type: string;
        data: Record<string, unknown>;
    }, {
        type: string;
        data: Record<string, unknown>;
    }>, "many">>;
    children: z.ZodDefault<z.ZodArray<z.ZodLazy<z.ZodTypeAny>, "many">>;
}, "strip", z.ZodTypeAny, {
    name: string;
    tags: string[];
    id: string;
    active: boolean;
    components: {
        type: string;
        data: Record<string, unknown>;
    }[];
    children: any[];
}, {
    name: string;
    id: string;
    tags?: string[] | undefined;
    active?: boolean | undefined;
    components?: {
        type: string;
        data: Record<string, unknown>;
    }[] | undefined;
    children?: any[] | undefined;
}>;
export type EntityData = z.infer<typeof EntitySchema>;
export declare const SceneSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    version: z.ZodDefault<z.ZodNumber>;
    backgroundColor: z.ZodDefault<z.ZodString>;
    entities: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        active: z.ZodDefault<z.ZodBoolean>;
        components: z.ZodDefault<z.ZodArray<z.ZodObject<{
            type: z.ZodString;
            data: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        }, "strip", z.ZodTypeAny, {
            type: string;
            data: Record<string, unknown>;
        }, {
            type: string;
            data: Record<string, unknown>;
        }>, "many">>;
        children: z.ZodDefault<z.ZodArray<z.ZodLazy<z.ZodTypeAny>, "many">>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        tags: string[];
        id: string;
        active: boolean;
        components: {
            type: string;
            data: Record<string, unknown>;
        }[];
        children: any[];
    }, {
        name: string;
        id: string;
        tags?: string[] | undefined;
        active?: boolean | undefined;
        components?: {
            type: string;
            data: Record<string, unknown>;
        }[] | undefined;
        children?: any[] | undefined;
    }>, "many">>;
    metadata: z.ZodDefault<z.ZodObject<{
        author: z.ZodOptional<z.ZodString>;
        createdAt: z.ZodOptional<z.ZodNumber>;
        updatedAt: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        author?: string | undefined;
        createdAt?: number | undefined;
        updatedAt?: number | undefined;
    }, {
        author?: string | undefined;
        createdAt?: number | undefined;
        updatedAt?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    version: number;
    metadata: {
        author?: string | undefined;
        createdAt?: number | undefined;
        updatedAt?: number | undefined;
    };
    id: string;
    backgroundColor: string;
    entities: {
        name: string;
        tags: string[];
        id: string;
        active: boolean;
        components: {
            type: string;
            data: Record<string, unknown>;
        }[];
        children: any[];
    }[];
}, {
    name: string;
    id: string;
    version?: number | undefined;
    metadata?: {
        author?: string | undefined;
        createdAt?: number | undefined;
        updatedAt?: number | undefined;
    } | undefined;
    backgroundColor?: string | undefined;
    entities?: {
        name: string;
        id: string;
        tags?: string[] | undefined;
        active?: boolean | undefined;
        components?: {
            type: string;
            data: Record<string, unknown>;
        }[] | undefined;
        children?: any[] | undefined;
    }[] | undefined;
}>;
export type Scene = z.infer<typeof SceneSchema>;
export declare const AssetTypeSchema: z.ZodEnum<["image", "audio", "font", "json", "spritesheet", "tilemap", "shader"]>;
export type AssetType = z.infer<typeof AssetTypeSchema>;
export declare const AssetEntrySchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    type: z.ZodEnum<["image", "audio", "font", "json", "spritesheet", "tilemap", "shader"]>;
    path: z.ZodString;
    size: z.ZodOptional<z.ZodNumber>;
    checksum: z.ZodOptional<z.ZodString>;
    metadata: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    path: string;
    type: "audio" | "image" | "font" | "json" | "spritesheet" | "tilemap" | "shader";
    metadata: Record<string, unknown>;
    id: string;
    size?: number | undefined;
    checksum?: string | undefined;
}, {
    name: string;
    path: string;
    type: "audio" | "image" | "font" | "json" | "spritesheet" | "tilemap" | "shader";
    id: string;
    metadata?: Record<string, unknown> | undefined;
    size?: number | undefined;
    checksum?: string | undefined;
}>;
export type AssetEntry = z.infer<typeof AssetEntrySchema>;
export declare const AssetManifestSchema: z.ZodObject<{
    version: z.ZodDefault<z.ZodNumber>;
    assets: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        type: z.ZodEnum<["image", "audio", "font", "json", "spritesheet", "tilemap", "shader"]>;
        path: z.ZodString;
        size: z.ZodOptional<z.ZodNumber>;
        checksum: z.ZodOptional<z.ZodString>;
        metadata: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        path: string;
        type: "audio" | "image" | "font" | "json" | "spritesheet" | "tilemap" | "shader";
        metadata: Record<string, unknown>;
        id: string;
        size?: number | undefined;
        checksum?: string | undefined;
    }, {
        name: string;
        path: string;
        type: "audio" | "image" | "font" | "json" | "spritesheet" | "tilemap" | "shader";
        id: string;
        metadata?: Record<string, unknown> | undefined;
        size?: number | undefined;
        checksum?: string | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    version: number;
    assets: {
        name: string;
        path: string;
        type: "audio" | "image" | "font" | "json" | "spritesheet" | "tilemap" | "shader";
        metadata: Record<string, unknown>;
        id: string;
        size?: number | undefined;
        checksum?: string | undefined;
    }[];
}, {
    version?: number | undefined;
    assets?: {
        name: string;
        path: string;
        type: "audio" | "image" | "font" | "json" | "spritesheet" | "tilemap" | "shader";
        id: string;
        metadata?: Record<string, unknown> | undefined;
        size?: number | undefined;
        checksum?: string | undefined;
    }[] | undefined;
}>;
export type AssetManifest = z.infer<typeof AssetManifestSchema>;
export declare const GPUTierSchema: z.ZodEnum<["potato", "low", "mid", "high", "ultra"]>;
export type GPUTier = z.infer<typeof GPUTierSchema>;
export declare const EngineConfigSchema: z.ZodObject<{
    width: z.ZodDefault<z.ZodNumber>;
    height: z.ZodDefault<z.ZodNumber>;
    backgroundColor: z.ZodDefault<z.ZodNumber>;
    antialias: z.ZodDefault<z.ZodBoolean>;
    resolution: z.ZodDefault<z.ZodNumber>;
    powerPreference: z.ZodDefault<z.ZodEnum<["default", "high-performance", "low-power"]>>;
    physics: z.ZodDefault<z.ZodObject<{
        gravity: z.ZodDefault<z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            x: number;
            y: number;
        }, {
            x: number;
            y: number;
        }>>;
        timestep: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        gravity: {
            x: number;
            y: number;
        };
        timestep: number;
    }, {
        gravity?: {
            x: number;
            y: number;
        } | undefined;
        timestep?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    width: number;
    height: number;
    physics: {
        gravity: {
            x: number;
            y: number;
        };
        timestep: number;
    };
    backgroundColor: number;
    antialias: boolean;
    resolution: number;
    powerPreference: "default" | "high-performance" | "low-power";
}, {
    width?: number | undefined;
    height?: number | undefined;
    physics?: {
        gravity?: {
            x: number;
            y: number;
        } | undefined;
        timestep?: number | undefined;
    } | undefined;
    backgroundColor?: number | undefined;
    antialias?: boolean | undefined;
    resolution?: number | undefined;
    powerPreference?: "default" | "high-performance" | "low-power" | undefined;
}>;
export type EngineConfig = z.infer<typeof EngineConfigSchema>;
//# sourceMappingURL=index.d.ts.map