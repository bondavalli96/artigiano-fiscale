/**
 * Sentry stub — @sentry/react-native is not installed yet.
 * When ready, run: npx expo install @sentry/react-native
 * Then restore the real implementation and re-add the plugin to app.json.
 */

export function initializeSentry() {
  // No-op until @sentry/react-native is installed
}

export function captureException(error: Error, _context?: any) {
  if (__DEV__) {
    console.error("[Sentry stub] captureException:", error);
  }
}

export function captureMessage(message: string, _level?: string, _context?: any) {
  if (__DEV__) {
    console.log("[Sentry stub] captureMessage:", message);
  }
}

export function addBreadcrumb(_category: string, _message: string, _data?: any) {
  // No-op
}

export function startTransaction(_name: string, _op: string) {
  return { finish: () => {} };
}

export function setUser(_user: any) {
  // No-op
}

export function setContext(_key: string, _context: any) {
  // No-op
}

export function setTag(_key: string, _value: string) {
  // No-op
}
