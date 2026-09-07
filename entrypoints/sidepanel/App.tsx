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

  const { sendToTab, handleReset, handleToggleInspect, handleMinimize } = useAppActions(
    picker,
    manual,
    settings.theme
  );

  useGlobalShortcuts(picker.isInspecting && !showSettings, () => {
    void sendToTab('picker:off');
    picker.setIsInspecting(false);
  });

  // Closing the sidebar must not strand highlights on the page — take the
  // overlays down best-effort on unload. Fire-and-forget: the panel may be
  // gone before the promise settles.
  useEffect(() => {
    const clearPage = () => {
      for (const type of ['picker:off', 'picker:clear', 'manual:clear']) {
        try {
          void sendToTab(type);
        } catch {
          void 0;
        }
      }
    };
    window.addEventListener('pagehide', clearPage);
    window.addEventListener('beforeunload', clearPage);
    return () => {
      window.removeEventListener('pagehide', clearPage);
      window.removeEventListener('beforeunload', clearPage);
    };
  }, [sendToTab]);

  let host = '';
  try {
    host = new URL(picker.url).hostname;
  } catch {
    /* no url yet */
  }

  return (
    <div className="app">
      <Header
        onToggleSettings={() => setShowSettings((value) => !value)}
        showSettings={showSettings}
        isInspecting={picker.isInspecting}
        locatorCount={picker.locators.length}
        host={host}
        onMinimize={handleMinimize}
      />
      {showSettings && (
        <SettingsDialog
          settings={settings}
          onUpdate={updateSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
      <Tabs
        activeTab={activeTab}
        onSelect={setActiveTab}
        onReset={() => {
          setShowSettings(false);
          void handleReset();
        }}
      />
      <div className="app-scroll">
        <div className="app-content">
          <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
            {copied
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
              onClear={() => {
                void manual.handleManualClear();
              }}
              onCopy={copy}
              copied={copied}
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
      <div className="app-footer">
        <div className="app-footer-inner">
          <span>⌥⇧C TOGGLE</span>
          <span>v0.1.0</span>
          <span>ESC CANCEL</span>
        </div>
      </div>
    </div>
  );
}
