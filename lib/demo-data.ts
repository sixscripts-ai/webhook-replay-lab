// Static demo dataset used by the seed script and as a fallback display set
// when the database is empty. Kept dependency-free so it can be imported by
// both server components and the seed script.

export const demoTargets = [
  {
    id: "tgt_demo_stripe",
    name: "Stripe Internal Forwarder",
    provider: "stripe-demo",
    url: "https://example.com/hooks/stripe",
    isActive: true,
  },
  {
    id: "tgt_demo_github",
    name: "GitHub Sync Worker",
    provider: "github-demo",
    url: "https://example.com/hooks/github",
    isActive: true,
  },
  {
    id: "tgt_demo_shopify",
    name: "Shopify Order Bridge",
    provider: "shopify-demo",
    url: "https://example.com/hooks/shopify",
    isActive: false,
  },
];

type DemoEvent = {
  id: string;
  provider: string;
  eventType: string;
  status: "received" | "delivered" | "failed" | "replayed";
  headers: Record<string, string>;
  payload: Record<string, unknown>;
  receivedAt: string; // ISO
  errorMessage?: string;
  targetId?: string;
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
  },
  {
    id: "evt_demo_005",
    provider: "stripe-demo",
    eventType: "invoice.payment_failed",
    status: "failed",
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
    errorMessage: "ECONNREFUSED",
    targetId: "tgt_demo_stripe",
  },
  {
    id: "evt_demo_006",
    provider: "unknown-provider",
    eventType: "custom.event",
    status: "received",
    headers: { "content-type": "application/json" },
    payload: { hello: "world", nested: { ok: true, n: 7 } },
    receivedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
];

export const demoEvalCases = [
  {
    id: "eval_demo_1",
    name: "Stripe payment.failed forwards 200",
    description: "Replaying a failed payment should reach the forwarder and return 200.",
    eventId: "evt_demo_001",
    targetId: "tgt_demo_stripe",
    expectedStatus: 200,
    expectedBodyIncludes: "ok",
    isActive: true,
  },
  {
    id: "eval_demo_2",
    name: "Shopify orders/create dispatched",
    description: "New orders should be accepted by the order bridge.",
    eventId: "evt_demo_004",
    targetId: "tgt_demo_shopify",
    expectedStatus: 202,
    isActive: true,
  },
];
