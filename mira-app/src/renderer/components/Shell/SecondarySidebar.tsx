/**
 * SecondarySidebar Component
 *
 * Right sidebar for developer tools.
 */

import { useState, memo, lazy, Suspense } from 'react'
import {
  IconTool,
  IconPlug,
  IconCpu,
  IconKey,
  IconBraces,
} from '@tabler/icons-react'
import { Spinner } from 'renderer/components/ui/spinner'
import { cn } from 'renderer/lib/utils'

// Lazy load tool components
const PortKiller = lazy(() =>
  import('renderer/components/DevTools/PortKiller').then(m => ({
    default: m.PortKiller,
  }))
)
const TaskKiller = lazy(() =>
  import('renderer/components/DevTools/TaskKiller').then(m => ({
    default: m.TaskKiller,
  }))
)
const JWTDecoder = lazy(() =>
  import('renderer/components/DevTools/JWTDecoder').then(m => ({
    default: m.JWTDecoder,
  }))
)
const JSONFormatter = lazy(() =>
  import('renderer/components/DevTools/JSONFormatter').then(m => ({
    default: m.JSONFormatter,
  }))
)

type ToolId = 'ports' | 'tasks' | 'jwt' | 'json'

interface ToolConfig {
  id: ToolId
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  component: React.LazyExoticComponent<() => React.JSX.Element>
}

const tools: ToolConfig[] = [
  {
    id: 'ports',
    label: 'Port Killer',
    description: 'Find and kill processes by port',
    icon: IconPlug,
    component: PortKiller,
  },
  {
    id: 'tasks',
    label: 'Task Killer',
    description: 'View and kill running processes',
    icon: IconCpu,
    component: TaskKiller,
  },
  {
    id: 'jwt',
    label: 'JWT Decoder',
    description: 'Decode and inspect JWT tokens',
    icon: IconKey,
    component: JWTDecoder,
  },
  {
    id: 'json',
    label: 'JSON Formatter',
    description: 'Format, validate, and minify JSON',
    icon: IconBraces,
    component: JSONFormatter,
  },
]

export const SecondarySidebar = memo(function SecondarySidebar() {
  const [activeTool, setActiveTool] = useState<ToolId | null>(null)

  const selectedTool = tools.find(t => t.id === activeTool)

  return (
    <aside className="h-full flex flex-col overflow-hidden bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-sm font-medium flex items-center gap-2">
          <IconTool className="h-4 w-4" />
          Developer Tools
        </span>
      </div>

      {/* Tool list or active tool */}
      {activeTool && selectedTool ? (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Tool header with back button */}
          <div className="flex items-center gap-2 border-b border-border px-3 py-1.5">
            <button
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setActiveTool(null)}
              type="button"
            >
              ← Back
            </button>
            <span className="text-xs font-medium">{selectedTool.label}</span>
          </div>

          {/* Tool content */}
          <div className="flex-1 overflow-auto p-2">
            <Suspense
              fallback={
                <div className="flex items-center justify-center h-32">
                  <Spinner className="h-5 w-5" />
                </div>
              }
            >
              <selectedTool.component />
            </Suspense>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-2">
          <div className="space-y-1">
            {tools.map(tool => (
              <button
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-md',
                  'hover:bg-muted/50 transition-colors text-left group'
                )}
                key={tool.id}
                onClick={() => setActiveTool(tool.id)}
                type="button"
              >
                <tool.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{tool.label}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {tool.description}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </aside>
  )
})
