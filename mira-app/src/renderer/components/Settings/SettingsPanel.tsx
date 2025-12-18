/**
 * SettingsPanel Component
 *
 * Main settings view with tabbed interface for managing application settings.
 * Integrates ShortcutEditor, BlueprintManager, ApiKeyManager, ModelSelector, and AgentConfigPanel.
 *
 * Requirements: 2.1, 3.1, 5.1, 8.1, 8.2, 14.2, 14.3, 14.4, 15.1, 15.2
 */

import { IconKeyboard, IconPackage, IconKey, IconCpu, IconRobot } from '@tabler/icons-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from 'renderer/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from 'renderer/components/ui/tabs'
import { ShortcutEditor } from './ShortcutEditor'
import { BlueprintManager } from './BlueprintManager'
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
      <SheetContent side="right" className="w-full sm:max-w-4xl p-0">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle>Settings</SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="shortcuts" className="h-[calc(100vh-5rem)]">
          <div className="flex h-full">
            {/* Sidebar with tabs */}
            <aside className="w-64 border-r bg-muted/30">
              <TabsList className="flex flex-col h-auto w-full bg-transparent p-2 gap-1">
                <TabsTrigger
                  value="shortcuts"
                  className="w-full justify-start gap-3 data-[state=active]:bg-primary/10"
                >
                  <IconKeyboard className="h-4 w-4" />
                  Keyboard Shortcuts
                </TabsTrigger>
                <TabsTrigger
                  value="blueprints"
                  className="w-full justify-start gap-3 data-[state=active]:bg-primary/10"
                >
                  <IconPackage className="h-4 w-4" />
                  Blueprints
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
              </TabsList>
            </aside>

            {/* Main content area */}
            <div className="flex-1 overflow-y-auto">
              <TabsContent value="shortcuts" className="m-0 p-6">
                <ShortcutEditor />
              </TabsContent>

              <TabsContent value="blueprints" className="m-0 p-6 h-full">
                <BlueprintManager />
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
            </div>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
