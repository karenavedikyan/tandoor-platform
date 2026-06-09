/**
 * Логические родители маршрутов и хлебные крошки (Промт 249).
 */

export type BreadcrumbItem = { label: string; href?: string };

export type RouteHierarchyLabels = {
  dealer?: string;
  tradePoint?: string;
  assignment?: string;
  order?: string;
  manager?: string;
  rop?: string;
  ropHref?: string;
  city?: string;
  article?: string;
  program?: string;
  brief?: string;
  admin?: string;
  product?: string;
};

const ADMIN_LABELS: Record<string, string> = {
  users: "Пользователи",
  invitations: "Приглашения",
  audit: "Журнал событий",
  "client-assignments": "Назначения клиентов",
  migration: "Миграции",
  "migrate-marketing-briefs": "Миграция брифов",
  "migrate-dealer-tp": "Миграция ТТ",
  "migrate-catalog-1c": "Миграция каталога 1С",
  migrate: "Миграция каталога 1С",
  "sync-health": "Синхронизация",
  "tp-count-diag": "Диагностика ТТ",
  "counts-diag": "Диагностика счётчиков",
  actualization: "Актуализация",
};

const SALES_CONTROL_LABELS: Record<string, string> = {
  director: "Директор",
  "team-lead": "РОП",
  manager: "Менеджер",
  plans: "Планы",
  performance: "Показатели",
  "plan-fact": "План-факт",
};

function normalizePath(path: string): string {
  const base = path.split("?")[0]?.split("#")[0] ?? "/";
  return base === "" ? "/" : base;
}

function finalize(items: BreadcrumbItem[]): BreadcrumbItem[] {
  if (items.length === 0) return items;
  const last = items[items.length - 1]!;
  if (last.href) {
    items[items.length - 1] = { label: last.label };
  }
  return items;
}

function crumb(label: string, href?: string): BreadcrumbItem {
  return href ? { label, href } : { label };
}

