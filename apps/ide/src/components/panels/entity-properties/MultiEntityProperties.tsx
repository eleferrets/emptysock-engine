import React from "react";
import { Trash2 } from "lucide-react";
import { useIDEStore } from "../../../store/ideStore";
import type { EntityItem } from "../../../store/ideStore";
import { Button } from "../../ui/Button";
import { Input } from "../../ui/Input";
import { engineChannel } from "../../../services/EngineChannel";
import {
  V2_COMPONENT_METADATA,
  FieldIcon,
  SchemaFieldControl,
  ComponentHeaderRow,
} from "./shared";

/**
 * Multi-select inspector view. Shows entity count, an N/M share count per
 * component type, and for schema'd components every selected entity shares,
 * real editable fields fetched live per entity via `engineChannel`'s
 * `getComponent`, with a "Mixed" placeholder for values that differ across
 * the selection. Edits apply to the whole selection via `setComponent`
 * called once per entity — fine at realistic selection sizes (tens), no new
 * QueryChannel batch kind was needed.
 *
 * A field whose current value differs across the selection shows the
 * "Mixed" placeholder (the Unity-inspector pattern) rather than an
 * arbitrary one of the values, and committing a new value there overwrites
 * it for every selected entity uniformly. This is deliberately not a full
 * per-entity diffing engine — that's out of proportion for the realistic
 * selection sizes (tens) this panel expects.
 */
