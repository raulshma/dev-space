/**
 * SettingsPanel Component
 *
 * Main settings view with tabbed interface for managing application settings.
 * Integrates ShortcutEditor, BlueprintManager, and ApiKeyManager.
 *
 * Requirements: 8.1, 8.2, 14.2, 14.3, 14.4, 15.1, 15.2
 */

import { useState } from 'react'
import { X, Keyboard, Package, Key } from 'lucide-react'
import { ShortcutEditor } from './ShortcutEditor'
import { BlueprintManager } from './BlueprintManager'
import { ApiKeyManager } from '../Agent/ApiKeyManager'

interface SettingsPanelProps {
  onClose: () => void
}

type SettingsTab = 'shortcuts' | 'blueprints' | 'api-keys'

interface TabConfig {
  id: SettingsTab
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const TABS: TabConfig[] = [
  {
    id: 'shortcuts',
    label: 'Keyboard Shortcuts',
    icon: Keyboard
  },
  {
    id: 'blueprints',
    label: 'Blueprints',
    icon: Package
  },
  {
    id: 'api-keys',
    label: 'API Keys',
    icon: Key
  }
]

export function SettingsPanel({ onClose }: SettingsPanelProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<SettingsTab>('shortcuts')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="flex h-[80vh] w-[90vw] max-w-6xl flex-col overflow-hidden rounded-lg border border-neutral-700 bg-neutral-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-700 px-6 py-4">
          <h2 className="text-xl font-semibold text-neutral-100">Settings</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
            aria-label="Close settings"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar with tabs */}
          <aside className="w-64 border-r border-neutral-700 bg-neutral-800/50">
            <nav className="p-2">
              {TABS.map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex w-full items-center gap-3 rounded px-3 py-2 text-left text-sm transition-colors ${
                      isActive
                        ? 'bg-amber-600/20 text-amber-400'
                        : 'text-neutral-300 hover:bg-neutral-700/50'
                    }`}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span>{tab.label}</span>
                  </button>
                )
              })}
            </nav>
          </aside>

          {/* Main content area */}
          <main className="flex-1 overflow-y-auto bg-neutral-900 p-6">
            {activeTab === 'shortcuts' && (
              <div className="text-neutral-100">
                <ShortcutEditor />
              </div>
            )}

            {activeTab === 'blueprints' && (
              <div className="h-full">
                <BlueprintManager />
              </div>
            )}

            {activeTab === 'api-keys' && (
              <div className="h-full">
                <ApiKeyManager />
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}
