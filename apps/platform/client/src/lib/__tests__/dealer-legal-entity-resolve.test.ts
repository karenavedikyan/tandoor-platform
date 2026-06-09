import assert from "node:assert/strict";
import {
  isLegalEntityServerUuid,
  normalizeLegalEntityInn,
  resolveServerLegalEntityIdFromList,
  type DealerLegalEntity,
} from "../dealer-legal-entities";

const UUID_A = "8b2d51d7-284a-4ee2-87ad-6d809c3488f1";
const UUID_B = "af644479-b448-4ddb-a2a7-b92ce692bc80";

const serverEntities: DealerLegalEntity[] = [
  {
    id: UUID_A,
    name: "ООО Альфа",
    inn: "7701234567",
    status: "additional",
    createdAt: "",
    updatedAt: "",
    updatedBy: "",
    updatedByName: "",
  },
  {
    id: UUID_B,
    name: "ИП Бета",
    inn: "5001002030",
    status: "additional",
    createdAt: "",
    updatedAt: "",
    updatedBy: "",
    updatedByName: "",
  },
];

assert.equal(isLegalEntityServerUuid(UUID_A), true);
assert.equal(isLegalEntityServerUuid("manual-legal-entity-20260101-abc"), false);
assert.equal(normalizeLegalEntityInn("77 01-234 567"), "7701234567");

assert.equal(
  resolveServerLegalEntityIdFromList({ id: UUID_A, name: "ООО Альфа", inn: "7701234567" }, serverEntities),
  UUID_A,
);

assert.equal(
  resolveServerLegalEntityIdFromList(
    { id: "manual-legal-entity-1", name: "ООО Альфа", inn: "7701234567" },
    serverEntities,
  ),
  UUID_A,
);

assert.equal(
  resolveServerLegalEntityIdFromList(
    { id: "passport:client-le-0", name: "ИП Бета", inn: undefined },
    serverEntities,
  ),
  UUID_B,
);

assert.equal(
  resolveServerLegalEntityIdFromList(
    { id: "le-client-123", name: "Неизвестное юрлицо", inn: "9999999999" },
    serverEntities,
  ),
  null,
);

console.log("dealer-legal-entity-resolve.test.ts: ok");
