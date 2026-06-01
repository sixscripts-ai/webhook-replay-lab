// Static demo dataset used by the seed script and as a fallback display set
// when the database is empty. Kept dependency-free so it can be imported by
// both server components and the seed script.

const RECEIVER_BASE =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
  "https://webhookreplay-lab.vercel.app";

export const demoTargets = [
  {
    id: "tgt_demo_stripe",
    name: "Stripe Internal Forwarder",
    provider: "stripe-demo",
    url: `${RECEIVER_BASE}/api/demo-receiver/stripe`,
    isActive: true,
    isRetryEnabled: true,
    maxAttempts: 3,
    backoffStrategy: "exponential" as const,
    backoffBaseMs: 500,
    timeoutMs: 15000,
    retryOnStatuses: [500, 502, 503, 504],
    isSignatureVerificationEnabled: true,
    signatureHeaderName: "x-stripe-signature",
    signatureAlgorithm: "hmac-sha256",
    signingSecretEnvVar: "STRIPE_DEMO_SIGNING_SECRET",
  },
  {
    id: "tgt_demo_github",
    name: "GitHub Sync Worker",
    provider: "github-demo",
    url: `${RECEIVER_BASE}/api/demo-receiver/github`,
    isActive: true,
    isRetryEnabled: false,
    maxAttempts: 1,
    backoffStrategy: "none" as const,
    backoffBaseMs: 500,
    timeoutMs: 15000,
    retryOnStatuses: [],
    isSignatureVerificationEnabled: false,
    signatureHeaderName: null,
    signatureAlgorithm: null,
    signingSecretEnvVar: null,
  },
  {
    id: "tgt_demo_shopify",
    name: "Shopify Order Bridge",
    provider: "shopify-demo",
    url: `${RECEIVER_BASE}/api/demo-receiver/shopify`,
    isActive: false,
    isRetryEnabled: false,
    maxAttempts: 1,
    backoffStrategy: "none" as const,
    backoffBaseMs: 500,
    timeoutMs: 15000,
    retryOnStatuses: [],
    isSignatureVerificationEnabled: false,
    signatureHeaderName: null,
    signatureAlgorithm: null,
    signingSecretEnvVar: null,
  },
];

type DemoEvent = {
  id: string;
  provider: string;
  eventType: string;
  status: "received" | "delivered" | "failed" | "replayed" | "dead_letter";
  headers: Record<string, string>;
  payload: Record<string, unknown>;
  receivedAt: string; // ISO
  errorMessage?: string;
  targetId?: string;
  // M3 fields
  externalEventId?: string | null;
  dedupeKey?: string | null;
  duplicateCount?: number;
  signatureStatus?: "not_configured" | "verified" | "failed";
  signatureHeaderName?: string | null;
  signatureVerifiedAt?: string | null;
  signatureFailureReason?: string | null;
  deadLetterReason?: string | null;
  deadLetteredAt?: string | null;
};

