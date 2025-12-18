/**
 * SettingsPanel Component
 *
 * Main settings view with tabbed interface for managing application settings.
 * Integrates all settings components including general, terminal, AI, shortcuts,
 * blueprints, API keys, model selection, and agent configuration.
 *
 * Requirements: 2.1, 3.1, 5.1, 8.1, 8.2, 14.2, 14.3, 14.4, 15.1, 15.2
 */

import {
  IconSettings,
  IconTerminal2,
  IconKeyboard,
  IconPackage,
  IconKey,
  IconCpu,
  IconRobot,
  IconSparkles,
} from '@tabler/icons-react'
import { Sheet, SheetContent } from 'renderer/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from 'renderer/components/ui/tabs'
import { ShortcutEditor } from './ShortcutEditor'
import { BlueprintManager } from './BlueprintManager'
import { GeneralSettings } from './GeneralSettings'
import { TerminalSettings } from './TerminalSettings'
import { AISettings } from './AISettings'
import { ApiKeyManager } from 'renderer/components/Agent/ApiKeyManager'
import { ModelSelector } from 'renderer/components/Agent/ModelSelector'
import { AgentConfigPanel } from 'renderer/components/Agent/AgentConfigPanel'

interface SettingsPanelProps {
  onClose: () => void
  isOpen: boolean
}

export function SettingsPanel({
  onClose,
  isOpen,
}: SettingsPanelProps): React.JSX.Element {
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="!w-[900px] !max-w-[900px] p-0 overflow-hidden">
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="px-6 py-4 border-b shrink-0 bg-background relative z-10">
            <h2 className="text-lg font-semibold text-foreground">Settings</h2>
          </div>

          <Tabs defaultValue="general" orientation="vertical" className="flex-1 overflow-hidden min-h-0">
            <div className="flex flex-1 overflow-hidden relative">
              {/* Sidebar with tabs */}
              <aside className="w-56 shrink-0 border-r bg-muted/30 overflow-y-auto min-h-0">
                <TabsList className="flex flex-col h-auto w-full bg-transparent p-2 gap-1 items-stretch justify-start">
                {/* General Section */}
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  General
                </div>
                <TabsTrigger
                  value="general"
                  className="w-full justify-start gap-3 data-[state=active]:bg-primary/10"
                >
                  <IconSettings className="h-4 w-4" />
                  Appearance
                </TabsTrigger>
                <TabsTrigger
                  value="terminal"
                  className="w-full justify-start gap-3 data-[state=active]:bg-primary/10"
                >
                  <IconTerminal2 className="h-4 w-4" />
                  Terminal
                </TabsTrigger>
                <TabsTrigger
                  value="shortcuts"
                  className="w-full justify-start gap-3 data-[state=active]:bg-primary/10"
                >
                  <IconKeyboard className="h-4 w-4" />
                  Keyboard Shortcuts
                </TabsTrigger>

                {/* AI Section */}
                <div className="px-2 py-1.5 mt-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  AI & Agents
                </div>
                <TabsTrigger
                  value="ai-settings"
                  className="w-full justify-start gap-3 data-[state=active]:bg-primary/10"
                >
                  <IconSparkles className="h-4 w-4" />
                  AI Settings
                </TabsTrigger>
                <TabsTrigger
                  value="api-keys"
                  className="w-full justify-start gap-3 data-[state=active]:bg-primary/10"
                >
                  <IconKey className="h-4 w-4" />
                  API Keys
                </TabsTrigger>
                <TabsTrigger
                  value="ai-models"
                  className="w-full justify-start gap-3 data-[state=active]:bg-primary/10"
                >
                  <IconCpu className="h-4 w-4" />
                  AI Models
                </TabsTrigger>
                <TabsTrigger
                  value="agent-config"
                  className="w-full justify-start gap-3 data-[state=active]:bg-primary/10"
                >
                  <IconRobot className="h-4 w-4" />
                  Agent Configuration
                </TabsTrigger>

                {/* Tools Section */}
                <div className="px-2 py-1.5 mt-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Tools
                </div>
                <TabsTrigger
                  value="blueprints"
                  className="w-full justify-start gap-3 data-[state=active]:bg-primary/10"
                >
                  <IconPackage className="h-4 w-4" />
                  Blueprints
                </TabsTrigger>
                </TabsList>
              </aside>

              {/* Main content area */}
              <div className="flex-1 overflow-y-auto min-h-0">
              <TabsContent value="general" className="m-0 p-6 h-full">
                <GeneralSettings />
              </TabsContent>

              <TabsContent value="terminal" className="m-0 p-6 h-full">
                <TerminalSettings />
              </TabsContent>

              <TabsContent value="shortcuts" className="m-0 p-6">
                <ShortcutEditor />
              </TabsContent>

              <TabsContent value="ai-settings" className="m-0 p-6 h-full">
                <AISettings />
              </TabsContent>

              <TabsContent value="api-keys" className="m-0 p-6 h-full">
                <ApiKeyManager />
              </TabsContent>

              <TabsContent value="ai-models" className="m-0 p-6 h-full">
                <div className="space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold">AI Model Configuration</h2>
                    <p className="text-sm text-muted-foreground">
                      Select and configure AI models from OpenRouter for different actions
                    </p>
                  </div>
                  <ModelSelector showActionModels />
                </div>
              </TabsContent>

              <TabsContent value="agent-config" className="m-0 p-6 h-full">
                <AgentConfigPanel />
              </TabsContent>

                <TabsContent value="blueprints" className="m-0 p-6 h-full">
                  <BlueprintManager />
                </TabsContent>
              </div>
            </div>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  )
}
