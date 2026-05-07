/**
 * Локальные обезличенные материалы раздела «Обучение / База знаний».
 * Структура отражает потоки корпоративной Wiki; импорт и URL закрытой Wiki не используются.
 */

import { getAllMatrixTasks, type TaskInsightDomain } from "./trade-point-task-data";
import { getProductById } from "./catalog-data";
import { getWikiImportedTrainingMaterials, pickWikiMaterialIdForTaskInsight } from "./training-wiki-import";
import { WAVE1_TRAINING_WIKI_ANNOTATIONS } from "./training-wave1-publish";

export type TrainingSection =
  | "product"
  | "sales"
  | "onboarding"
  | "regulations"
  | "development";

export type TrainingAudience =
  | "employees"
  | "dealers"
  | "managers"
  | "regional_managers"
  | "purchasing"
  | "all";

export type TrainingMaterialType =
  | "article"
  | "course"
  | "script"
  | "comparison"
  | "regulation"
  | "faq"
  | "video";

export type TrainingMaterialStatus = "required" | "recommended" | "new" | "updated";

/** Ключ раздела базы знаний (совпадает с разделом материала). */
export type TrainingSectionKey = TrainingSection;

/** Роль получателя в учебном центре. */
export type TrainingRole = "manager" | "regional_manager" | "leadership" | "new_hire";

export type TrainingProgramLevel = "basic" | "advanced" | "expert";

export type TrainingProgramStatus = "not_started" | "in_progress" | "completed" | "overdue";

export type TrainingProgressStatus = "not_started" | "in_progress" | "completed";

export const TRAINING_PROGRESS_STATUS_LABEL: Record<TrainingProgressStatus, string> = {
  not_started: "Не начато",
  in_progress: "В работе",
  completed: "Завершено",
};

export type RelatedTaskContext = "showcase" | "hardware" | "orders" | "dealer_card" | "territory" | "analytics";

export type TrainingProgram = {
  id: string;
  title: string;
  description: string;
  section: TrainingSectionKey;
  role: TrainingRole;
  level: TrainingProgramLevel;
  durationMinutes: number;
  required: boolean;
  progressPercent: number;
  completedMaterials: number;
  totalMaterials: number;
  status: TrainingProgramStatus;
  materialIds: string[];
  relatedProductCategory: "mk" | "vh" | "hardware" | "all" | null;
  coverTone: "lime" | "slate" | "sky" | "amber" | "violet";
};

export type TrainingModule = {
  id: string;
  programId: string;
  title: string;
  order: number;
  materialIds: string[];
};

export type TrainingProgress = {
  monthProgressPercent: number;
  requiredCompleted: number;
  requiredTotal: number;
  inProgressCount: number;
  attentionCount: number;
};

export type TrainingAssignment = {
  id: string;
  materialId: string;
  title: string;
  priority: "high" | "medium" | "low";
  dueDate: string;
  status: TrainingProgressStatus;
};

export type TrainingMaterialDifficulty = "easy" | "medium" | "hard";

export type TrainingSourceType = "manual" | "wiki";

export type TrainingWikiReviewStatus = "needs_review" | "approved" | "archived";

export interface TrainingWikiSource {
  sourceType: "wiki";
  wikiPageId?: number;
  wikiTitle: string;
  wikiImportedAt: string;
  wikiReviewStatus: TrainingWikiReviewStatus;
  wikiSectionGuess: TrainingSectionKey | "other";
  wikiCharCount: number;
}

export type TrainingMaterial = {
  id: string;
  title: string;
  section: TrainingSection;
  type: TrainingMaterialType;
  audience: TrainingAudience[];
  status: TrainingMaterialStatus;
  description: string;
  readTimeMinutes: number;
  progressPercent: number;
  relatedProductIds: string[];
  relatedTaskIds: string[];
  tags: string[];
  updatedAt: string;
  contentBlocks: Array<{
    heading: string;
    body: string;
  }>;
  programIds: string[];
  durationMinutes: number;
  difficulty: TrainingMaterialDifficulty;
  required: boolean;
  progressStatus: TrainingProgressStatus;
  knowledgeTags: string[];
  relatedTaskContext: RelatedTaskContext[];
  checklist: string[];
  summaryBullets: string[];
  sourceType?: TrainingSourceType;
  wikiSource?: TrainingWikiSource;
  originalTitle?: string;
  reviewStatus?: TrainingWikiReviewStatus;
  /** Линейка каталога для привязки Wiki-материала к карточке товара. */
  wikiCatalogLine?: "mk" | "vh" | "hardware" | "all";
};

const block = (heading: string, body: string) => ({ heading, body });

export const TRAINING_ROLE_LABEL: Record<TrainingRole, string> = {
  manager: "Менеджер",
  regional_manager: "Региональный менеджер",
  leadership: "Руководитель",
  new_hire: "Новый сотрудник",
};

export const TRAINING_PROGRAMS: TrainingProgram[] = [
  {
    id: "prog-product-lines",
    title: "Продуктовая база: двери в диалоге",
    description: "Линейки МК и ВХ, материалы полотна и фурнитура — единый цикл для консультации.",
    section: "product",
    role: "manager",
    level: "basic",
    durationMinutes: 145,
    required: true,
    progressPercent: 38,
    completedMaterials: 2,
    totalMaterials: 10,
    status: "in_progress",
    materialIds: [
      "tr-prod-mk-assortment",
      "tr-sales-consult-prep",
      "tr-prod-ent-card",
      "tr-prod-int-coatings",
      "tr-prod-mk-lines-diff",
      "tr-prod-vh-sales-pack",
      "tr-prod-vh-locks-guide",
      "tr-prod-materials-mdf",
      "tr-prod-hw-groups",
      "tr-prod-metal-qr",
    ],
    relatedProductCategory: "mk",
    coverTone: "lime",
  },
  {
    id: "prog-sales-hits",
    title: "Техника продаж: ключевые сценарии",
    description: "Возражения, звонки, сравнение моделей и оптовый контекст.",
    section: "sales",
    role: "manager",
    level: "basic",
    durationMinutes: 68,
    required: true,
    progressPercent: 22,
    completedMaterials: 1,
    totalMaterials: 5,
    status: "in_progress",
    materialIds: ["tr-sales-consult-prep", "tr-sales-expensive", "tr-sales-call", "tr-sales-wholesale", "tr-sales-compare-models"],
    relatedProductCategory: "all",
    coverTone: "sky",
  },
  {
    id: "prog-adapt-2026",
    title: "Адаптация и первые шаги",
    description: "Онбординг для новых сотрудников и базовые курсы каналов.",
    section: "onboarding",
    role: "new_hire",
    level: "basic",
    durationMinutes: 120,
    required: true,
    progressPercent: 8,
    completedMaterials: 0,
    totalMaterials: 3,
    status: "in_progress",
    materialIds: ["tr-onboard-manager", "tr-onboard-wholesale-staff", "tr-onboard-retail-staff"],
    relatedProductCategory: null,
    coverTone: "amber",
  },
  {
    id: "prog-regional-control",
    title: "Регламенты и контроль качества",
    description: "Рекламации, сервис и закупки — для регионального контура.",
    section: "regulations",
    role: "regional_manager",
    level: "advanced",
    durationMinutes: 45,
    required: false,
    progressPercent: 72,
    completedMaterials: 2,
    totalMaterials: 3,
    status: "in_progress",
    materialIds: ["tr-reg-claims", "tr-reg-service", "tr-reg-purchasing"],
    relatedProductCategory: "hardware",
    coverTone: "slate",
  },
];

