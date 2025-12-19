/**
 * DevTools Trigger
 * Popover menu to select and open developer tools
 */

import { useState, memo, lazy, Suspense } from 'react'
import { Button } from 'renderer/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from 'renderer/components/ui/popover'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from 'renderer/components/ui/dialog'
import { Spinner } from 'renderer/components/ui/spinner'
import {
  IconTool,
  IconPlug,
  IconCpu,
  IconKey,
  IconBraces,
  IconChevronRight,
} from '@tabler/icons-react'

// Lazy load tool components
const PortKiller = lazy(() =>
  import('./PortKiller').then(m => ({ default: m.PortKiller }))
)
const TaskKiller = lazy(() =>
  import('./TaskKiller').then(m => ({ default: m.TaskKiller }))
)
const JWTDecoder = lazy(() =>
  import('./JWTDecoder').then(m => ({ default: m.JWTDecoder }))
)
const JSONFormatter = lazy(() =>
  import('./JSONFormatter').then(m => ({ default: m.JSONFormatter }))
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

export const DevToolsTrigger = memo(
  function DevToolsTrigger(): React.JSX.Element {
    const [popoverOpen, setPopoverOpen] = useState(false)
    const [activeTool, setActiveTool] = useState<ToolConfig | null>(null)

    const handleSelectTool = (tool: ToolConfig) => {
      setPopoverOpen(false)
      setActiveTool(tool)
    }

    const handleCloseDialog = () => {
      setActiveTool(null)
    }

    return (
      <>
        <Popover onOpenChange={setPopoverOpen} open={popoverOpen}>
          <PopoverTrigger
            render={
              <Button className="h-5 w-5" size="icon-sm" variant="ghost">
                <IconTool className="h-3.5 w-3.5" />
              </Button>
            }
          />
          <PopoverContent
            align="end"
            className="w-64 p-1"
            side="top"
            sideOffset={8}
          >
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              Developer Tools
            </div>
            <div className="space-y-0.5">
              {tools.map(tool => (
                <button
                  className="w-full flex items-center gap-3 px-2 py-2 rounded-md hover:bg-muted/50 transition-colors text-left group"
                  key={tool.id}
                  onClick={() => handleSelectTool(tool)}
                  type="button"
                >
                  <tool.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium">{tool.label}</div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {tool.description}
                    </div>
                  </div>
                  <IconChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Dialog
          onOpenChange={open => !open && handleCloseDialog()}
          open={!!activeTool}
        >
          <DialogContent className="sm:max-w-[70vw] h-[80vh] flex flex-col overflow-hidden">
            <DialogHeader className="shrink-0">
              <DialogTitle className="flex items-center gap-2">
                {activeTool && <activeTool.icon className="h-4 w-4" />}
                {activeTool?.label}
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 min-h-0 overflow-hidden">
              {activeTool && (
                <Suspense
                  fallback={
                    <div className="flex items-center justify-center h-full">
                      <Spinner className="h-6 w-6" />
                    </div>
                  }
                >
                  <activeTool.component />
                </Suspense>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </>
    )
  }
)
