import React from 'react'

export function ClaudeHooksView() {
  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      <iframe
        src="/hooks-guide.html"
        className="flex-1 w-full border-0"
        title="Claude Code Hooks Integration Guide"
      />
    </div>
  )
}
