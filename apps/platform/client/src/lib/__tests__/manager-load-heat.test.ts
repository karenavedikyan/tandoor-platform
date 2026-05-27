import assert from "node:assert/strict";
import { computeManagerHeatMap, managerLoadScore, sortManagersByHeat } from "../manager-load-heat";

function entry(id: string, clients: number, tps: number) {
  return { id, clientsActive: clients, tradePointsActive: tps };
}

{
  const one = computeManagerHeatMap([entry("a", 10, 5)]);
  assert.equal(one.a, "medium");
}

{
  const two = computeManagerHeatMap([entry("a", 20, 0), entry("b", 1, 0)]);
  assert.equal(two.a, "high");
  assert.equal(two.b, "low");
}

{
  const nine = computeManagerHeatMap(
    [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => entry(`m${n}`, n, 0)),
  );
  assert.equal(nine.m9, "high");
  assert.equal(nine.m8, "high");
  assert.equal(nine.m7, "high");
  assert.equal(nine.m1, "low");
  assert.equal(nine.m2, "low");
  assert.equal(nine.m3, "low");
}

{
  const managers = [
    { id: "z", fullName: "Яков" },
    { id: "a", fullName: "Анна" },
    { id: "m", fullName: "Борис" },
  ];
  const entries = [entry("a", 30, 0), entry("m", 20, 0), entry("z", 10, 0)];
  const heat = computeManagerHeatMap(entries);
  const sorted = sortManagersByHeat(managers, heat, entries);
  assert.deepEqual(
    sorted.map((x) => x.id),
    ["a", "m", "z"],
  );
  assert.equal(managerLoadScore(entry("a", 2, 3)), 5);
}

console.log("manager-load-heat: ok");