export const TRAINING_MODULES: TrainingModule[] = [
  {
    id: "mod-pl-intro",
    programId: "prog-product-lines",
    title: "Ассортимент МК и ВХ, покрытия",
    order: 1,
    materialIds: ["tr-prod-mk-assortment", "tr-sales-consult-prep", "tr-prod-ent-card", "tr-prod-int-coatings"],
  },
  {
    id: "mod-pl-deep",
    programId: "prog-product-lines",
    title: "Линейки, материалы, фурнитура и ВХ",
    order: 2,
    materialIds: [
      "tr-prod-mk-lines-diff",
      "tr-prod-materials-mdf",
      "tr-prod-vh-sales-pack",
      "tr-prod-vh-locks-guide",
      "tr-prod-hw-groups",
      "tr-prod-metal-qr",
    ],
  },
  {
    id: "mod-sl-core",
    programId: "prog-sales-hits",
    title: "Подготовка к визиту и скрипты",
    order: 1,
    materialIds: ["tr-sales-consult-prep", "tr-sales-expensive", "tr-sales-call", "tr-sales-wholesale"],
  },
  { id: "mod-sl-adv", programId: "prog-sales-hits", title: "Сравнение и видео", order: 2, materialIds: ["tr-sales-compare-models"] },
  { id: "mod-ad-weeks", programId: "prog-adapt-2026", title: "Две недели старта", order: 1, materialIds: ["tr-onboard-manager", "tr-onboard-wholesale-staff", "tr-onboard-retail-staff"] },
  { id: "mod-rg-set", programId: "prog-regional-control", title: "Регламенты сервиса", order: 1, materialIds: ["tr-reg-claims", "tr-reg-service", "tr-reg-purchasing"] },
];

export const TRAINING_ASSIGNMENTS: TrainingAssignment[] = [
  { id: "asn-claims", materialId: "tr-reg-claims", title: "Завершить блок «Рекламации»", priority: "high", dueDate: "12.05.2026", status: "in_progress" },
  { id: "asn-expensive", materialId: "tr-sales-expensive", title: "Повторить скрипт возражения «дорого»", priority: "high", dueDate: "15.05.2026", status: "in_progress" },
  { id: "asn-vh-card", materialId: "tr-prod-ent-card", title: "Изучить карточку входной группы", priority: "medium", dueDate: "20.05.2026", status: "not_started" },
  { id: "asn-hw", materialId: "tr-prod-hw-groups", title: "Фурнитура: группы и аргументы", priority: "medium", dueDate: "22.05.2026", status: "not_started" },
  { id: "asn-mk-base", materialId: "tr-prod-mk-assortment", title: "Пройти базу по межкомнатным дверям", priority: "high", dueDate: "18.05.2026", status: "not_started" },
  { id: "asn-onboard", materialId: "tr-onboard-manager", title: "Модуль адаптации менеджера", priority: "low", dueDate: "28.05.2026", status: "in_progress" },
];

type LegacyTrainingMaterial = Omit<
  TrainingMaterial,
  | "programIds"
  | "durationMinutes"
  | "difficulty"
  | "required"
  | "progressStatus"
  | "knowledgeTags"
  | "relatedTaskContext"
  | "checklist"
  | "summaryBullets"
  | "sourceType"
  | "wikiSource"
  | "originalTitle"
  | "reviewStatus"
  | "wikiCatalogLine"
> & {
  checklist?: string[];
  summaryBullets?: string[];
};

export const TRAINING_PROGRAM_LEVEL_LABEL: Record<TrainingProgramLevel, string> = {
  basic: "Базовый",
  advanced: "Продвинутый",
  expert: "Экспертный",
};

export const TRAINING_SECTION_LABEL: Record<TrainingSection, string> = {
  product: "Продукт",
  sales: "Техника продаж",
  onboarding: "Онбординг",
  regulations: "Регламенты",
  development: "Развитие",
};

export const TRAINING_TYPE_LABEL: Record<TrainingMaterialType, string> = {
  article: "Статья",
  course: "Курс",
  script: "Скрипт",
  comparison: "Сравнение",
  regulation: "Регламент",
  faq: "FAQ",
  video: "Видео",
};

export const TRAINING_STATUS_LABEL: Record<TrainingMaterialStatus, string> = {
  required: "Обязательно",
  recommended: "Рекомендовано",
  new: "Новое",
  updated: "Обновлено",
};

export const TRAINING_AUDIENCE_LABEL: Record<TrainingAudience, string> = {
  employees: "Сотрудники",
  dealers: "Дилеры",
  managers: "Менеджеры",
  regional_managers: "Региональные менеджеры",
  purchasing: "Закупки",
  all: "Все роли",
};

export const TRAINING_WIKI_REVIEW_LABEL: Record<TrainingWikiReviewStatus, string> = {
  needs_review: "На проверке",
  approved: "Проверено",
  archived: "В архиве",
};

