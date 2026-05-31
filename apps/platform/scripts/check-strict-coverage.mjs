#!/usr/bin/env node
/**
 * CI guard: UI-файлы с редактированием overrides-полей должны вызывать saveDealerField/saveTradePointField (Промт 113.3).
 */

import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..", "client", "src");

const SAVER_MARKERS =
  /saveDealerField|saveDealerFields|saveTradePointField|saveTradePointFields|saveDealerTrainingField|saveTradePointTrainingField|saveManualDealerToDb|upsertDealerOverrideStrict|upsertTradePointOverrideStrict/;

const RULES = [
  {
    files: [
      "components/client-base-actualization-dealer-forms.tsx",
      "pages/dealer-card-foundation.tsx",
    ],
    triggers: [/passportCategoryTier/, /client_category/, /clientCategory/],
    label: "категория клиента / client_category",
  },
  {
    files: [
      "components/trade-point-manual-actualization-view.tsx",
      "components/dealer-trade-points-section.tsx",
    ],
    triggers: [/tpComment/, /"comment"/, /fields\.comment/, /editComment/],
    label: "комментарий торговой точки",
  },
  {
    files: ["components/client-base-actualization-dealer-forms.tsx"],
    triggers: [/persistAll/, /dealerName|fields\.name/],
    label: "данные дилера (persistAll)",
  },
  {
    files: ["components/trade-point-manual-actualization-view.tsx"],
    triggers: [/persistMain/],
    label: "основные поля ТТ (persistMain)",
  },
];

const hits = [];

for (const rule of RULES) {
  for (const rel of rule.files) {
    const path = join(ROOT, rel);
    try {
      statSync(path);
    } catch {
      continue;
    }
    const text = readFileSync(path, "utf8");
    const triggered = rule.triggers.some((t) => t.test(text));
    if (!triggered) continue;
    if (!SAVER_MARKERS.test(text)) {
      hits.push({
        file: rel,
        message: `Найдено поле «${rule.label}», но нет saveDealerField/saveTradePointField/*Strict. Подключи strict-канал.`,
      });
    }
  }
}

if (hits.length > 0) {
  console.error("Overrides strict coverage gaps:\n");
  for (const h of hits) {
    console.error(`  ${h.file}: ${h.message}`);
  }
  process.exit(1);
}

console.log("✓ overrides strict coverage OK for watched UI files");
