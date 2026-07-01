import assert from "node:assert/strict";
import {
  buildNormalizedDealerScopeSet,
  clientIdMatchesNormalizedScope,
  filterManagerDetailByRopViewerScope,
  shouldIntersectManagerDetailWithRopViewerScope,
} from "../trade-points-manager-detail-scope.js";

type Client = { id: string; fullName: string };
type Tp = { id: string; clientId: string; name: string };

function client(id: string): Client {
  return { id, fullName: id };
}

function tp(id: string, clientId: string): Tp {
  return { id, clientId, name: id };
}

// normalize: client-ma0002241 ↔ MA0002241
{
  const scope = buildNormalizedDealerScopeSet(["client-ma0002241", "client-ma0001001"]);
  assert.equal(clientIdMatchesNormalizedScope("client-ma0002241", scope), true);
  assert.equal(clientIdMatchesNormalizedScope("MA0002241", scope), true);
  assert.equal(clientIdMatchesNormalizedScope("client-ma0009999", scope), false);
}

// ROP viewer: manager {A,B,C}, zone {A,B} → only {A,B}
{
  const clientsById = new Map<string, Client>([
    ["client-ma-a", client("client-ma-a")],
    ["client-ma-b", client("client-ma-b")],
    ["client-ma-c", client("client-ma-c")],
  ]);
  const tradePoints = [
    tp("tp-a1", "client-ma-a"),
    tp("tp-b1", "client-ma-b"),
    tp("tp-c1", "client-ma-c"),
  ];
  const filtered = filterManagerDetailByRopViewerScope({
    clientsById,
    tradePoints,
    viewerScopeExternalKeys: ["client-ma-a", "client-ma-b"],
  });
  assert.deepEqual(Array.from(filtered.clientsById.keys()).sort(), ["client-ma-a", "client-ma-b"]);
  assert.deepEqual(filtered.tradePoints.map((r) => r.id).sort(), ["tp-a1", "tp-b1"]);
}

// empty ROP scope → empty lists (no leak)
{
  const clientsById = new Map<string, Client>([["client-ma-a", client("client-ma-a")]]);
  const filtered = filterManagerDetailByRopViewerScope({
    clientsById,
    tradePoints: [tp("tp-a1", "client-ma-a")],
    viewerScopeExternalKeys: [],
  });
  assert.equal(filtered.clientsById.size, 0);
  assert.equal(filtered.tradePoints.length, 0);
}

// only ROP viewer gets intersection; admin/director/manager-self see full list (filter not applied)
{
  const mgr = "mgr-uuid";
  const rop = "rop-uuid";
  assert.equal(shouldIntersectManagerDetailWithRopViewerScope("rop", rop, mgr), true);
  assert.equal(shouldIntersectManagerDetailWithRopViewerScope("admin", rop, mgr), false);
  assert.equal(shouldIntersectManagerDetailWithRopViewerScope("director", rop, mgr), false);
  assert.equal(shouldIntersectManagerDetailWithRopViewerScope("manager", mgr, mgr), false);
  assert.equal(shouldIntersectManagerDetailWithRopViewerScope("rop", rop, rop), false);
}

// full manager list when scope covers all clients (ROP with wide zone)
{
  const clientsById = new Map<string, Client>([
    ["client-ma-a", client("client-ma-a")],
    ["client-ma-b", client("client-ma-b")],
    ["client-ma-c", client("client-ma-c")],
  ]);
  const tradePoints = [
    tp("tp-a1", "client-ma-a"),
    tp("tp-b1", "client-ma-b"),
    tp("tp-c1", "client-ma-c"),
  ];
  const filtered = filterManagerDetailByRopViewerScope({
    clientsById,
    tradePoints,
    viewerScopeExternalKeys: ["client-ma-a", "client-ma-b", "client-ma-c"],
  });
  assert.equal(filtered.clientsById.size, 3);
  assert.equal(filtered.tradePoints.length, 3);
}

console.log("trade-points-manager-detail-rop-scope: ok");