const _RAW_MATERIALS: LegacyTrainingMaterial[] = [
  {
    id: "tr-prod-mk-assortment",
    title: "Межкомнатные двери Tandoor: ассортимент и логика подбора",
    section: "product",
    type: "article",
    audience: ["managers", "dealers", "employees"],
    status: "required",
    description:
      "Как устроены серии и комплектации МК, что спросить у клиента до замера и какие ошибки чаще всего ломают сделку.",
    readTimeMinutes: 18,
    progressPercent: 0,
    relatedProductIds: ["mk-grand-3-mk", "mk-kapelli", "mk-grand-5"],
    relatedTaskIds: [],
    tags: ["МК", "ассортимент", "подбор"],
    updatedAt: "06.05.2026",
    summaryBullets: [
      "МК в ассортименте бренда — это серии с разной глубиной отделки, набором типоразмеров и вариантами остекления.",
      "Первый шаг консультанта — понять проём, сторону открывания, требования к звуку и стиль интерьера.",
      "Комплект (полотно + короб + наличники + фурнитура) продаётся связкой: так меньше риска несовместимости и возвратов.",
      "Типовые ошибки: подбор только по фото, игнорирование влажности помещения и отсутствие фиксации пожеланий по фурнитуре.",
    ],
    checklist: [
      "Уточнил тип проёма, толщину стены и наличие демонтажа старой коробки.",
      "Сверил серию и покрытие с витриной или актуальной выкладкой партнёра.",
      "Зафиксировал открывание, цвет фурнитуры и необходимость доборов.",
      "Объяснил клиенту сроки изготовления и условия замера без обещаний «на вчера».",
      "Передал в заказ понятное ТЗ: модель, размер проёма, комплектация.",
    ],
    contentBlocks: [
      block(
        "Что входит в «межкомнатную дверь» для клиента",
        "Для покупателя дверь — это цельный образ: полотно, короб, наличники, петли, ручка, иногда доборы и порог. Для менеджера важно говорить на одном языке с монтажником: отдельно полотно, отдельно короб, отдельно фурнитура и доборная система. На витрине показывайте готовый узел и проговаривайте, что входит в базовую комплектацию серии, а что докупается.",
      ),
      block(
        "Серии и уровни отделки",
        "Серии отличаются конструкцией полотна, доступными покрытиями, фрезеровкой и совместимостью с доборами. В разговоре не перегружайте клиента внутренними кодами: используйте короткие сравнения «спокойный минимализм / выразительная фрезеровка / скрытая установка». Если клиент сравнивает две серии, сведите отличия к трём пунктам: внешний вид, эксплуатация (влага, уборка), бюджет комплекта.",
      ),
      block(
        "Вопросы до подбора",
        "Где установка (жилая комната, ванная зона, детская)? Нужна ли повышенная звукоизоляция? Есть ли плинтус и напольное покрытие, с которыми должны сойтись наличники? Планируется ли врезка замка или защёлки? Ответы помогают не предложить красивое, но неподходящее решение.",
      ),
      block(
        "Типовые ошибки менеджера",
        "Подбор «на глаз» без замера проёма; обещание точного срока без согласования с производством; игнорирование фурнитуры до конца визита; сравнение с конкурентом по цене без опоры на сервис и гарантию бренда. После визита кратко запишите договорённости и отправьте клиенту структурированное предложение.",
      ),
    ],
  },
  {
    id: "tr-prod-ent-card",
    title: "Входные двери: карточка модели, конструкция и вопросы клиенту",
    section: "product",
    type: "article",
    audience: ["managers", "dealers", "employees"],
    status: "required",
    description:
      "Как читать карточку входной двери: назначение серии, заполнение, замки и складская программа — чтобы не ошибиться в заказе.",
    readTimeMinutes: 16,
    progressPercent: 0,
    relatedProductIds: ["vh-grand-3", "vh-grand-4", "vh-kapelli"],
    relatedTaskIds: [],
    tags: ["ВХ", "карточка", "склад"],
    updatedAt: "06.05.2026",
    summaryBullets: [
      "Карточка модели ВХ объединяет конструкцию полотна, заполнение, покрытие, варианты замков и типовые размеры.",
      "Складская программа означает ограниченный перечень готовых размеров и комплектаций — важно заранее сверить наличие и срок.",
      "Перед подбором выясните сторону открывания, уровень безопасности и условия эксплуатации (улица, тамбур, квартира).",
    ],
    checklist: [
      "Нашёл в карточке серию, тип заполнения, класс взломостойкости (если указан) и доступные размеры.",
      "Проверил совместимость выбранного замка и фурнитуры с полотном.",
      "Уточнил у клиента: улица или тамбур, нужен ли терморазрыв или порог.",
      "Согласовал способ доставки и монтаж с партнёром, без лишних обещаний по срокам.",
    ],
    contentBlocks: [
      block(
        "Зачем менеджеру карточка модели",
        "Карточка — единая точка правды по конструкции: что входит в базу, какие опции доступны, какие размеры не делают. На встрече открывайте её вместе с клиентом и проговаривайте каждый блок простыми словами. Так снижается риск заказа «не той» фурнитуры или неподходящего добора.",
      ),
      block(
        "Конструкция и базовые характеристики",
        "Обычно в карточке видно наружную и внутреннюю отделку, тип заполнения полотна, толщину металла, наличие стекла или вставок. Объясняйте клиенту связку «безопасность — вес — удобство эксплуатации»: тяжёлое полотно требует качественного монтажа и правильных петель. Если клиент спрашивает про «утепление», опирайтесь на заявленные в карточке свойства серии, без домыслов.",
      ),
      block(
        "Складская программа",
        "Если позиция в складской программе, заранее согласуйте с партнёром остатки и ближайшее пополнение. Клиенту честно скажите: выбор ограничен готовыми типоразмерами, зато срок обычно короче, чем у изделия под индивидуальный заказ. Зафиксируйте выбранный артикул и комплектацию замка в письменном виде.",
      ),
      block(
        "Аргументы для продажи входной двери",
        "Акцент на спокойствии семьи, долговечности покрытия, сервисе бренда и понятной гарантии. Сравнивайте с «самодельными» решениями через истории эксплуатации, а не через агрессию к конкурентам. Завершайте визит чётким следующим шагом: замер, расчёт комплекта или выставление счёта.",
      ),
    ],
  },
  {
    id: "tr-prod-int-coatings",
    title: "Межкомнатные двери: покрытия, материалы полотна и звукоизоляция",
    section: "product",
    type: "article",
    audience: ["managers", "dealers"],
    status: "recommended",
    description:
      "Как объяснять клиенту отличия покрытий и материалов, и что сказать про звукоизоляцию без обещаний «как в студии».",
    readTimeMinutes: 17,
    progressPercent: 40,
    relatedProductIds: ["mk-grand-3-mk", "mk-kapelli", "mk-grand-4"],
    relatedTaskIds: [],
    tags: ["МК", "покрытие", "акустика"],
    updatedAt: "06.05.2026",
    summaryBullets: [
      "Покрытие отвечает за внешний вид и устойчивость к царапинам и влаге; материал полотна — за вес и жёсткость.",
      "Звукоизоляция зависит от комплекта двери, уплотнителей и качества монтажа; одна только толщина полотна редко даёт полный эффект.",
      "На витрине сравнивайте два варианта по тактильности, уходу и сочетаемости с мебелью.",
    ],
    checklist: [
      "Назвал клиенту три уровня: экономичный декор, устойчивые меламин/ПП, премиальные покрытия с акцентом на тактильность.",
      "Объяснил ограничения в влажных зонах и при интенсивной эксплуатации детской.",
      "Про звук: не обещал конкретных децибел без данных серии; предложил комплект с уплотнителями и правильной коробкой.",
    ],
    contentBlocks: [
      block(
        "Покрытия простыми словами",
        "Эмаль и глянцевые решения хорошо смотрятся в светлых интерьерах, но требуют аккуратного обращения. Декоры под дерево и матовые поверхности прощают мелкие следы эксплуатации. Главное — не смешивать в разговоре «дизайн» и «износостойкость»: покажите, как клиент будет жить с дверью через год.",
      ),
      block(
        "Материалы полотна",
        "Современные полотна часто используют комбинацию рамы и наполнителя. Клиенту важно слышать про устойчивость к перепадам влажности и вес полотна (особенно для петель и доводчика). Если в карточке указаны экологические классы или сертификации, проговаривайте их как подтверждение контроля качества, без лишней техники.",
      ),
      block(
        "Звукоизоляция",
        "Честная формула: дверь + короб с плотным прилеганием + порог или щётка + минимальные щели дают заметный эффект. Не сравнивайте межкомнатную дверь со студийной перегородкой. Если клиенту критична тишина, предложите комплект с уплотнителями и проконсультируйте по монтажной бригаде.",
      ),
    ],
  },
  {
    id: "tr-prod-mk-lines-diff",
    title: "Линейки и скрытые двери: как объяснять отличия клиенту",
    section: "product",
    type: "comparison",
    audience: ["managers", "dealers", "regional_managers"],
    status: "new",
    description:
      "Скрытая установка, интеграция со стеной и отличия линеек — без перегруза техническими деталями.",
    readTimeMinutes: 14,
    progressPercent: 0,
    relatedProductIds: ["mk-grand-5", "mk-kapelli"],
    relatedTaskIds: [],
    tags: ["МК", "линейки", "скрытая дверь"],
    updatedAt: "06.05.2026",
    summaryBullets: [
      "Скрытая дверь визуально сливается со стеной: важны подготовка проёма, аллюминиевый каркас и финишная отделка.",
      "Отличия линеек держите в голове тремя словами: дизайн, доступные покрытия, совместимость с фурнитурой и доборами.",
      "Новинки сезона подавайте через сценарий «кому подойдёт», а не через длинный список артикулов.",
    ],
    checklist: [
      "Показал клиенту образец короба/алюминиевого профиля и объяснил этапы отделки стены.",
      "Предупредил про сроки: скрытые решения требуют синхронизации с малярами и напольщиками.",
      "Сверил допустимые веса и петли с выбранной фурнитурой.",
    ],
    contentBlocks: [
      block(
        "Скрытые двери",
        "Клиенту важно понимание «как будет выглядеть в ремонте». Объясните последовательность: каркас, гипсокартон или панель, финишная покраска, фурнитура с магнитным или скрытым механизмом. Подчеркните, что ошибки на этапе проёма дорого исправляются — поэтому замер и согласование узла обязательны.",
      ),
      block(
        "Сравнение линеек в диалоге",
        "Сведите сравнение к двум-трём моделям. Для каждой назовите одну сильную сторону: например, «спокойная классика», «выразительная фрезеровка», «минимализм под скрытый монтаж». Избегайте слова «лучше» без контекста — лучше для кого: для семьи с детьми или для арендного жилья?",
      ),
    ],
  },
  {
    id: "tr-prod-vh-sales-pack",
    title: "Входные двери: аргументы для продажи и сравнение без агрессии к конкурентам",
    section: "product",
    type: "article",
    audience: ["managers", "regional_managers", "dealers"],
    status: "required",
    description:
      "Структура разговора по ВХ: безопасность, тепло и шум, сервис бренда — и нейтральные приёмы сравнения с альтернативами на рынке.",
    readTimeMinutes: 15,
    progressPercent: 0,
    relatedProductIds: ["vh-grand-3", "vh-siriys", "vh-kvarc"],
    relatedTaskIds: [],
    tags: ["ВХ", "продажи", "аргументы"],
    updatedAt: "06.05.2026",
    summaryBullets: [
      "Начинайте с потребности: улица или общий коридор, семья, ценность вещей в квартире, ожидания по теплу и шуму.",
      "Опора на конструкцию и сервис: монтаж, гарантия, доступность запчастей — сильные аргументы без обсуждения чужих брендов в негативе.",
      "Сравнительные таблицы используйте как подсказку для себя; клиенту давайте не больше трёх отличий за раз.",
    ],
    checklist: [
      "Зафиксировал сценарий эксплуатации и уровень ожидаемой безопасности.",
      "Показал в карточке отличия выбранных моделей по заполнению и фурнитуре.",
      "Не использовал недостоверные цифры и не критиковал конкурентов по слухам.",
    ],
    contentBlocks: [
      block(
        "Открытие разговора",
        "Спросите, что не устраивает в текущей двери: шум, продувает, ручка люфтит, ржавчина? Ответ задаёт тон презентации. Дальше — коротко о бренде: опыт, контроль качества, сеть партнёров. Клиент покупает спокойствие, а не только металл.",
      ),
      block(
        "Конструкция как опора продажи",
        "Полотно, заполнение, уплотнение проёма, качество фурнитуры — связка, которую нужно показать на витрине или в разрезе. Объясняйте, за что клиент платит: стабильность геометрии, коррозионная стойкость покрытия, продуманная система уплотнения.",
      ),
      block(
        "Сравнение с конкурентами",
        "Сравнивайте по проверяемым признакам: толщина металла, класс замка, комплект уплотнителей, условия гарантии. Если клиент называет другую марку, признайте сильные стороны конкурента и переведите разговор на сервис, сроки и уверенность в поставке.",
      ),
    ],
  },
  {
    id: "tr-prod-vh-locks-guide",
    title: "Замки и фурнитура входной двери: базовые группы и вопросы клиенту",
    section: "product",
    type: "article",
    audience: ["managers", "dealers", "employees"],
    status: "required",
    description:
      "Цилиндровые и сувальдные системы, дополнительные ригели, броненакладки — как предложить безопасный комплект без запугивания.",
    readTimeMinutes: 12,
    progressPercent: 0,
    relatedProductIds: ["vh-grand-4", "vh-neapol"],
    relatedTaskIds: [],
    tags: ["ВХ", "замки", "безопасность"],
    updatedAt: "06.05.2026",
    summaryBullets: [
      "Замок и цилиндр — разные задачи: замок управляет ригелями, цилиндр отвечает за секретность и удобство ключей.",
      "Допродажа второго замка или броненакладки оправдана, если клиент хранит ценности или часто отсутствует.",
      "Всегда уточняйте толщину полотна и готовность производителя к выбранной фурнитуре.",
    ],
    checklist: [
      "Объяснил отличие цилиндра от сувальдного механизма простыми словами.",
      "Предложил комплект: основной замок, цилиндр нужного класса, броненакладка при необходимости.",
      "Проверил, что выбранные изделия совместимы с полотном и не нарушают гарантию.",
    ],
    contentBlocks: [
      block(
        "Базовые категории",
        "Основной замок отвечает за запирание ригелей. Дополнительный усиливает взломостойкость или даёт отдельный контур для сувальдного ключа. Цилиндр определяет удобство эксплуатации и класс защиты. Не перегружайте клиента терминами — показывайте на двери или макете.",
      ),
      block(
        "Как продавать комплектом",
        "Аргумент: единая гарантийная логика и согласованная геометрия ригелей. Если клиент экономит на цилиндре, честно скажите, где слабое место комплекта. Предложите апгрейд как страховку спокойствия, а не как страх.",
      ),
    ],
  },
  {
    id: "tr-prod-materials-mdf",
    title: "Материалы полотна: MDF, HDF, SPC и ПЭТ — что сказать клиенту",
    section: "product",
    type: "comparison",
    audience: ["dealers", "managers"],
    status: "updated",
    description:
      "Сравнение материалов межкомнатных полотен с акцентом на ПЭТ: внешний вид, уход и ограничения.",
    readTimeMinutes: 13,
    progressPercent: 75,
    relatedProductIds: ["mk-grand-5", "mk-grand-4", "vh-neapol"],
    relatedTaskIds: [],
    tags: ["материалы", "ПЭТ", "МК"],
    updatedAt: "06.05.2026",
    summaryBullets: [
      "MDF и HDF дают стабильную основу для покрытий; разница часто в плотности и назначении серии.",
      "SPC и композитные решения — про устойчивость к влаге и механике в активных зонах.",
      "ПЭТ — популярное покрытие с выразительной текстурой; важно объяснить правила ухода без абразивов.",
    ],
    checklist: [
      "Назвал три сценария: сухие комнаты, зона повышенной влажности, детская с активными играми.",
      "Для ПЭТ отдельно проговорил уход и риск царапин от «жёсткой» пыли при неправильной чистке.",
      "Сверил рекомендации с карточкой конкретной модели.",
    ],
    contentBlocks: [
      block(
        "MDF / HDF",
        "Объясните как про основу под финиш: ровная поверхность, предсказуемое поведение при перепадах влажности в норме. HDF обычно плотнее и лучше переносит нагрузку в тонких конструкциях. Клиенту не нужны аббревиатуры — нужна уверенность, что дверь не поведёт себя «как дешёвый ДСП-лист».",
      ),
      block(
        "SPC и влажные сценарии",
        "Если серия позволяет установку во влажных зонах, опирайтесь на фабричные рекомендации. Не подменяйте инструкцию собственными выводами. Для душевых зон и санузлов лучше заранее привлечь технолога партнёра.",
      ),
      block(
        "ПЭТ на витрине",
        "Акцент на тактильность и богатство декоров. Уход — мягкие средства, без растворителей. Если клиент переживает за царапины, покажите, как ведёт себя материал на образце при лёгком воздействии, и честно назовите ограничения.",
      ),
    ],
  },
  {
    id: "tr-prod-hw-groups",
    title: "Фурнитура к дверям: группы, допродажа и чек-лист комплектации",
    section: "product",
    type: "course",
    audience: ["managers", "purchasing", "dealers"],
    status: "new",
    description:
      "Петли, ручки, защёлки, доводчики и комплекты под скрытую установку — как предлагать вместе с дверью и повышать конверсию комплекта.",
    readTimeMinutes: 22,
    progressPercent: 0,
    relatedProductIds: ["sk-line", "mk-grand-3-mk"],
    relatedTaskIds: [],
    tags: ["Фурнитура", "допродажа", "комплект"],
    updatedAt: "06.05.2026",
    summaryBullets: [
      "Фурнитура — часть безопасности и срока службы: экономия на петлях часто вылезает через провисание полотна.",
      "Комплектный заказ упрощает монтаж и гарантию: все элементы согласованы по цвету и посадочным.",
      "Конверсия растёт, если показывать фурнитуру до финала разговора о цене полотна.",
    ],
    checklist: [
      "Подобрал петли по весу полотна и типу установки (врезные, скрытые).",
      "Согласовал цвет и стиль ручек с покрытием двери.",
      "Предложил доводчик там, где дверь бьётся о стену или где дети.",
      "Зафиксировал в заказе: количество комплектов, сторону открывания, высоту ручки.",
    ],
    contentBlocks: [
      block(
        "Базовые группы",
        "Петли и навесы держат вес и обеспечивают геометрию. Ручки и защёлки отвечают за удобство каждый день. Для входных групп добавляются цилиндры, броненакладки, глазки и домофонные элементы. На МК — декоративные накладки, магнитные защёлки, интегрированные ручки.",
      ),
      block(
        "Как предлагать вместе с дверью",
        "Покажите «минимально правильный» комплект и «комфортный». Объясните разницу через эксплуатацию: меньше шума, мягкое закрывание, меньше сервисных визитов. Не начинайте с цены фурнитуры — начните с сценария использования.",
      ),
      block(
        "Конверсия комплекта",
        "Если клиент уже выбрал полотно, фурнитура — логичное продолжение. Используйте короткий чек-лист на экране или бумаге: петли, ручка, защёлка, врезка под замок, доборные элементы. Закрывайте возражение «потом купим» фразой про риск несовместимости и повторного выезда монтажника.",
      ),
    ],
  },
  {
    id: "tr-prod-metal-qr",
    title: "Металлоконструкции: QR на изделии и что рассказать клиенту",
    section: "product",
    type: "faq",
    audience: ["managers", "regional_managers"],
    status: "recommended",
    description: "Как объяснять клиенту назначение QR-кода на изделии и чем он полезен после установки.",
    readTimeMinutes: 8,
    progressPercent: 20,
    relatedProductIds: [],
    relatedTaskIds: [],
    tags: ["МК", "QR", "сервис"],
    updatedAt: "06.05.2026",
    summaryBullets: [
      "QR обычно ведёт на паспорт изделия или страницу бренда с инструкциями — без необходимости хранить бумажки.",
      "Используйте QR как сигнал заботы о сервисе и подлинности продукции.",
    ],
    contentBlocks: [
      block(
        "Сценарий разговора",
        "Скажите клиенту: код нужен, чтобы быстро найти инструкцию по уходу, рекомендации по регулировке или контакты сервиса. Не обещайте функций, которых нет в официальном описании серии. Если код не сканируется, фиксируйте обращение через партнёра.",
      ),
    ],
  },
  {
    id: "tr-sales-consult-prep",
    title: "Консультация по модели: подготовка за 10 минут и разбор карточки товара",
    section: "sales",
    type: "course",
    audience: ["managers", "dealers", "employees"],
    status: "required",
    description:
      "Как менеджеру быстро подготовиться к визиту: что посмотреть в карточке товара первым делом и как выстроить презентацию в шоуруме.",
    readTimeMinutes: 16,
    progressPercent: 0,
    relatedProductIds: ["mk-grand-3-mk", "vh-grand-3"],
    relatedTaskIds: [],
    tags: ["консультация", "подготовка", "карточка"],
    updatedAt: "06.05.2026",
    summaryBullets: [
      "Первые поля карточки: серия, назначение (МК/ВХ), ключевые ограничения по влаге и весу.",
      "Второй круг: доступные размеры, базовая комплектация, опции фурнитуры.",
      "На встрече идите от сценария клиента, а не от списка характеристик сверху вниз.",
    ],
    checklist: [
      "За 10 минут до визита открыл карточку, фото витрины и актуальные комплектации.",
      "Подготовил два альтернативных варианта «проще» и «богаче».",
      "Проверил наличие образцов покрытия и фурнитуры в точке.",
      "Запланировал закрытие встречи: замер, счёт или повторный визит.",
    ],
    contentBlocks: [
      block(
        "Что смотреть в карточке в первую очередь",
        "Серия и назначение, доступные размеры, базовая комплектация, ограничения по влаге и весу полотна. Если карточка длинная, не читайте её вслух — переводите каждый блок в выгоду для клиента.",
      ),
      block(
        "Презентация в шоуруме",
        "Начните с вопроса «что хотите изменить по сравнению с текущей дверью?». Покажите полотно и фурнитуру вместе. Закрепите договорённости коротким сообщением после визита.",
      ),
      block(
        "Карточка товара и каталог",
        "Сопоставьте визуал на сайте или в каталоге с тем, что реально стоит в зале. Если позиции нет в точке, честно назовите срок поставки и альтернативу.",
      ),
    ],
  },
  {
    id: "tr-sales-expensive",
    title: "Работа с возражением «дорого»",
    section: "sales",
    type: "script",
    audience: ["managers", "dealers"],
    status: "required",
    description: "Скрипт отработки ценового возражения.",
    readTimeMinutes: 7,
    progressPercent: 55,
    relatedProductIds: [],
    relatedTaskIds: [],
    tags: ["возражения"],
    updatedAt: "01.05.2026",
    contentBlocks: [block("Вступление", "Нейтральный тон и фокус на ценности, без обещаний скидок."), block("Закрытие", "Переход к следующему шагу воронки.")],
  },
  {
    id: "tr-sales-call",
    title: "Телефонный звонок клиенту",
    section: "sales",
    type: "script",
    audience: ["managers"],
    status: "recommended",
    description: "Структура звонка и контрольные вопросы.",
    readTimeMinutes: 9,
    progressPercent: 0,
    relatedProductIds: [],
    relatedTaskIds: [],
    tags: ["звонок"],
    updatedAt: "27.04.2026",
    contentBlocks: [block("План", "Открытие, цель звонка, фиксация договорённостей.")],
  },
  {
    id: "tr-sales-wholesale",
    title: "Аргументы для оптового клиента",
    section: "sales",
    type: "article",
    audience: ["managers", "regional_managers"],
    status: "recommended",
    description: "Тезисы для B2B-диалога.",
    readTimeMinutes: 11,
    progressPercent: 30,
    relatedProductIds: [],
    relatedTaskIds: [],
    tags: ["опт"],
    updatedAt: "26.04.2026",
    contentBlocks: [block("Контекст", "Общие выгоды сотрудничества без коммерческих условий.")],
  },
  {
    id: "tr-sales-compare-models",
    title: "Сравнение моделей в разговоре с клиентом",
    section: "sales",
    type: "video",
    audience: ["dealers", "managers"],
    status: "new",
    description: "Короткий разбор подачи двух моделей в одной встрече.",
    readTimeMinutes: 14,
    progressPercent: 0,
    relatedProductIds: ["vh-kvarc", "vh-siriys"],
    relatedTaskIds: [],
    tags: ["сравнение"],
    updatedAt: "04.05.2026",
    contentBlocks: [block("Сюжет", "Последовательность вопросов и демонстрации без записи экрана внутренних систем.")],
  },
  {
    id: "tr-onboard-manager",
    title: "Адаптация нового менеджера",
    section: "onboarding",
    type: "course",
    audience: ["employees", "managers"],
    status: "required",
    description: "Первые две недели в роли: чек-листы и встречи.",
    readTimeMinutes: 25,
    progressPercent: 10,
    relatedProductIds: [],
    relatedTaskIds: [],
    tags: ["адаптация"],
    updatedAt: "20.04.2026",
    contentBlocks: [
      block("Неделя 1", "Основные разделы платформы и правила коммуникации."),
      block("Неделя 2", "Работа с клиентской базой и задачами по действующим регламентам отдела."),
    ],
  },
  {
    id: "tr-onboard-wholesale-staff",
    title: "Базовый курс сотрудника опта",
    section: "onboarding",
    type: "course",
    audience: ["employees", "dealers"],
    status: "recommended",
    description: "Модуль для сотрудников оптового направления.",
    readTimeMinutes: 40,
    progressPercent: 0,
    relatedProductIds: [],
    relatedTaskIds: [],
    tags: ["опт", "курс"],
    updatedAt: "18.04.2026",
    contentBlocks: [block("Цели", "Понимание ассортимента и сервисных стандартов компании.")],
  },
  {
    id: "tr-onboard-retail-staff",
    title: "Базовый курс сотрудника розницы",
    section: "onboarding",
    type: "course",
    audience: ["employees", "dealers"],
    status: "recommended",
    description: "Модуль для розничных точек партнёра.",
    readTimeMinutes: 38,
    progressPercent: 5,
    relatedProductIds: [],
    relatedTaskIds: [],
    tags: ["розница", "курс"],
    updatedAt: "19.04.2026",
    contentBlocks: [block("Фокус", "Витрина, консультация и передача заказа в обработку.")],
  },
  {
    id: "tr-reg-claims",
    title: "Рекламации: первичная обработка",
    section: "regulations",
    type: "regulation",
    audience: ["managers", "regional_managers", "purchasing"],
    status: "required",
    description: "Порядок фиксации обращения и сроки ответа.",
    readTimeMinutes: 16,
    progressPercent: 90,
    relatedProductIds: [],
    relatedTaskIds: [],
    tags: ["рекламации"],
    updatedAt: "03.05.2026",
    contentBlocks: [block("Этапы", "Регистрация, классификация, эскалация — без внутренних номеров заявок.")],
  },
  {
    id: "tr-reg-service",
    title: "Сервисные услуги: что важно уточнить",
    section: "regulations",
    type: "article",
    audience: ["managers", "dealers"],
    status: "updated",
    description: "Чек-лист уточнений перед оформлением сервиса.",
    readTimeMinutes: 9,
    progressPercent: 60,
    relatedProductIds: [],
    relatedTaskIds: [],
    tags: ["сервис"],
    updatedAt: "29.04.2026",
    contentBlocks: [block("Вопросы", "Список нейтральных вопросов к клиенту и фиксация ответов.")],
  },
  {
    id: "tr-reg-purchasing",
    title: "Закупки и актуальность ассортимента",
    section: "regulations",
    type: "regulation",
    audience: ["purchasing", "managers"],
    status: "recommended",
    description: "Согласование обновлений линейки.",
    readTimeMinutes: 13,
    progressPercent: 0,
    relatedProductIds: ["vh-kapelli"],
    relatedTaskIds: [],
    tags: ["закупки"],
    updatedAt: "25.04.2026",
    contentBlocks: [block("Процесс", "Кто инициирует обновление и как фиксируется решение.")],
  },
  {
    id: "tr-dev-door-facts",
    title: "Факты о дверях",
    section: "development",
    type: "article",
    audience: ["all"],
    status: "recommended",
    description: "Подборка проверенных фактов для разговора.",
    readTimeMinutes: 6,
    progressPercent: 0,
    relatedProductIds: [],
    relatedTaskIds: [],
    tags: ["факты"],
    updatedAt: "21.04.2026",
    contentBlocks: [block("Использование", "Как встроить факты в презентацию без перегрузки цифрами.")],
  },
  {
    id: "tr-dev-reading",
    title: "Список литературы для менеджера",
    section: "development",
    type: "article",
    audience: ["managers"],
    status: "new",
    description: "Рекомендованные издания и материалы для самостоятельного изучения.",
    readTimeMinutes: 5,
    progressPercent: 0,
    relatedProductIds: [],
    relatedTaskIds: [],
    tags: ["литература"],
    updatedAt: "06.05.2026",
    contentBlocks: [
      block("Примечание", "Список составлен из открытых изданий и отраслевых обзоров; служебные ссылки в материале не приводятся."),
    ],
  },
];

