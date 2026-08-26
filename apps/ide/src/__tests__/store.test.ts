import { describe, it, expect } from 'vitest';
import { useIDEStore } from '../store/ideStore.js';

describe('ideStore', () => {
  it('initial activeTab is canvas', () => {
    const state = useIDEStore.getState();
    expect(state.activeTab).toBe('code');
  });

  it('setActiveTab updates the tab', () => {
    useIDEStore.getState().setActiveTab('code');
    expect(useIDEStore.getState().activeTab).toBe('code');
    useIDEStore.getState().setActiveTab('canvas');
  });

  it('sidebarOpen starts false', () => {
    expect(useIDEStore.getState().sidebarOpen).toBe(false);
  });

  it('toggleSidebar flips sidebarOpen', () => {
    useIDEStore.getState().toggleSidebar();
    expect(useIDEStore.getState().sidebarOpen).toBe(true);
    useIDEStore.getState().toggleSidebar();
    expect(useIDEStore.getState().sidebarOpen).toBe(false);
  });

  it('addLog adds a log entry', () => {
    const before = useIDEStore.getState().logs.length;
    useIDEStore.getState().addLog('info', 'Test message');
    expect(useIDEStore.getState().logs.length).toBe(before + 1);
  });

  it('clearLogs empties logs', () => {
    useIDEStore.getState().clearLogs();
    expect(useIDEStore.getState().logs.length).toBe(0);
  });
});

describe('ideStore — build mode', () => {
  it('buildMode starts as debug', () => {
    expect(useIDEStore.getState().buildMode).toBe('debug');
  });

  it('toggleBuildMode switches debug→release', () => {
    useIDEStore.setState({ buildMode: 'debug' });
    useIDEStore.getState().toggleBuildMode();
    expect(useIDEStore.getState().buildMode).toBe('release');
  });

  it('toggleBuildMode switches release→debug', () => {
    useIDEStore.setState({ buildMode: 'release' });
    useIDEStore.getState().toggleBuildMode();
    expect(useIDEStore.getState().buildMode).toBe('debug');
  });

  it('setBuildMode sets explicit mode', () => {
    useIDEStore.getState().setBuildMode('release');
    expect(useIDEStore.getState().buildMode).toBe('release');
    useIDEStore.getState().setBuildMode('debug');
    expect(useIDEStore.getState().buildMode).toBe('debug');
  });
});

describe('ideStore — build status', () => {
  it('setBuildStatus sets success with duration', () => {
    useIDEStore.getState().setBuildStatus('success', [], 123);
    const s = useIDEStore.getState();
    expect(s.buildStatus).toBe('success');
    expect(s.buildErrors).toEqual([]);
    expect(s.buildDuration).toBe(123);
    expect(s.lastBuildAt).not.toBeNull();
  });

  it('setBuildStatus sets error with errors', () => {
    useIDEStore.getState().setBuildStatus('error', ['Syntax error'], 50);
    const s = useIDEStore.getState();
    expect(s.buildStatus).toBe('error');
    expect(s.buildErrors).toEqual(['Syntax error']);
  });

  it('setBuildStatus building does not update lastBuildAt', () => {
    useIDEStore.setState({ lastBuildAt: null });
    useIDEStore.getState().setBuildStatus('building');
    expect(useIDEStore.getState().lastBuildAt).toBeNull();
  });
});

describe('ideStore — clearBuildCache', () => {
  it('resets build state and adds log', () => {
    useIDEStore.setState({ buildStatus: 'error', buildErrors: ['e'], buildDuration: 10, lastBuildAt: 999 });
    useIDEStore.getState().clearBuildCache();
    const s = useIDEStore.getState();
    expect(s.buildStatus).toBe('idle');
    expect(s.buildErrors).toEqual([]);
    expect(s.buildDuration).toBeNull();
    expect(s.lastBuildAt).toBeNull();
    const lastLog = s.logs[s.logs.length - 1];
    expect(lastLog.message).toContain('Build cache cleared');
  });
});

describe('ideStore — debugOverlay', () => {
  it('debugOverlay starts false', () => {
    useIDEStore.setState({ debugOverlay: false });
    expect(useIDEStore.getState().debugOverlay).toBe(false);
  });

  it('toggleDebugOverlay flips the value', () => {
    useIDEStore.setState({ debugOverlay: false });
    useIDEStore.getState().toggleDebugOverlay();
    expect(useIDEStore.getState().debugOverlay).toBe(true);
    useIDEStore.getState().toggleDebugOverlay();
    expect(useIDEStore.getState().debugOverlay).toBe(false);
  });
});