export function parentRouteFor(path: string): string {
  const p = normalizePath(path);

  const dealerTp = p.match(/^\/dealers\/([^/]+)\/trade-points\/([^/]+)$/);
  if (dealerTp) return `/dealers/${dealerTp[1]}`;

  if (/^\/dealers\/[^/]+$/.test(p)) return "/dealer-base";

  if (/^\/assignment\/[^/]+$/.test(p)) return "/assignments";

  if (/^\/orders\/[^/]+$/.test(p)) return "/orders";

  if (/^\/catalog\/1c\/[^/]+$/.test(p)) return "/catalog";
  if (/^\/catalog\/[^/]+$/.test(p)) return "/catalog";

  if (/^\/marketing-briefs\/view\/[^/]+$/.test(p)) return "/marketing-briefs";
  if (/^\/marketing-briefs\/[^/]+$/.test(p)) return "/marketing-briefs";

  if (/^\/training\/programs\/[^/]+$/.test(p)) return "/training";
  if (/^\/training\/[^/]+$/.test(p)) return "/training";

  if (p === "/distribution/matrix-catalog") return "/distribution";

  if (/^\/dealer-base\/manager\/[^/]+$/.test(p)) return "/dealer-base";
  if (/^\/dealer-base\/city\/[^/]+$/.test(p)) return "/dealer-base";

  if (/^\/main\/rop\/[^/]+$/.test(p)) return "/main";
  if (/^\/main\/manager\/[^/]+$/.test(p)) return "/main";

  if (/^\/sales-control\/[^/]+$/.test(p) && p !== "/sales-control") return "/sales-control";

  if (/^\/admin\//.test(p)) return "/";

  if (p === "/profile/change-password") return "/profile";

  if (p === "/release-one/clients") return "/release-one";

  const topLevel = new Set([
    "/dealer-base",
    "/trade-points",
    "/assignments",
    "/catalog",
    "/distribution",
    "/orders",
    "/marketing-briefs",
    "/training",
    "/sales-control",
    "/profile",
    "/communications",
    "/client-base-activity",
    "/trash",
    "/analytics",
    "/listings",
    "/client-map",
    "/territory-card",
    "/main",
    "/tasks",
    "/release-one",
    "/analytics-workspace",
    "/users",
    "/reset-requests",
  ]);
  if (topLevel.has(p)) return "/";

  return "/";
}

export function breadcrumbsFor(path: string, labels: RouteHierarchyLabels = {}): BreadcrumbItem[] {
  const p = normalizePath(path);
  const items: BreadcrumbItem[] = [crumb("Главная", "/")];

  if (p === "/") {
    return [crumb("Главная")];
  }

  const seg = p.split("/").filter(Boolean);

  if (seg[0] === "dealer-base") {
    items.push(crumb("Клиентская база", "/dealer-base"));
    if (seg[1] === "manager" && seg[2]) {
      items.push(crumb(labels.manager ?? "Менеджер"));
      return finalize(items);
    }
    if (seg[1] === "city" && seg[2]) {
      items.push(crumb(labels.city ?? decodeURIComponent(seg[2])));
      return finalize(items);
    }
    items[items.length - 1] = crumb("Клиентская база");
    return items;
  }

  if (seg[0] === "dealers" && seg[1]) {
    items.push(crumb("Клиентская база", "/dealer-base"));
    if (seg[2] === "trade-points" && seg[3]) {
      items.push(crumb(labels.dealer ?? "Клиент", `/dealers/${seg[1]}`));
      items.push(crumb(labels.tradePoint ?? "Торговая точка"));
      return finalize(items);
    }
    items.push(crumb(labels.dealer ?? "Клиент"));
    return finalize(items);
  }

  if (seg[0] === "trade-points") {
    items.push(crumb("Торговые точки"));
    return finalize(items);
  }

  if (seg[0] === "assignments") {
    items.push(crumb("Задачи"));
    return finalize(items);
  }

  if (seg[0] === "assignment" && seg[1]) {
    items.push(crumb("Задачи", "/assignments"));
    items.push(crumb(labels.assignment ?? "Задание"));
    return finalize(items);
  }

  if (seg[0] === "orders") {
    if (seg[1]) {
      items.push(crumb("Заказы", "/orders"));
      items.push(crumb(labels.order ?? `Заказ ${seg[1]}`));
      return finalize(items);
    }
    items.push(crumb("Заказы"));
    return finalize(items);
  }

  if (seg[0] === "catalog") {
    items.push(crumb("Каталог", "/catalog"));
    if (seg[1] === "1c" && seg[2]) {
      items.push(crumb(labels.product ?? "Товар 1С"));
      return finalize(items);
    }
    if (seg[1]) {
      items.push(crumb(labels.product ?? "Товар"));
      return finalize(items);
    }
    items[items.length - 1] = crumb("Каталог");
    return items;
  }

  if (seg[0] === "distribution") {
    items.push(crumb("Дистрибуция", "/distribution"));
    if (seg[1] === "matrix-catalog") {
      items.push(crumb("Каталог матрицы"));
      return finalize(items);
    }
    items[items.length - 1] = crumb("Дистрибуция");
    return items;
  }

  if (seg[0] === "marketing-briefs") {
    items.push(crumb("Маркетинговые брифы", "/marketing-briefs"));
    if (seg[1] === "view" && seg[2]) {
      items.push(crumb(labels.brief ?? "Просмотр брифа"));
      return finalize(items);
    }
    if (seg[1]) {
      items.push(crumb(labels.brief ?? "Бриф"));
      return finalize(items);
    }
    items[items.length - 1] = crumb("Маркетинговые брифы");
    return items;
  }

  if (seg[0] === "training") {
    items.push(crumb("Обучение", "/training"));
    if (seg[1] === "programs" && seg[2]) {
      items.push(crumb(labels.program ?? "Программа"));
      return finalize(items);
    }
    if (seg[1]) {
      items.push(crumb(labels.article ?? "Материал"));
      return finalize(items);
    }
    items[items.length - 1] = crumb("Обучение");
    return items;
  }

  if (seg[0] === "sales-control") {
    items.push(crumb("План-факт", "/sales-control"));
    if (seg[1]) {
      items.push(crumb(SALES_CONTROL_LABELS[seg[1]] ?? seg[1]));
      return finalize(items);
    }
    items[items.length - 1] = crumb("План-факт");
    return items;
  }

  if (seg[0] === "main") {
    if (seg[1] === "rop" && seg[2]) {
      items.push(crumb(labels.rop ?? "РОП"));
      return finalize(items);
    }
    if (seg[1] === "manager" && seg[2]) {
      if (labels.rop && labels.ropHref) {
        items.push(crumb(labels.rop, labels.ropHref));
      }
      items.push(crumb(labels.manager ?? "Менеджер"));
      return finalize(items);
    }
    items[items.length - 1] = crumb("Главная");
    return items;
  }

  if (seg[0] === "admin") {
    items.push(crumb("Администрирование"));
    const section = seg[1] === "actualization" ? seg[2] ?? seg[1] : seg[1];
    if (section) {
      const label =
        labels.admin ??
        ADMIN_LABELS[section] ??
        (seg[1] === "actualization" ? "Дедупликация" : section);
      items.push(crumb(label));
    }
    return finalize(items);
  }

  if (seg[0] === "profile") {
    items.push(crumb("Профиль", "/profile"));
    if (seg[1] === "change-password") {
      items.push(crumb("Смена пароля"));
      return finalize(items);
    }
    items[items.length - 1] = crumb("Профиль");
    return items;
  }

  const topLabels: Record<string, string> = {
    communications: "Коммуникации",
    "client-base-activity": "Активность базы",
    trash: "Корзина",
    analytics: "Аналитика",
    listings: "Листинги",
    "client-map": "Карта клиентов",
    "territory-card": "Территория",
    tasks: "Задачи",
    "release-one": "Релиз 1",
    "analytics-workspace": "Аналитика",
    users: "Пользователи и доступ",
    "reset-requests": "Запросы сброса",
  };

  const top = seg[0] ?? "";
  if (topLabels[top]) {
    items.push(crumb(topLabels[top]));
    return finalize(items);
  }

  if (seg.length > 0) {
    items.push(crumb(seg[seg.length - 1]!));
  }

  return finalize(items);
}
