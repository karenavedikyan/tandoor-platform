/**
 * upsertPrimaryDealerContactFromEditForm: create vs patch primary dealer contact.
 */
import assert from "node:assert/strict";

const DEALER = "dealer-test-1";
const PROFILE = { personaUserId: "u1", role: "admin", displayName: "Test" } as import("../release-demo-profile.js").ReleaseDemoProfile;

let fetchCalls: Array<{ url: string; method: string; body?: unknown }> = [];

async function mockFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = String(input);
  const method = (init?.method ?? "GET").toUpperCase();
  let body: unknown;
  if (init?.body && typeof init.body === "string") {
    try {
      body = JSON.parse(init.body);
    } catch {
      body = init.body;
    }
  }
  fetchCalls.push({ url, method, body });

  if (url.includes("/api/client-contacts/list")) {
    const empty = url.includes("empty=1");
    const hasPrimary = url.includes("has-primary=1");
    const items =
      empty || !hasPrimary
        ? []
        : [
            {
              id: "contact-primary-1",
              clientId: DEALER,
              scope: "dealer",
              scopeRef: null,
              fullName: "Старый контакт",
              role: "Директор",
              phone: "+7 (900) 000-00-00",
              whatsapp: "+7 (900) 111-11-11",
              telegram: "@old",
              email: "old@test.ru",
              comment: "старое",
              isPrimary: true,
              isActual: true,
              source: "manual",
              deleteRequestedAt: null,
              deleteRequestReason: null,
              createdByUserId: null,
              createdByName: null,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          ];
    return new Response(JSON.stringify({ success: true, clientId: DEALER, items, dealerTimeline: [], scopeTimelines: {} }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (url.includes("/api/client-contacts/create") || url.includes("/api/client-contacts/patch")) {
    return new Response(JSON.stringify({ success: true }), { status: url.includes("create") ? 201 : 200 });
  }

  return new Response(JSON.stringify({ success: false }), { status: 404 });
}

const originalFetch = globalThis.fetch;

async function runTests(): Promise<void> {
  globalThis.fetch = mockFetch as typeof fetch;

  const { upsertPrimaryDealerContactFromEditForm } = await import("../client-contacts.js");

  // empty list → create
  fetchCalls = [];
  const okCreate = await upsertPrimaryDealerContactFromEditForm({
    dealerId: DEALER,
    name: "Новый клиент",
    phone: "+7 (999) 111-22-33",
    email: "new@test.ru",
    comment: "заметка",
    profile: PROFILE,
  });
  assert.equal(okCreate, true);
  const createCall = fetchCalls.find((c) => c.url.includes("/create"));
  assert.ok(createCall);
  assert.equal((createCall!.body as Record<string, unknown>).clientId, DEALER);
  assert.equal((createCall!.body as Record<string, unknown>).fullName, "Новый клиент");
  assert.equal((createCall!.body as Record<string, unknown>).isPrimary, true);

  // patch primary — role/whatsapp/telegram not in body
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const u = String(input);
    if (u.includes("/list")) {
      return mockFetch(`${u}?has-primary=1`, init);
    }
    return mockFetch(input, init);
  }) as typeof fetch;

  fetchCalls = [];
  const okPatch = await upsertPrimaryDealerContactFromEditForm({
    dealerId: DEALER,
    name: "Обновлённый",
    phone: "+7 (999) 999-99-99",
    email: "new2@test.ru",
    comment: "новое",
    profile: PROFILE,
  });
  assert.equal(okPatch, true);
  const patchCall = fetchCalls.find((c) => c.url.includes("/patch"));
  assert.ok(patchCall);
  const patchBody = patchCall!.body as Record<string, unknown>;
  assert.equal(patchBody.id, "contact-primary-1");
  assert.equal(patchBody.fullName, "Обновлённый");
  assert.equal(patchBody.role, undefined);
  assert.equal(patchBody.whatsapp, undefined);
  assert.equal(patchBody.telegram, undefined);

  globalThis.fetch = originalFetch;
  console.log("dealer-edit-contact-sync.test.ts: OK");
}

runTests().catch((e) => {
  globalThis.fetch = originalFetch;
  console.error(e);
  process.exit(1);
});
