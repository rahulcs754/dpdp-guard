/** Known third parties. Plain data: add entries here, not logic. */
export interface Processor {
  name: string;
  /** analytics and marketing receivers trigger gap DPDP-04 when given personal data. */
  kind: "analytics" | "marketing" | "session-replay" | "error-tracking" | "payments" | "messaging" | "support";
  packages: string[];
  /** Matched against the callee text, e.g. `mixpanel.track`. */
  calls: RegExp[];
}

export const PROCESSORS: Processor[] = [
  { name: "Google Analytics", kind: "analytics", packages: ["@next/third-parties", "react-ga4", "react-ga"], calls: [/^(window\.)?gtag$/, /^ReactGA\.(event|set|send)$/, /(^|\.)dataLayer\.push$/, /^sendGAEvent$/] },
  { name: "Meta Pixel", kind: "marketing", packages: ["react-facebook-pixel"], calls: [/^(window\.)?fbq$/, /^ReactPixel\.(init|track|trackCustom)$/] },
  { name: "Mixpanel", kind: "analytics", packages: ["mixpanel-browser", "mixpanel"], calls: [/^mixpanel\.(track|identify|register|alias|people\.set)$/] },
  { name: "PostHog", kind: "analytics", packages: ["posthog-js", "posthog-node"], calls: [/^posthog\.(capture|identify|register|alias|setPersonProperties)$/] },
  { name: "Segment", kind: "analytics", packages: ["@segment/analytics-next", "@segment/analytics-node", "analytics-node"], calls: [/^analytics\.(track|identify|page|group|alias)$/] },
  { name: "Amplitude", kind: "analytics", packages: ["@amplitude/analytics-browser", "amplitude-js"], calls: [/^amplitude\.(track|logEvent|setUserId|identify)$/] },
  { name: "Firebase Analytics", kind: "analytics", packages: ["firebase"], calls: [/^logEvent$/, /^setUserProperties$/] },
  { name: "Hotjar", kind: "session-replay", packages: ["@hotjar/browser", "react-hotjar"], calls: [/^(Hotjar|hotjar)\.identify$/] },
  { name: "LogRocket", kind: "session-replay", packages: ["logrocket"], calls: [/^LogRocket\.(identify|track)$/] },
  { name: "Microsoft Clarity", kind: "session-replay", packages: ["@microsoft/clarity"], calls: [/^(window\.)?clarity$/, /^Clarity\.(identify|setTag)$/] },
  { name: "Sentry", kind: "error-tracking", packages: ["@sentry/nextjs", "@sentry/node", "@sentry/react", "@sentry/browser"], calls: [/^Sentry\.(setUser|setContext|setExtra|setTag)$/] },
  { name: "Razorpay", kind: "payments", packages: ["razorpay"], calls: [/^razorpay\.(customers|orders)\.create$/] },
  { name: "Stripe", kind: "payments", packages: ["stripe", "@stripe/stripe-js"], calls: [/^stripe\.customers\.(create|update)$/] },
  { name: "Cashfree", kind: "payments", packages: ["cashfree-pg"], calls: [/^Cashfree\.PGCreateOrder$/] },
  { name: "Twilio", kind: "messaging", packages: ["twilio"], calls: [/^(twilio|twilioClient)\.messages\.create$/] },
  { name: "SendGrid", kind: "messaging", packages: ["@sendgrid/mail"], calls: [/^sgMail\.send$/] },
  { name: "Resend", kind: "messaging", packages: ["resend"], calls: [/^resend\.emails\.send$/] },
  { name: "Intercom", kind: "support", packages: ["@intercom/messenger-js-sdk", "react-use-intercom"], calls: [/^(window\.)?Intercom$/, /^boot$/] },
];

export function processorForCall(callee: string): Processor | null {
  return PROCESSORS.find((p) => p.calls.some((re) => re.test(callee))) ?? null;
}

export function processorForPackage(pkg: string): Processor | null {
  return PROCESSORS.find((p) => p.packages.includes(pkg)) ?? null;
}

export function sharesToTracker(p: Processor): boolean {
  return p.kind === "analytics" || p.kind === "marketing" || p.kind === "session-replay";
}
