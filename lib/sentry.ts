import * as Sentry from "@sentry/react-native";
import { Platform } from "react-native";
import Constants from "expo-constants";

/**
 * Initialize Sentry for crash reporting and performance monitoring
 * Call this BEFORE the app renders (in _layout.tsx)
 */
export function initializeSentry() {
  const dsn =
    process.env.EXPO_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN || "";

  // Skip initialization if no DSN provided
  if (!dsn) {
    console.warn("Sentry DSN not found. Crash reporting disabled.");
    return;
  }

  // Determine environment
  const environment =
    process.env.SENTRY_ENVIRONMENT ||
    (__DEV__ ? "development" : "production");

  // Get app version from app.json/package.json
  const version =
    process.env.SENTRY_RELEASE ||
    Constants.expoConfig?.version ||
    "unknown";

  Sentry.init({
    dsn,

    // Environment tracking
    environment,

    // Release and distribution tracking
    release: `artigianoai@${version}`,
    dist: Platform.OS === "ios" ? "1" : "1", // Increment with each build

    // Performance monitoring
    tracesSampleRate: __DEV__ ? 1.0 : 0.2, // 100% in dev, 20% in production

    // Enable native crash reporting
    enableNative: true,
    enableNativeNagger: false, // Don't show "Send Report" dialog to users

    // Integrations
    integrations: [
      new Sentry.ReactNativeTracing({
        // Track navigation performance (requires setup in individual navigators)
        routingInstrumentation: new Sentry.ReactNavigationInstrumentation(),

        // Track fetch/XHR requests
        tracingOrigins: [
          "localhost",
          "supabase.co",
          "stripe.com",
          "resend.com",
          /^\//,
        ],
      }),
    ],

    // Filter and sanitize events before sending
    beforeSend(event, hint) {
      // Don't send events in development (just log them)
      if (__DEV__) {
        console.log("📊 Sentry event (dev mode):", event);
        return null;
      }

      // Filter out sensitive data from request bodies
      if (event.request?.data) {
        const sensitiveFields = [
          "password",
          "fiscal_code",
          "vat_number",
          "iban",
          "stripe_account_id",
          "stripe_customer_id",
          "api_key",
          "token",
        ];

        sensitiveFields.forEach((field) => {
          if (event.request?.data?.[field]) {
            delete event.request.data[field];
          }
        });
      }

      // Sanitize breadcrumbs (remove PII)
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => {
          if (breadcrumb.data) {
            // Redact email addresses
            if (breadcrumb.data.email) {
              breadcrumb.data.email = "[REDACTED]";
            }
            // Redact phone numbers
            if (breadcrumb.data.phone) {
              breadcrumb.data.phone = "[REDACTED]";
            }
          }
          return breadcrumb;
        });
      }

      return event;
    },

    // Ignore common non-critical errors
    ignoreErrors: [
      // Network errors (user has no internet)
      "Network request failed",
      "Failed to fetch",

      // React Native warnings
      "Warning:",
      "VirtualizedList:",

      // Expo warnings
      "Expo",

      // ResizeObserver errors (benign)
      "ResizeObserver loop limit exceeded",
    ],
  });

  // Set global tags
  Sentry.setTag("platform", Platform.OS);
  Sentry.setTag("device_locale", Constants.deviceName || "unknown");

  console.log(`✅ Sentry initialized (${environment})`);
}

/**
 * Capture an exception manually with optional context
 */
export function captureException(
  error: Error,
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, any>;
    level?: Sentry.SeverityLevel;
  }
) {
  Sentry.captureException(error, {
    tags: context?.tags,
    extra: context?.extra,
    level: context?.level || "error",
  });
}

/**
 * Capture a message manually
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = "info",
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, any>;
  }
) {
  Sentry.captureMessage(message, {
    level,
    tags: context?.tags,
    extra: context?.extra,
  });
}

/**
 * Add a breadcrumb (user action tracking)
 */
export function addBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, any>
) {
  Sentry.addBreadcrumb({
    category,
    message,
    level: "info",
    data,
  });
}

/**
 * Start a performance transaction
 */
export function startTransaction(name: string, op: string) {
  return Sentry.startTransaction({
    name,
    op,
  });
}

/**
 * Set user context
 * Call this when user logs in/out
 */
export function setUser(user: {
  id: string;
  email?: string;
  username?: string;
} | null) {
  Sentry.setUser(user);
}

/**
 * Set custom context
 */
export function setContext(key: string, context: Record<string, any>) {
  Sentry.setContext(key, context);
}

/**
 * Set custom tags
 */
export function setTag(key: string, value: string) {
  Sentry.setTag(key, value);
}

/**
 * Export Sentry for direct access if needed
 */
export { Sentry };
