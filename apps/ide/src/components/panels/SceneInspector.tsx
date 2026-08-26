import React from 'react';
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Eye,
  EyeOff,
  Box,
} from 'lucide-react';
import { useIDEStore } from '../../store/ideStore';
import type { EntityItem } from '../../store/ideStore';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

function useIsMobile(): boolean {
  const [mobile, setMobile] = React.useState(() => window.innerWidth < 768);
  React.useEffect(() => {
    const handler = (): void => setMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return mobile;
}

function EntityRow({
  entity,
  depth = 0,
}: {
  entity: EntityItem;
  depth?: number;
}): React.ReactElement {
  const [expanded, setExpanded] = React.useState(true);
  const { selectedEntityId, selectEntity, setRightPanelOpen } = useIDEStore();
  const isMobile = useIsMobile();

  const isSelected = selectedEntityId === entity.id;
  const hasChildren = entity.children.length > 0;

  return (
    <div>
      <button
        onClick={() => {
          selectEntity(entity.id);
          if (isMobile) setRightPanelOpen(true);
        }}
        className="flex items-center w-full gap-1 py-1 pr-2 group"
        style={{
          paddingLeft: `${8 + depth * 14}px`,
          background: isSelected ? 'rgba(124,106,247,0.15)' : undefined,
          borderLeft: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
          color: entity.active ? 'var(--text)' : 'var(--text-muted)',
        }}
      >
        {/* Expand toggle */}
        <span
          className="flex-shrink-0 opacity-60"
          onClick={e => {
            e.stopPropagation();
            if (hasChildren) setExpanded(ex => !ex);
          }}
          style={{ cursor: hasChildren ? 'pointer' : 'default', color: 'var(--text-muted)' }}
        >
          {hasChildren ? (
            expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />
          ) : (
            <span style={{ width: 11, display: 'inline-block' }} />
          )}
        </span>

        {/* Icon */}
        <Box size={11} style={{ flexShrink: 0, color: isSelected ? 'var(--accent)' : 'var(--text-muted)' }} />

        {/* Name */}
        <span className="flex-1 text-xs truncate text-left ml-1">
          {entity.name}
        </span>

        {/* Active toggle */}
        <button
          onClick={e => e.stopPropagation()}
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded transition-opacity"
          style={{ color: 'var(--text-muted)' }}
          title={entity.active ? 'Hide' : 'Show'}
        >
          {entity.active ? <Eye size={11} /> : <EyeOff size={11} />}
        </button>
      </button>

      {/* Children */}
      {hasChildren && expanded && (
        <div>
          {entity.children.map(child => (
            <EntityRow key={child.id} entity={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function SceneInspector(): React.ReactElement {
  const { entities } = useIDEStore();

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 flex-shrink-0"
        style={{ height: 32, borderBottom: '1px solid var(--border)' }}
      >
        <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>
          Scene
        </span>
        <div className="flex items-center gap-1">
          <Badge variant="default">{entities.length} entities</Badge>
          <Button variant="ghost" size="icon" title="Add Entity">
            <Plus size={13} />
          </Button>
        </div>
      </div>

      {/* Entity list */}
      <div className="flex-1 overflow-y-auto py-1">
        {entities.map(entity => (
          <EntityRow key={entity.id} entity={entity} />
        ))}
      </div>
    </div>
  );
}
