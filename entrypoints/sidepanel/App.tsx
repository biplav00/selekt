import { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { Tabs } from './components/Tabs';
import { SettingsPanel } from './components/SettingsPanel';
import { InspectPanel } from './components/InspectPanel';
import { ManualPanel } from './components/ManualPanel';
import { usePicker } from './hooks/usePicker';
import { useManual } from './hooks/useManual';
import { useCopy } from './hooks/useCopy';
import { useSettings } from './hooks/useSettings';
import { useMessages } from './hooks/useMessages';
import { useAppActions } from './hooks/useAppActions';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';
import type { TabId } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('inspect');
  const [showSettings, setShowSettings] = useState(false);
  const { settings, updateSettings, displayLocator } = useSettings();
  const picker = usePicker();
  const manual = useManual(activeTab, picker.url);
  const { copied, copy } = useCopy(displayLocator);

  useMessages({
    onLocators: picker.handleLocators,
    onHover: picker.handleHover,
    onPickerState: picker.handlePickerState,
    onManualResult: manual.setManualResult,
  });

  const { sendToTab, handleReset, handleToggleInspect } = useAppActions(picker, manual);

  useGlobalShortcuts(picker.isInspecting, () => {
    void sendToTab('picker:off');
    picker.setIsInspecting(false);
  });

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--ink)', minHeight: '100vh' }}>
      <Header onToggleSettings={() => setShowSettings((value) => !value)} showSettings={showSettings} />
      {showSettings && <SettingsPanel settings={settings} onUpdate={updateSettings} onClose={() => setShowSettings(false)} />}
      <Tabs activeTab={activeTab} onSelect={setActiveTab} onReset={handleReset} />
      <div style={{ padding: '16px', maxWidth: 360, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div role="status" aria-live="polite" aria-atomic="true" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
          {copied?.startsWith('page.') ? `Copied` : picker.locators.length ? `${picker.locators.length} locators` : picker.isInspecting ? 'Inspect active' : ''}
        </div>
        {activeTab === 'inspect' && (
          <InspectPanel
            isInspecting={picker.isInspecting}
            locators={picker.locators}
            meta={picker.meta}
            hoverPreview={picker.hoverPreview}
            url={picker.url}
            copied={copied}
            onToggleInspect={handleToggleInspect}
            onCopy={copy}
            displayLocator={displayLocator}
          />
        )}
        {activeTab === 'manual' && (
          <ManualPanel
            manualLocator={manual.manualLocator}
            onLocatorChange={manual.setManualLocator}
            manualResult={manual.manualResult}
            onHighlight={manual.handleManualHighlight}
            onClear={manual.handleManualClear}
            suggestions={manual.suggestions}
            showSuggestions={manual.showSuggestions}
            selectedSuggestion={manual.selectedSuggestion}
            onSuggestionClick={manual.handleSuggestionClick}
            onSuggestionHover={manual.setSelectedSuggestion}
            onShowSuggestions={manual.setShowSuggestions}
            onSelectedSuggestionChange={manual.setSelectedSuggestion}
            onFetchSuggestions={manual.fetchSuggestions}
          />
        )}
        <div style={{ paddingTop: 10, borderTop: '1px solid var(--line)', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', display: 'flex', justifyContent: 'space-between' }}>
          <span>⌥⇧C Toggle</span>
          <span>ESC Cancel</span>
        </div>
      </div>
    </div>
  );
}