export function MultiEntityProperties({
  ids,
}: {
  ids: string[];
}): React.ReactElement {
  const entities = useIDEStore((s) => s.entities);
  const liveEntities = useIDEStore((s) => s.liveEntities);
  const deleteEntity = useIDEStore((s) => s.deleteEntity);

  // Reuse whichever entity list SceneInspector is currently showing (live
  // engine data when available, editor state otherwise) so multi-select
  // reflects the exact same entities the list on the left shows.
  const pool: EntityItem[] =
    liveEntities.length > 0
      ? liveEntities.map((s) => ({
          id: s.id,
          name: s.name,
          active: s.active,
          type: "Entity",
          components: s.components,
          children: [],
        }))
      : (function flatten(items: EntityItem[]): EntityItem[] {
          const out: EntityItem[] = [];
          const walk = (list: EntityItem[]): void => {
            for (const e of list) {
              out.push(e);
              walk(e.children);
            }
          };
          walk(items);
          return out;
        })(entities);

  const selected = pool.filter((e) => ids.includes(e.id));

  // Per-entity live field values, fetched on demand — editor-state entities
  // carry only a bare component-type-name list (no field values), so a
  // multi-select's shared-field view has to ask the live bridge directly,
  // the same `getComponent` query ComponentSection's live path already
  // reads from. Keyed `${entityId}:${componentType}`.
  const [liveByEntity, setLiveByEntity] = React.useState<
    Record<string, Record<string, unknown>>
  >({});
  const idsKey = ids.slice().sort().join(",");
  React.useEffect(() => {
    let cancelled = false;
    const sharedTypes = new Set<string>();
    for (const e of selected) {
      for (const t of e.components) {
        if (V2_COMPONENT_METADATA[t]?.schema !== undefined) sharedTypes.add(t);
      }
    }
    for (const e of selected) {
      const numericId = Number(e.id);
      if (!Number.isFinite(numericId)) continue;
      for (const type of sharedTypes) {
        void engineChannel
          .query<Record<string, unknown>>({
            kind: "getComponent",
            entityId: numericId,
            component: type,
          })
          .then((result) => {
            if (cancelled) return;
            if (result.ok) {
              setLiveByEntity((prev) => ({
                ...prev,
                [`${e.id}:${type}`]: result.data,
              }));
            }
          })
          .catch(() => undefined);
      }
    }
    return () => {
      cancelled = true;
    };
    // idsKey (a sorted, joined snapshot of `ids`) is the intentional dep —
    // `selected` is derived from it plus store state every render, so
    // depending on `selected` itself would re-fire this on every render.
  }, [idsKey]);

  if (selected.length === 0) {
    return (
      <aside
        className="flex items-center justify-center"
        style={{
          width: 280,
          flexShrink: 0,
          borderLeft: "1px solid var(--es-border)",
          background: "var(--es-surface)",
          color: "var(--es-text-muted)",
          fontSize: 12,
        }}
      >
        Selection is stale — nothing here matches anymore.
      </aside>
    );
  }

  // Component-type -> how many of the selected entities have it.
  const typeCounts = new Map<string, number>();
  for (const e of selected) {
    for (const t of e.components)
      typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
  }
  const allTypes = Array.from(typeCounts.keys()).sort();

  const commitToAll = (
    componentType: string,
    fieldKey: string,
    value: unknown,
  ): void => {
    for (const e of selected) {
      const numericId = Number(e.id);
      if (Number.isFinite(numericId)) {
        void engineChannel.query({
          kind: "setComponent",
          entityId: numericId,
          component: componentType,
          patch: { [fieldKey]: value },
        });
      }
    }
  };

  return (
    <aside
      style={{
        width: 280,
        flexShrink: 0,
        borderLeft: "1px solid var(--es-border)",
        background: "var(--es-surface)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        className="flex items-center justify-between px-3 flex-shrink-0"
        style={{
          height: 36,
          borderBottom: "1px solid var(--es-border)",
          background: "var(--es-surface-2)",
        }}
      >
        <span
          className="text-xs font-semibold"
          style={{ color: "var(--es-text)" }}
        >
          {selected.length} entities selected
        </span>
        <Button
          variant="ghost"
          size="icon"
          title="Delete selected"
          onClick={() => selected.forEach((e) => deleteEntity(e.id))}
        >
          <Trash2 size={11} style={{ color: "var(--es-red)" }} />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {allTypes.length === 0 && (
          <p style={{ fontSize: 11, color: "var(--es-text-muted)" }}>
            None of the selected entities carry any components yet.
          </p>
        )}
        {allTypes.map((type) => {
          const meta = V2_COMPONENT_METADATA[type];
          const schema = meta?.schema;
          const count = typeCounts.get(type) ?? 0;
          const shared = count === selected.length;

          // Collect every value seen for each schema field across entities
          // that actually have this component, so a field can be reported
          // as "mixed" when it differs. Values come from the live bridge
          // fetch above — an entity whose fetch hasn't resolved yet (or
          // isn't live-connected at all) simply contributes no value,
          // which reads as "mixed" once any other entity has one.
          const fieldValues: Record<string, Set<string>> = {};
          if (schema) {
            for (const e of selected) {
              const props = liveByEntity[`${e.id}:${type}`];
              if (props === undefined) continue;
              for (const key of Object.keys(schema)) {
                (fieldValues[key] ??= new Set()).add(String(props[key] ?? ""));
              }
            }
          }

          return (
            <div
              key={type}
              style={{
                border: "1px solid var(--es-border)",
                background: "var(--es-surface)",
                borderRadius: 4,
                overflow: "hidden",
              }}
            >
              <ComponentHeaderRow
                color={meta?.color ?? "var(--es-text-muted)"}
                name={type}
                trailing={
                  <span style={{ fontSize: 10, color: "var(--es-text-muted)" }}>
                    {shared ? "shared" : `${count}/${selected.length}`}
                  </span>
                }
              />
              {schema && shared && (
                <div
                  style={{
                    padding: "8px 10px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  {Object.entries(schema).map(([key, fieldSchema]) => {
                    if (fieldSchema === undefined) return null;
                    const values = fieldValues[key];
                    const isMixed = values !== undefined && values.size > 1;
                    if (isMixed) {
                      // Mixed values across the selection: show the
                      // placeholder rather than an arbitrary member's
                      // value, and let a fresh entry overwrite all of them.
                      return (
                        <div key={key} className="flex flex-col gap-1">
                          <label
                            className="flex items-center gap-1"
                            style={{
                              fontSize: 10,
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                              color: "var(--es-text-muted)",
                              fontWeight: 500,
                            }}
                          >
                            <FieldIcon
                              fieldKey={key}
                              fieldSchema={fieldSchema}
                            />
                            {key}
                          </label>
                          <Input
                            placeholder="Mixed — type to set for all"
                            defaultValue=""
                            onChange={(
                              e: React.ChangeEvent<HTMLInputElement>,
                            ) =>
                              commitToAll(
                                type,
                                key,
                                fieldSchema.kind === "number"
                                  ? Number(e.target.value)
                                  : fieldSchema.kind === "boolean"
                                    ? e.target.value === "true"
                                    : e.target.value,
                              )
                            }
                            style={{ width: "100%" }}
                          />
                        </div>
                      );
                    }
                    const single =
                      values !== undefined ? Array.from(values)[0] : "";
                    return (
                      <SchemaFieldControl
                        key={key}
                        fieldKey={key}
                        fieldSchema={fieldSchema}
                        rawValue={single}
                        onCommit={(newValue) =>
                          commitToAll(type, key, newValue)
                        }
                      />
                    );
                  })}
                </div>
              )}
              {(!schema || !shared) && (
                <p
                  style={{
                    margin: 0,
                    padding: "6px 10px",
                    fontSize: 10,
                    color: "var(--es-text-muted)",
                  }}
                >
                  {shared
                    ? "No editable fields for this component yet."
                    : `Only ${count} of ${selected.length} selected have this — editing here would apply to all of them.`}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