function programIdsForMaterial(id: string): string[] {
  return TRAINING_PROGRAMS.filter((p) => p.materialIds.includes(id)).map((p) => p.id);
}

function contextsFor(m: LegacyTrainingMaterial): RelatedTaskContext[] {
  const c: RelatedTaskContext[] = [];
  if (m.section === "product") {
    c.push("showcase", "hardware", "dealer_card");
  }
  if (m.section === "sales") {
    c.push("analytics", "dealer_card");
  }
  if (m.section === "regulations") {
    c.push("orders", "territory", "dealer_card");
  }
  if (m.section === "onboarding") {
    c.push("dealer_card", "orders");
  }
  if (m.section === "development") {
    c.push("analytics");
  }
  if (m.relatedTaskIds.length > 0) {
    c.push("showcase");
  }
  return Array.from(new Set(c));
}

function difficultyFor(m: LegacyTrainingMaterial): TrainingMaterialDifficulty {
  if (m.readTimeMinutes >= 25 || m.type === "regulation") return "hard";
  if (m.readTimeMinutes <= 8) return "easy";
  return "medium";
}

function progressStatusFor(pct: number): TrainingProgressStatus {
  if (pct >= 100) return "completed";
  if (pct > 0) return "in_progress";
  return "not_started";
}

function enrichTrainingMaterial(m: LegacyTrainingMaterial): TrainingMaterial {
  const defaultBullets = [m.description, m.contentBlocks[0]?.body?.slice(0, 200) ?? ""].filter((b) => b.trim().length > 0);
  const summaryBullets =
    m.summaryBullets?.some((b) => b.trim()) && m.summaryBullets ? m.summaryBullets : defaultBullets;
  const defaultChecklist = [
    "Просмотреть материал и зафиксировать вопросы",
    m.section === "product"
      ? "Сверить с выкладкой или задачей по точке"
      : "Применить на ближайшем клиентском кейсе",
    "Отметить результат в рабочем списке",
  ];
  const checklist = m.checklist?.length ? m.checklist : defaultChecklist;
  return {
    ...m,
    programIds: programIdsForMaterial(m.id),
    durationMinutes: m.readTimeMinutes,
    difficulty: difficultyFor(m),
    required: m.status === "required",
    progressStatus: progressStatusFor(m.progressPercent),
    knowledgeTags: [...m.tags],
    relatedTaskContext: contextsFor(m),
    checklist,
    summaryBullets,
  };
}

