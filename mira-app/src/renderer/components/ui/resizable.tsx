import * as React from "react"
import {
  Group,
  Panel,
  Separator,
  type GroupImperativeHandle,
  type PanelImperativeHandle,
} from "react-resizable-panels"

import { cn } from "renderer/lib/utils"

type GroupProps = React.ComponentProps<typeof Group>
type PanelProps = React.ComponentProps<typeof Panel>
type SeparatorProps = React.ComponentProps<typeof Separator>

const ResizablePanelGroup = React.forwardRef<
  GroupImperativeHandle,
  Omit<GroupProps, "groupRef">
>(function ResizablePanelGroup({ className, ...props }, ref) {
  return (
    <Group
      className={cn(
        "flex h-full w-full data-[orientation=vertical]:flex-col",
        className
      )}
      groupRef={ref}
      {...props}
    />
  )
})

const ResizablePanel = React.forwardRef<
  PanelImperativeHandle,
  Omit<PanelProps, "panelRef">
>(function ResizablePanel({ className, ...props }, ref) {
  return <Panel className={className} panelRef={ref} {...props} />
})

interface ResizableHandleProps extends SeparatorProps {
  withHandle?: boolean
}

function ResizableHandle({
  withHandle,
  className,
  ...props
}: ResizableHandleProps) {
  return (
    <Separator
      className={cn(
        "bg-border relative flex w-1 items-center justify-center data-[orientation=vertical]:h-1 data-[orientation=vertical]:w-full",
        className
      )}
      {...props}
    >
      {withHandle && (
        <div className="bg-muted-foreground/30 hover:bg-muted-foreground/50 h-8 w-1 rounded-full z-10 data-[orientation=vertical]:h-1 data-[orientation=vertical]:w-8" />
      )}
    </Separator>
  )
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }
export type { GroupImperativeHandle, PanelImperativeHandle }
