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
  IconListCheck,
} from '@tabler/icons-react'
import { Sheet, SheetContent } from 'renderer/components/ui/sheet'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from 'renderer/components/ui/tabs'
import { ShortcutEditor } from './ShortcutEditor'
import { BlueprintManager } from './BlueprintManager'
import { GeneralSettings } from './GeneralSettings'
import { TerminalSettings } from './TerminalSettings'
import { AISettings } from './AISettings'
import { TaskSettings } from './TaskSettings'
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
    <Sheet onOpenChange={onClose} open={isOpen}>
      <SheetContent
        className="w-[900px]! min-w-[70vw]! p-0 overflow-hidden"
        side="right"
      >
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="px-6 py-4 border-b shrink-0 bg-background relative z-10">
            <h2 className="text-lg font-semibold text-foreground">Settings</h2>
          </div>

          <Tabs
            className="flex-1 overflow-hidden min-h-0"
            defaultValue="general"
            orientation="vertical"
          >
            <div className="flex flex-1 overflow-hidden relative">
              {/* Sidebar with tabs */}
              <aside className="w-56 shrink-0 border-r bg-muted/30 overflow-y-auto min-h-0">
                <TabsList className="flex flex-col h-auto w-full bg-transparent p-2 gap-1 items-stretch justify-start">
                  {/* General Section */}
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    General
                  </div>
                  <TabsTrigger
                    className="w-full justify-start gap-3 data-[state=active]:bg-primary/10"
                    value="general"
                  >
                    <IconSettings className="h-4 w-4" />
                    Appearance
                  </TabsTrigger>
                  <TabsTrigger
                    className="w-full justify-start gap-3 data-[state=active]:bg-primary/10"
                    value="terminal"
                  >
                    <IconTerminal2 className="h-4 w-4" />
                    Terminal
                  </TabsTrigger>
                  <TabsTrigger
                    className="w-full justify-start gap-3 data-[state=active]:bg-primary/10"
                    value="shortcuts"
                  >
                    <IconKeyboard className="h-4 w-4" />
                    Keyboard Shortcuts
                  </TabsTrigger>

                  {/* AI Section */}
                  <div className="px-2 py-1.5 mt-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    AI & Agents
                  </div>
                  <TabsTrigger
                    className="w-full justify-start gap-3 data-[state=active]:bg-primary/10"
                    value="ai-settings"
                  >
                    <IconSparkles className="h-4 w-4" />
                    AI Settings
                  </TabsTrigger>
                  <TabsTrigger
                    className="w-full justify-start gap-3 data-[state=active]:bg-primary/10"
                    value="api-keys"
                  >
                    <IconKey className="h-4 w-4" />
                    API Keys
                  </TabsTrigger>
                  <TabsTrigger
                    className="w-full justify-start gap-3 data-[state=active]:bg-primary/10"
                    value="ai-models"
                  >
                    <IconCpu className="h-4 w-4" />
                    AI Models
                  </TabsTrigger>
                  <TabsTrigger
                    className="w-full justify-start gap-3 data-[state=active]:bg-primary/10"
                    value="agent-config"
                  >
                    <IconRobot className="h-4 w-4" />
                    Agent Configuration
                  </TabsTrigger>
                  <TabsTrigger
                    className="w-full justify-start gap-3 data-[state=active]:bg-primary/10"
                    value="tasks"
                  >
                    <IconListCheck className="h-4 w-4" />
                    Tasks
                  </TabsTrigger>

                  {/* Tools Section */}
                  <div className="px-2 py-1.5 mt-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Tools
                  </div>
                  <TabsTrigger
                    className="w-full justify-start gap-3 data-[state=active]:bg-primary/10"
                    value="blueprints"
                  >
                    <IconPackage className="h-4 w-4" />
                    Blueprints
                  </TabsTrigger>
                </TabsList>
              </aside>

              {/* Main content area */}
              <div className="flex-1 overflow-y-auto min-h-0">
                <TabsContent className="m-0 p-6 h-full" value="general">
                  <GeneralSettings />
                </TabsContent>

                <TabsContent className="m-0 p-6 h-full" value="terminal">
                  <TerminalSettings />
                </TabsContent>

                <TabsContent className="m-0 p-6" value="shortcuts">
                  <ShortcutEditor />
                </TabsContent>

                <TabsContent className="m-0 p-6 h-full" value="ai-settings">
                  <AISettings />
                </TabsContent>

                <TabsContent className="m-0 p-6 h-full" value="api-keys">
                  <ApiKeyManager />
                </TabsContent>

                <TabsContent className="m-0 p-6 h-full" value="ai-models">
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-lg font-semibold">
                        AI Model Configuration
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        Select and configure AI models from OpenRouter for
                        different actions
                      </p>
                    </div>
                    <ModelSelector showActionModels />
                  </div>
                </TabsContent>

                <TabsContent className="m-0 p-6 h-full" value="agent-config">
                  <AgentConfigPanel />
                </TabsContent>

                <TabsContent className="m-0 p-6 h-full" value="tasks">
                  <TaskSettings />
                </TabsContent>

                <TabsContent className="m-0 p-6 h-full" value="blueprints">
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
