/**
 * AgentsSidebarPanel Component
 *
 * Sidebar panel for viewing running agents.
 */

import { memo } from 'react'
import { IconRobot } from '@tabler/icons-react'
import { RunningAgentsView } from 'renderer/components/Agent'

export const AgentsSidebarPanel = memo(function AgentsSidebarPanel() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-sm font-medium flex items-center gap-2">
          <IconRobot className="h-4 w-4" />
          Running Agents
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <RunningAgentsView compact />
      </div>
    </div>
  )
})