function applyWave1WikiAnnotation(m: TrainingMaterial): TrainingMaterial {
  const ann = WAVE1_TRAINING_WIKI_ANNOTATIONS[m.id];
  if (!ann) return m;
  return {
    ...m,
    sourceType: "wiki",
    originalTitle: ann.wikiTitle,
    reviewStatus: "approved",
    wikiCatalogLine: ann.wikiCatalogLine,
    wikiSource: {
      sourceType: "wiki",
      wikiTitle: ann.wikiTitle,
      wikiImportedAt: ann.wikiImportedAt,
      wikiReviewStatus: "approved",
      wikiSectionGuess: ann.wikiSectionGuess,
      wikiCharCount: ann.wikiCharCount,
    },
  };
}

function mergeWikiIntoProgramDefinitions() {
  const wiki = getWikiImportedTrainingMaterials();
  for (const p of TRAINING_PROGRAMS) {
    const add = wiki.filter((w) => w.programIds.includes(p.id)).map((w) => w.id);
    p.materialIds = Array.from(new Set([...p.materialIds, ...add]));
    p.totalMaterials = p.materialIds.length;
  }
}

const MANUAL_MATERIALS: TrainingMaterial[] = _RAW_MATERIALS.map((m) => {
  const enriched = enrichTrainingMaterial(m);
  const withWiki = applyWave1WikiAnnotation(enriched);
  return withWiki.sourceType === "wiki"
    ? withWiki
    : { ...withWiki, sourceType: "manual" as const };
});

