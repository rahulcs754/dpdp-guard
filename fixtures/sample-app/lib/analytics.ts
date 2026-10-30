import mixpanel from "mixpanel-browser";
import * as Sentry from "@sentry/nextjs";

type U = { id: string; email: string; phone: string };

export function identify(user: U) {
  mixpanel.identify(user.id);
  mixpanel.people.set({ $email: user.email, phone: user.phone });
  Sentry.setUser({ id: user.id, email: user.email });
}

export function trackPurchase(orderId: string, amount: number) {
  mixpanel.track("purchase", { orderId, amount });
}
