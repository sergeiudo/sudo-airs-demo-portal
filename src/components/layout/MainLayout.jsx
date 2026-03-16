import React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { useAppContext } from '../../context/AppContext'

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
}

const pageTransition = {
  type: 'tween',
  ease: [0.4, 0, 0.2, 1],
  duration: 0.25,
}

export function MainLayout({ children, viewKey }) {
  const isIframeView = viewKey === 'claudeHooks'

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-base-950 grid-bg">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar />

        {/* View content */}
        <main className="flex-1 overflow-hidden relative">
          {isIframeView ? (
            <div className="absolute inset-0 overflow-hidden">
              {children}
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={viewKey}
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={pageTransition}
                className="absolute inset-0 overflow-hidden"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          )}
        </main>
      </div>
    </div>
  )
}