mergeWikiIntoProgramDefinitions();

const MATERIALS: TrainingMaterial[] = [...MANUAL_MATERIALS, ...getWikiImportedTrainingMaterials()];

const _matrixTaskIds = getAllMatrixTasks()
  .slice(0, 2)
  .map((t) => t.taskId)
  .filter(Boolean);
const _linkMaterial = MATERIALS.find((m) => m.id === "tr-sales-expensive");
if (_linkMaterial && _matrixTaskIds.length > 0) {
  _linkMaterial.relatedTaskIds = [..._matrixTaskIds];
}

export function getAllTrainingMaterials(): TrainingMaterial[] {
  return MATERIALS;
}

export function getTrainingMaterialById(id: string): TrainingMaterial | undefined {
  return MATERIALS.find((m) => m.id === id);
}

export function getTrainingMaterialsForProduct(productId: string): TrainingMaterial[] {
  const product = getProductById(productId);
  const line: "mk" | "vh" | "hardware" | null = product
    ? product.id.includes("sk-") || product.category.toLowerCase().includes("фурнитур")
      ? "hardware"
      : product.doorKind?.includes("Вход")
        ? "vh"
        : "mk"
    : null;
  return MATERIALS.filter((m) => {
    if (m.relatedProductIds.includes(productId)) return true;
    if (m.sourceType !== "wiki" || !line) return false;
    if (m.wikiCatalogLine === "all" && m.section === "product") return true;
    if (m.wikiCatalogLine && m.wikiCatalogLine !== "all" && m.wikiCatalogLine === line) return true;
    return false;
  });
}