export const demoEvents: DemoEvent[] = [
  {
    id: "evt_demo_001",
    provider: "stripe-demo",
    eventType: "payment.failed",
    status: "failed",
    headers: {
      "content-type": "application/json",
      "x-event-type": "payment.failed",
      "stripe-signature": "t=1700000000,v1=demo",
      "user-agent": "Stripe/1.0 (+https://stripe.com)",
    },
    payload: {
      id: "evt_demo_001",
      type: "payment.failed",
      amount: 4200,
      currency: "usd",
      customer: "cus_demo_42",
      reason: "insufficient_funds",
    },
    receivedAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    errorMessage: "Non-2xx response: 502",
    targetId: "tgt_demo_stripe",
    externalEventId: "evt_demo_001",
    dedupeKey: "stripe-demo:external:evt_demo_001",
    signatureStatus: "verified",
    signatureHeaderName: "x-stripe-signature",
    signatureVerifiedAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
  },
  {
    id: "evt_demo_002",
    provider: "stripe-demo",
    eventType: "charge.succeeded",
    status: "delivered",
    headers: {
      "content-type": "application/json",
      "x-event-type": "charge.succeeded",
      "stripe-signature": "t=1700000100,v1=demo",
    },
    payload: {
      id: "evt_demo_002",
      type: "charge.succeeded",
      amount: 1999,
      currency: "usd",
      customer: "cus_demo_17",
    },
    receivedAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    targetId: "tgt_demo_stripe",
    externalEventId: "evt_demo_002",
    dedupeKey: "stripe-demo:external:evt_demo_002",
    duplicateCount: 2,
    signatureStatus: "verified",
    signatureHeaderName: "x-stripe-signature",
    signatureVerifiedAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
  },
  {
    id: "evt_demo_003",
    provider: "github-demo",
    eventType: "pull_request.opened",
    status: "replayed",
    headers: {
      "content-type": "application/json",
      "x-github-event": "pull_request",
      "x-github-delivery": "d7f9a-demo",
    },
    payload: {
      action: "opened",
      number: 42,
      pull_request: {
        title: "Add webhook replay tooling",
        user: { login: "villain" },
      },
      repository: { full_name: "demo/webhook-lab" },
    },
    receivedAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    targetId: "tgt_demo_github",
    externalEventId: "d7f9a-demo",
    dedupeKey: "github-demo:external:d7f9a-demo",
  },
  {
    id: "evt_demo_004",
    provider: "shopify-demo",
    eventType: "orders/create",
    status: "received",
    headers: {
      "content-type": "application/json",
      "x-shopify-topic": "orders/create",
      "x-shopify-shop-domain": "demo.myshopify.com",
    },
    payload: {
      id: 880123,
      order_number: 1042,
      total_price: "129.00",
      customer: { email: "buyer@example.com" },
      line_items: [{ title: "Volt Tee", quantity: 2 }],
    },
    receivedAt: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
    externalEventId: "880123",
    dedupeKey: "shopify-demo:external:880123",
  },
  {
    id: "evt_demo_005",
    provider: "stripe-demo",
    eventType: "invoice.payment_failed",
    status: "dead_letter",
    headers: {
      "content-type": "application/json",
      "x-event-type": "invoice.payment_failed",
    },
    payload: {
      id: "evt_demo_005",
      type: "invoice.payment_failed",
      invoice: "in_demo_42",
      attempt_count: 3,
    },
    receivedAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    errorMessage: "Non-2xx response: 503",
    targetId: "tgt_demo_stripe",
    externalEventId: "evt_demo_005",
    dedupeKey: "stripe-demo:external:evt_demo_005",
    signatureStatus: "verified",
    signatureHeaderName: "x-stripe-signature",
    signatureVerifiedAt: new Date(
      Date.now() - 1000 * 60 * 60 * 5
    ).toISOString(),
    deadLetterReason: "Replay failed after 3 attempts: Non-2xx response: 503",
    deadLetteredAt: new Date(
      Date.now() - 1000 * 60 * 60 * 4
    ).toISOString(),
  },
  {
    id: "evt_demo_006",
    provider: "unknown-provider",
    eventType: "custom.event",
    status: "received",
    headers: { "content-type": "application/json" },
    payload: { hello: "world", nested: { ok: true, n: 7 } },
    receivedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    dedupeKey: "unknown-provider:hash:demo006",
  },
  {
    id: "evt_demo_007",
    provider: "stripe-demo",
    eventType: "charge.refunded",
    status: "received",
    headers: {
      "content-type": "application/json",
      "x-event-type": "charge.refunded",
      "x-stripe-signature": "sha256=tampered",
    },
    payload: {
      id: "evt_demo_007",
      type: "charge.refunded",
      amount: 1500,
      currency: "usd",
    },
    receivedAt: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
    targetId: "tgt_demo_stripe",
    externalEventId: "evt_demo_007",
    dedupeKey: "stripe-demo:external:evt_demo_007",
    signatureStatus: "failed",
    signatureHeaderName: "x-stripe-signature",
    signatureFailureReason: "HMAC mismatch",
  },
];

export const demoEvalCases = [
  {
    id: "eval_demo_1",
    name: "Stripe payment.failed forwards 200",
    description:
      "Replaying a failed payment should reach the forwarder, return 200, and respond quickly.",
    eventId: "evt_demo_001",
    targetId: "tgt_demo_stripe",
    expectedStatus: 200,
    expectedBodyIncludes: '"ok":true',
    expectedMaxDurationMs: 2000,
    isActive: true,
  },
  {
    id: "eval_demo_2",
    name: "GitHub pull_request.opened forwards 200",
    description: "Replaying an opened PR should be accepted by the sync worker.",
    eventId: "evt_demo_003",
    targetId: "tgt_demo_github",
    expectedStatus: 200,
    expectedBodyIncludes: '"ok":true',
    expectedMaxDurationMs: 1500,
    isActive: true,
  },
];
