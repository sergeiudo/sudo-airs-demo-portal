import React, { useEffect, useRef } from 'react'

const LIMITS = { left: [264, 572], right: [286, 616] }

/** Draggable pane edge. Wide invisible hit area, 1px visible track. */
export function Handle({ t, onDrag, dragging, side }) {
  const startX = useRef(0)
  const startW = useRef(0)

  const down = (e) => {
    e.preventDefault()
    startX.current = e.clientX
    startW.current = onDrag.width
    onDrag.setDragging(true)
  }

  useEffect(() => {
    if (!dragging) return
    const move = (e) => {
      const delta = side === 'left' ? e.clientX - startX.current : startX.current - e.clientX
      const [min, max] = LIMITS[side]
      onDrag.setWidth(Math.min(max, Math.max(min, startW.current + delta)))
    }
    const up = () => onDrag.setDragging(false)
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
  }, [dragging, side, onDrag])

  return (
    <div onMouseDown={down} className="relative flex-shrink-0 group" style={{ width: 1, cursor: 'col-resize' }}>
      <div className="absolute inset-y-0 -left-2 -right-2 z-10" />
      <div className="h-full w-full transition-colors"
           style={{ background: dragging ? t.block : t.hairline }} />
      <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 flex flex-col justify-center gap-1 pointer-events-none">
        {[0, 1, 2].map((i) => (
          <span key={i} className="rounded-full" style={{ width: 2, height: 2, background: dragging ? t.block : t.inkFaint, opacity: dragging ? 1 : 0.5 }} />
        ))}
      </div>
    </div>
  )
}
