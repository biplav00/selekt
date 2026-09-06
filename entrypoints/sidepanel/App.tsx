import { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { Tabs } from './components/Tabs';
import { SettingsDialog } from './components/SettingsDialog';
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

  useGlobalShortcuts(picker.isInspecting && !showSettings, () => {
    void sendToTab('picker:off');
    picker.setIsInspecting(false);
  });

  let host = '';
  try {
    host = new URL(picker.url).hostname;
  } catch {
    /* no url yet */
  }

  return (
    <div
      style={{
        background: 'var(--bg)',
        color: 'var(--ink)',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Header
        onToggleSettings={() => setShowSettings((value) => !value)}
        showSettings={showSettings}
        isInspecting={picker.isInspecting}
        locatorCount={picker.locators.length}
        host={host}
      />
      {showSettings && (
        <SettingsDialog
          settings={settings}
          onUpdate={updateSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
      <Tabs activeTab={activeTab} onSelect={setActiveTab} onReset={handleReset} />
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <div
          style={{
            padding: '14px',
            maxWidth: 400,
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            style={{
              position: 'absolute',
              width: 1,
              height: 1,
              overflow: 'hidden',
              clip: 'rect(0 0 0 0)',
            }}
          >
            {copied?.startsWith('page.')
              ? `Copied`
              : picker.locators.length
                ? `${picker.locators.length} locators`
                : picker.isInspecting
                  ? 'Inspect active'
                  : ''}
          </div>
          {activeTab === 'inspect' && (
            <InspectPanel
              isInspecting={picker.isInspecting}
              locators={picker.locators}
              meta={picker.meta}
              hoverPreview={picker.hoverPreview}
              copied={copied}
              onToggleInspect={handleToggleInspect}
              onCopy={copy}
              displayLocator={displayLocator}
              history={picker.history}
              onRestore={picker.restoreSnapshot}
              onClearHistory={picker.clearHistory}
            />
          )}
          {activeTab === 'manual' && (
            <ManualPanel
              manualLocator={manual.manualLocator}
              onLocatorChange={manual.setManualLocator}
              manualResult={manual.manualResult}
              onHighlight={() => {
                void manual.handleManualHighlight(true);
              }}
              onClear={manual.handleManualClear}
              suggestions={manual.suggestions}
              showSuggestions={manual.showSuggestions}
              selectedSuggestion={manual.selectedSuggestion}
              onSuggestionClick={manual.handleSuggestionClick}
              onSuggestionHover={manual.setSelectedSuggestion}
              onShowSuggestions={manual.setShowSuggestions}
              onSelectedSuggestionChange={manual.setSelectedSuggestion}
              onFetchSuggestions={manual.fetchSuggestions}
              history={manual.history}
              onSelectEntry={manual.setManualLocator}
              onClearHistory={manual.clearHistory}
              displayLocator={displayLocator}
            />
          )}
        </div>
      </div>
      <div
        style={{
          borderTop: '1px solid var(--line)',
          background: 'var(--bg)',
          padding: '10px 14px',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            maxWidth: 400,
            margin: '0 auto',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.06em',
            color: 'var(--muted)',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>⌥⇧C TOGGLE</span>
          <span>v0.1.0</span>
          <span>ESC CANCEL</span>
        </div>
      </div>
    </div>
  );
}
