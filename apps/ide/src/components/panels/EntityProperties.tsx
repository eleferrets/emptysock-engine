import React from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { useIDEStore } from '../../store/ideStore';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';

function ComponentSection({
  component,
}: {
  component: { type: string; enabled: boolean; properties: Record<string, string> };
}): React.ReactElement {
  const [open, setOpen] = React.useState(true);

  const componentColor: Record<string, string> = {
    Transform: 'var(--blue)',
    Sprite: 'var(--green)',
    PhysicsBody: 'var(--yellow)',
    CharacterController: 'var(--accent)',
    Animator: 'var(--red)',
    CameraSystem: 'var(--blue)',
  };

  const color = componentColor[component.type] ?? 'var(--text-muted)';

  return (
    <div
      className="rounded overflow-hidden"
      style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
    >
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center w-full gap-2 px-3 py-2 text-left transition-colors"
        style={{ background: 'var(--surface-2)' }}
      >
        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
        <span className="flex-1 text-xs font-medium" style={{ color: 'var(--text)' }}>
          {component.type}
        </span>
        <span style={{ color: 'var(--text-muted)' }}>
          {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        </span>
      </button>

      {/* Properties */}
      {open && (
        <div className="px-3 py-2 flex flex-col gap-2">
          {Object.entries(component.properties).map(([key, value]) => (
            <Input
              key={key}
              label={key}
              defaultValue={value}
              className="w-full"
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function EntityProperties(): React.ReactElement {
  const { selectedEntity } = useIDEStore();

  if (selectedEntity === null) {
    return (
      <aside
        className="flex items-center justify-center"
        style={{
          width: 280,
          flexShrink: 0,
          borderLeft: '1px solid var(--border)',
          background: 'var(--surface)',
          color: 'var(--text-muted)',
          fontSize: 12,
        }}
      >
        Select an entity
      </aside>
    );
  }

  return (
    <aside
      style={{
        width: 280,
        flexShrink: 0,
        borderLeft: '1px solid var(--border)',
        background: 'var(--surface)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 flex-shrink-0"
        style={{ height: 36, borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold truncate" style={{ color: 'var(--text)' }}>
            {selectedEntity.name}
          </span>
          <Badge variant="default">{selectedEntity.type}</Badge>
        </div>
        <Button variant="ghost" size="icon" title="Delete entity">
          <Trash2 size={11} style={{ color: 'var(--red)' }} />
        </Button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {/* Transform section (always first) */}
        <div
          className="rounded p-3 flex flex-col gap-2"
          style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
        >
          <div
            className="flex items-center gap-2 mb-1"
            style={{ borderBottom: '1px solid var(--border)', paddingBottom: 6 }}
          >
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--blue)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>Transform</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Input label="X" defaultValue={selectedEntity.transform.x} />
            <Input label="Y" defaultValue={selectedEntity.transform.y} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input label="Scale X" defaultValue={selectedEntity.transform.scaleX} />
            <Input label="Scale Y" defaultValue={selectedEntity.transform.scaleY} />
          </div>
          <Input label="Rotation" defaultValue={selectedEntity.transform.rotation} />
        </div>

        {/* Other components */}
        {selectedEntity.components
          .filter(c => c.type !== 'Transform')
          .map(component => (
            <ComponentSection key={component.type} component={component} />
          ))}

        {/* Add component */}
        <Button variant="outline" size="sm" className="w-full mt-1">
          <Plus size={11} />
          Add Component
        </Button>
      </div>
    </aside>
  );
}