export function summarizeTrainingKpis(materials: TrainingMaterial[]) {
  const total = materials.length;
  const required = materials.filter((m) => m.required).length;
  const inProgress = materials.filter((m) => m.progressPercent > 0 && m.progressPercent < 100).length;
  const dealerAccess = materials.filter((m) => m.audience.includes("dealers") || m.audience.includes("all")).length;
  return { total, required, inProgress, dealerAccess };
}

export function getTrainingDashboardSummary(): TrainingProgress {
  const mats = MATERIALS;
  const req = mats.filter((m) => m.required);
  const reqDone = req.filter((m) => m.progressStatus === "completed").length;
  const inProg = mats.filter((m) => m.progressStatus === "in_progress").length;
  const attention = TRAINING_ASSIGNMENTS.filter((a) => a.priority === "high" && a.status !== "completed").length;
  const monthPct = Math.min(100, Math.round(mats.reduce((s, m) => s + m.progressPercent, 0) / Math.max(1, mats.length)));
  return {
    monthProgressPercent: monthPct,
    requiredCompleted: reqDone,
    requiredTotal: req.length,
    inProgressCount: inProg,
    attentionCount: attention,
  };
}

export function getTrainingPrograms(): TrainingProgram[] {
  return TRAINING_PROGRAMS;
}

