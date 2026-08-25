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
