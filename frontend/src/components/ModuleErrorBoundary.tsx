'use client'

import React from 'react'

interface Props {
  children: React.ReactNode
  moduleName: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ModuleErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[${this.props.moduleName}] Module error:`, error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-6 py-6 mt-4">
          <div className="flex items-center gap-3 mb-3">
            <svg className="w-5 h-5 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="font-semibold text-red-400">
              {this.props.moduleName} encountered an error
            </div>
          </div>
          <p className="text-sm text-slate-400 mb-4">
            This module crashed unexpectedly. Other modules are unaffected.
            {this.state.error && (
              <span className="block text-xs text-slate-500 mt-1 font-mono">
                {this.state.error.message}
              </span>
            )}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 bg-red-500/20 text-red-400 rounded-xl text-sm font-medium hover:bg-red-500/30 transition-colors"
          >
            Try Again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