export function getTrainingProgramById(programId: string): TrainingProgram | undefined {
  return TRAINING_PROGRAMS.find((p) => p.id === programId);
}

export function getTrainingMaterialsByProgram(programId: string): TrainingMaterial[] {
  const p = getTrainingProgramById(programId);
  if (!p) return [];
  return p.materialIds
    .map((id) => getTrainingMaterialById(id))
    .filter((m): m is TrainingMaterial => Boolean(m));
}

export function getRequiredTrainingMaterials(): TrainingMaterial[] {
  return MATERIALS.filter((m) => m.required);
}

export function getRecommendedTrainingMaterials(): TrainingMaterial[] {
  return MATERIALS.filter((m) => !m.required && (m.status === "recommended" || m.status === "new"));
}

export function getTrainingAssignments(): TrainingAssignment[] {
  return TRAINING_ASSIGNMENTS;
}

export function getTrainingProgramsForMaterial(materialId: string): TrainingProgram[] {
  return TRAINING_PROGRAMS.filter((p) => p.materialIds.includes(materialId));
}

export function getTrainingProgramsForProduct(productId: string): TrainingProgram[] {
  const mats = getTrainingMaterialsForProduct(productId);
  const ids = new Set(mats.flatMap((m) => m.programIds));
  return TRAINING_PROGRAMS.filter((p) => ids.has(p.id));
}

export function getTrainingMaterialsBySection(section: TrainingSection): TrainingMaterial[] {
  return MATERIALS.filter((m) => m.section === section);
}

export function getTrainingModulesByProgram(programId: string): TrainingModule[] {
  return TRAINING_MODULES.filter((mod) => mod.programId === programId).sort((a, b) => a.order - b.order);
}

export type TrainingMaterialSearchFilters = {
  section?: TrainingSection | "all";
  role?: TrainingRole | "all";
  type?: TrainingMaterialType | "all";
  required?: "all" | "required" | "optional";
  progressStatus?: TrainingProgressStatus | "all";
  source?: "all" | "wiki" | "manual";
};

function materialMatchesRole(m: TrainingMaterial, role: TrainingRole): boolean {
  if (role === "manager") return m.audience.includes("managers") || m.audience.includes("all");
  if (role === "regional_manager") return m.audience.includes("regional_managers") || m.audience.includes("all");
  if (role === "leadership") return m.audience.includes("managers") || m.audience.includes("regional_managers");
  if (role === "new_hire") return m.audience.includes("employees") || m.audience.includes("managers");
  return true;
}

export function searchTrainingMaterials(query: string, filters: TrainingMaterialSearchFilters): TrainingMaterial[] {
  const q = query.trim().toLowerCase();
  return MATERIALS.filter((m) => {
    if (q) {
      const hit =
        m.title.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        m.knowledgeTags.some((t) => t.toLowerCase().includes(q));
      if (!hit) return false;
    }
    if (filters.section && filters.section !== "all" && m.section !== filters.section) return false;
    if (filters.role && filters.role !== "all" && !materialMatchesRole(m, filters.role)) return false;
    if (filters.type && filters.type !== "all" && m.type !== filters.type) return false;
    if (filters.required === "required" && !m.required) return false;
    if (filters.required === "optional" && m.required) return false;
    if (filters.progressStatus && filters.progressStatus !== "all" && m.progressStatus !== filters.progressStatus) {
      return false;
    }
    if (filters.source === "wiki" && m.sourceType !== "wiki") return false;
    if (filters.source === "manual" && m.sourceType === "wiki") return false;
    return true;
  });
}

export const RELATED_TASK_CONTEXT_LABEL: Record<RelatedTaskContext, string> = {
  showcase: "Витрина",
  hardware: "Фурнитура",
  orders: "Заказы",
  dealer_card: "Карточка клиента",
  territory: "Карточка территории",
  analytics: "Аналитика",
};

export function getTrainingArticleIdForTask(params: {
  insightDomain?: TaskInsightDomain;
  productId?: string;
}): string | undefined {
  if (params.productId) {
    const product = getProductById(params.productId);
    const line: "mk" | "vh" | "hardware" | null = product
      ? product.id.includes("sk-") || product.category.toLowerCase().includes("фурнитур")
        ? "hardware"
        : product.doorKind?.includes("Вход")
          ? "vh"
          : "mk"
      : null;
    const wikiPick = pickWikiMaterialIdForTaskInsight(params.insightDomain, line);
    const byProd = getTrainingMaterialsForProduct(params.productId);
    const wikiMat = wikiPick ? MATERIALS.find((m) => m.id === wikiPick) : undefined;
    if (wikiMat?.sourceType === "wiki") return wikiMat.id;
    if (byProd[0]) return byProd[0].id;
  }
  const wikiInsight = pickWikiMaterialIdForTaskInsight(params.insightDomain, null);
  if (wikiInsight) return wikiInsight;
  switch (params.insightDomain) {
    case "analytics":
      return "tr-sales-expensive";
    case "showcase":
      return "tr-prod-ent-card";
    case "hardware":
      return "tr-prod-hw-groups";
    case "equipment":
      return "tr-reg-service";
    case "territory":
      return "tr-reg-claims";
    default:
      return undefined;
  }
}
