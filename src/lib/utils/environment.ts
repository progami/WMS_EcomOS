// Environment detection utilities

export const isNode = typeof window === 'undefined' && typeof global !== 'undefined'
export const isBrowser = typeof window !== 'undefined'
export const isEdgeRuntime = typeof globalThis !== 'undefined' && globalThis.EdgeRuntime