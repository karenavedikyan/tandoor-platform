import type { ClientCategoryId } from "@/lib/client-category";
import { TANDOOR_REAL_CATALOG_SEED } from "@/lib/tandoor-real-catalog-seed.generated";

export type ShowcaseMatrixModelType = "entrance" | "interior";

export type ShowcaseMatrixPriorityRank = "high" | "medium" | "low";

export type ShowcaseMatrixTier = "expanded" | "medium" | "base" | "starter";

export type ShowcaseMatrixModelDefinition = {
  id: string;
  /** UUID товара в каталоге 1С, если известен. */
  catalog1cId?: string;
  name: string;
  type: ShowcaseMatrixModelType;
  typeLabelRu: "ВХ" | "МК";
  imageUrl: string;
  basePriority: ShowcaseMatrixPriorityRank;
  importanceReason: string;
  characteristics: string;
  advantages: string;
  benefitsDealer: string;
  benefitsBuyer: string;
  objections: string;
  objectionAnswers: string;
  copyMessage: string;
  /** Для каких категорий клиента позиция обязательна в плане (подсказка в карточке). */
  categoryRules: ClientCategoryId[];
};

const SEED_BY_ID = new Map(TANDOOR_REAL_CATALOG_SEED.map((p) => [p.id, p]));

/** Порядок фиксирован: без случайных перестановок. */
/** Порядок влияет на состав стартовой/базовой матрицы (чередование ВХ и МК в начале списка). */
const MATRIX_MODEL_ORDER: readonly string[] = [
  "tc-vh-era-grafit-belyy-matovyy-860kh2050-levaya",
  "tc-mk-baget-12-mokko-pet-dg-2000-800-94",
  "tc-vh-panteon-bukle-temno-seryy-chernyy-kvarts-860kh2050-levaya",
  "tc-mk-grand-13-medzhik-pet-dg-2000-800",
  "tc-vh-midas-orekh-pekan-shokolad-emalit-belyy-860kh2050-levaya",
  "tc-vh-ultra-pikhtovyy-emalit-belyy-860kh2050-levaya",
  "tc-mk-baget-13-makiato-pet-dg-2000-800-91",
  "tc-mk-m-36-emal-belaya-dg-2000-800",
] as const;

const PRESENTATION: Record<
  string,
  Omit<ShowcaseMatrixModelDefinition, "id" | "name" | "type" | "typeLabelRu" | "imageUrl">
> = {
  "tc-vh-era-grafit-belyy-matovyy-860kh2050-levaya": {
    basePriority: "high",
    categoryRules: ["top150", "top350", "top500", "top500plus", "new_client"],
    importanceReason: "Ходовая входная группа: узнаваемая отделка, хорошо смотрится на витрине рядом с конкурентами.",
    characteristics:
      "Входная дверь, типовой проём 860×2050, левая навеска. Внешняя сторона — графит, внутренняя — белый матовый. Усиленный каркас, многоточечный замок.",
    advantages:
      "Сбалансированная цена и внешний вид; понятный выбор для квартиры; легко сочетается со светлыми стенами внутри.",
    benefitsDealer:
      "Быстрый повторный спрос по коллекции «Эра»; меньше возвратов из‑за ожиданий по цвету; удобно держать как «якорную» входную модель.",
    benefitsBuyer:
      "Спокойный современный фасад и светлая внутренняя сторона; удобно при входе из тёмного подъезда; меньше споров по оттенку при осмотре.",
    objections: "Дорого для «просто двери».\nБоится царапин на тёмной стороне.\nСомневается в шумоизоляции.",
    objectionAnswers:
      "Сравните комплектацию и толщину металла в одном ценовом коридоре — здесь баланс «цена / надёжность / вид».\nТёмная сторона проще в уходе, чем глянец; при бережной эксплуатации ресурс высокий.\nПо шуму: уплотнители и плотное прилегание полотна снижают слышимость из подъезда.",
    copyMessage:
      "Предлагаю рассмотреть входную «Эра» в графите с белой внутренней стороной: современный вид, понятная логика цвета «снаружи / внутри», хорошо заходит покупателям, которые хотят спокойный интерьер без «кричащих» решений.",
  },
  "tc-vh-panteon-bukle-temno-seryy-chernyy-kvarts-860kh2050-levaya": {
    basePriority: "high",
    categoryRules: ["top150", "top350", "top500", "top500plus"],
    importanceReason: "Текстурная входная модель — помогает показать премиальный сегмент без перегруза витрины.",
    characteristics:
      "Входная дверь 860×2050, левая. Отделка с текстурой «букле», сочетание тёмно-серого и чёрного кварца. Усиленная конструкция под типовые квартирные проёмы.",
    advantages:
      "Выразительная фактура; хорошо читается на расстоянии; подходит для клиентов, которые хотят «дороже смотрится», но без экзотики.",
    benefitsDealer:
      "Повышает средний чек по входным; даёт повод обсудить фурнитуру и замки; отличный объект для фото витрины.",
    benefitsBuyer:
      "Сильный визуальный акцент у входа; меньше «плоских» сравнений только по цене — проще объяснить ценность отделки.",
    objections: "Слишком тёмная для площадки.\nБоится маркости.\nХочет «как у соседа, но дешевле».",
    objectionAnswers:
      "На витрине тёмная дверь «держит» внимание и помогает продать светлые модели рядом контрастом.\nПоверхность подобрана так, чтобы отпечатки не были главной проблемой при обычном уходе.\nЕсли важнее бюджет — покажем ближайшую альтернативу в той же логике комплектации.",
    copyMessage:
      "Если нужна входная «с характером», смотрите «Пантеон» в букле: богатая текстура, спокойная премиальная подача. На витрине это сильный якорь — клиенту проще «зацепиться» глазом и перейти к деталям.",
  },
  "tc-vh-midas-orekh-pekan-shokolad-emalit-belyy-860kh2050-levaya": {
    basePriority: "medium",
    categoryRules: ["top150", "top350", "top500", "top500plus"],
    importanceReason: "Тёплое дерево + белый внутри — универсальный запрос на входную группу.",
    characteristics:
      "Входная дверь 860×2050, левая. Снаружи — орех/шоколадная гамма, внутри — белый эмалит. Подходит для типовых новостроек и вторички.",
    advantages:
      "Классическое сочетание «тёплый снаружи / светлый внутри»; хорошо стыкуется с ламинатом и светлыми стенами.",
    benefitsDealer:
      "Снижает долю «не угадали с цветом»: понятный мотив для большинства квартирных сценариев.",
    benefitsBuyer:
      "Спокойная эстетика; проще согласовать с семьёй, где один хочет «дерево», а другой — «светлее внутри».",
    objections: "Не нравится рисунок дерева.\nХочет полностью белую снаружи.\nСомневается в сочетании с плиткой в подъезде.",
    objectionAnswers:
      "Рисунок дерева на витрине лучше смотреть при дневном свете и с образцом доборов — восприятие меняется.\nЕсли нужна белая внешняя — подберём ближайшую по комплектации.\nС плиткой в МОП обычно ок, потому что тон снаружи нейтральный.",
    copyMessage:
      "Для типового запроса «дерево снаружи, светло внутри» хорошо заходит «Мидас»: спокойный шоколад/орех снаружи и белый эмалит внутри. Удобно предлагать семьям, где важны и тепло тона, и свет в прихожей.",
  },
  "tc-vh-ultra-pikhtovyy-emalit-belyy-860kh2050-levaya": {
    basePriority: "medium",
    categoryRules: ["top150", "top350", "top500", "top500plus"],
    importanceReason: "Натуралистичная фактура «пихта» — отличает витрину от однотипных гладких решений.",
    characteristics:
      "Входная дверь 860×2050, левая. Внешняя сторона с мотивом пихты, внутренняя — белый эмалит. Универсальная геометрия под массовый спрос.",
    advantages:
      "Хорошо показывает «живую» текстуру; клиенту проще объяснить отличие от бюджетных гладких панелей.",
    benefitsDealer:
      "Помогает в презентации «почему не самое дешёвое»: видимая фактура = понятная ценность.",
    benefitsBuyer:
      "Мягче воспринимается, чем глянец; проще вписать в скандинавские и нейтральные интерьеры.",
    objections: "Боится, что «рисунок дерева устареет».\nСравнивает с более дешёвым аналогом по фото.",
    objectionAnswers:
      "Фактура здесь спокойная, не «под дерево 2000-х» — на витрине это видно лучше, чем на экране.\nСравнение по фото часто обманчиво: важны толщина металла, уплотнение, петли и замковая группа.",
    copyMessage:
      "Если хочется входной с «живой» текстурой, но без кричащего декора — «Ультра» в пихте с белой внутренней стороной хорошо работает: на витрине читается фактура, а в квартире остаётся спокойная светлая внутренняя плоскость.",
  },
  "tc-mk-baget-12-mokko-pet-dg-2000-800-94": {
    basePriority: "high",
    categoryRules: ["top150", "top350", "top500", "top500plus", "new_client"],
    importanceReason: "Межкомнатная серия с узнаваемым профилем — быстрый старт разговора про МК.",
    characteristics:
      "Межкомнатная дверь 2000×800, ПЭТ, стекло ДГ. Коллекция «Багет-12», оттенок «Мокко». Подходит для типовых проёмов.",
    advantages:
      "Понятный формат «дверь + стекло»; легко показать варианты цвета рядом на витрине.",
    benefitsDealer:
      "Хорошая «первая» МК для клиента; помогает перевести разговор к комплектации и фурнитуре.",
    benefitsBuyer:
      "Светопрозрачность для кухни/гостиной; приватность там, где нужно; современный цвет мокко.",
    objections: "Стекло «не хочу».\nБоится царапин ПЭТ.\nНужна глухая.",
    objectionAnswers:
      "Стеклянная версия — для зон, где важен свет; для спальни покажем глухую из той же линейки.\nПЭТ в быту достаточно устойчив при нормальном обращении.\nПодберём глухую композицию без потери стиля.",
    copyMessage:
      "По межкомнатным часто заходят с модели «Багет-12» в мокко: современный ПЭТ, стекло ДГ — удобно для кухни/гостиной, на витрине хорошо смотрится рядом с глухими вариантами той же серии.",
  },
  "tc-mk-grand-13-medzhik-pet-dg-2000-800": {
    basePriority: "high",
    categoryRules: ["top150", "top350", "top500", "top500plus"],
    importanceReason: "Широкая линейка «Гранд» — помогает показать шаг вверх по дизайну МК.",
    characteristics:
      "Межкомнатная дверь 2000×800, ПЭТ, стекло ДГ. Коллекция «Гранд 13», декор «мэджик».",
    advantages:
      "Выразительный рисунок; хороший «второй» уровень после базовых моделей на витрине.",
    benefitsDealer:
      "Повышает средний чек по МК; удобно предлагать к наборам фурнитуры и скрытым петлям.",
    benefitsBuyer:
      "Сильнее индивидуальность интерьера; проще отстроиться от типовых решений соседей.",
    objections: "По цене выше ожиданий.\nСложно представить в интерьере.\nСомнения по сочетанию с полом.",
    objectionAnswers:
      "Сравним комплектацию и толщину: «дороже» часто = более устойчивые материалы и аккуратнее стыковка.\nНа витрине лучше смотреть рядом с полом/плинтусом из образцов.\nДля пола подберём нейтральные связки по тону.",
    copyMessage:
      "Если клиент хочет межкомнатную «поинтереснее базы», «Гранд 13 мэджик» хорошо работает: выразительный ПЭТ, аккуратное стекло ДГ — на витрине сразу видно уровень, проще объяснить ценность без давления.",
  },
  "tc-mk-baget-13-makiato-pet-dg-2000-800-91": {
    basePriority: "medium",
    categoryRules: ["top150", "top350"],
    importanceReason: "Расширение линейки «Багет» — показывает вариативность цвета в одной системе профилей.",
    characteristics:
      "Межкомнатная дверь 2000×800, ПЭТ, стекло ДГ. Коллекция «Багет-13», оттенок «Макиато».",
    advantages:
      "Логичное продолжение после «Багет-12» — клиент видит развитие коллекции, а не «другую вселенную».",
    benefitsDealer:
      "Проще кросс-селл внутри серии; меньше времени на объяснение монтажных отличий.",
    benefitsBuyer:
      "Тёплый нейтральный тон; хорошо ложится в кухни-гостиные и современные спальни.",
    objections: "Слишком похоже на другую модель.\nНе уверен в оттенке на солнце.",
    objectionAnswers:
      "Похожесть — плюс: единая система профилей и доборов, разные цвета.\nОттенок лучше сверить у витрины при дневном свете — так честнее, чем по фото.",
    copyMessage:
      "Если уже смотрели «Багет», логично показать «Багет-13 макиато» — тот же язык профиля, другой тёплый нейтральный тон. На витрине это помогает клиенту выбрать «свой» оттенок без скачка в другую серию.",
  },
  "tc-mk-m-36-emal-belaya-dg-2000-800": {
    basePriority: "low",
    categoryRules: ["top150", "top350"],
    importanceReason: "Классическая белая эмаль — must-have для витрины МК в любом сегменте клиента.",
    characteristics:
      "Межкомнатная дверь 2000×800, эмаль белая, глухая ДГ. Модель «М-36».",
    advantages:
      "Универсальный «фон» для витрины; хорошо сочетается с любой фурнитурой и стеклянными соседями.",
    benefitsDealer:
      "Стабильный спрос; удобно как опорная белая для подбора комплектов.",
    benefitsBuyer:
      "Максимум света в коридоре и смежных зонах; легко вписать в любой ремонт.",
    objections: "Белое маркое.\nХочет «не глянец».\nБоится жёлтый уход эмали.",
    objectionAnswers:
      "Белая эмаль — это про аккуратную эксплуатацию; расскажем про уход без абразивов.\nЕсли не любите глянец — покажем ближайшие матовые альтернативы.\nКачественная эмаль при нормальном уходе держит внешний вид долго.",
    copyMessage:
      "Для базы по межкомнатным белая «М-36» эмаль — must have на витрине: универсальная, хорошо дружит с любыми ручками и доборами. Клиенту проще «собрать картинку» интерьера, когда есть чистая белая опора.",
  },
};

function catalogTypeToModelType(cat: "entrance" | "interior" | "hardware" | "other"): ShowcaseMatrixModelType {
  if (cat === "entrance") return "entrance";
  return "interior";
}

function typeLabel(type: ShowcaseMatrixModelType): "ВХ" | "МК" {
  return type === "entrance" ? "ВХ" : "МК";
}

function buildDefinitions(): ShowcaseMatrixModelDefinition[] {
  const out: ShowcaseMatrixModelDefinition[] = [];
  for (const id of MATRIX_MODEL_ORDER) {
    const seed = SEED_BY_ID.get(id);
    const pres = PRESENTATION[id];
    if (!seed || !pres) continue;
    const type = catalogTypeToModelType(seed.category);
    out.push({
      id,
      name: seed.title,
      type,
      typeLabelRu: typeLabel(type),
      imageUrl: seed.imageSrc,
      ...pres,
    });
  }
  return out;
}

export const SHOWCASE_MATRIX_MODEL_DEFINITIONS: ShowcaseMatrixModelDefinition[] = buildDefinitions();

export function matrixTierForClientCategory(cat: ClientCategoryId): ShowcaseMatrixTier {
  if (cat === "top150") return "expanded";
  if (cat === "top350") return "medium";
  if (cat === "top500" || cat === "top500plus") return "base";
  return "starter";
}

const TIER_MODEL_COUNT: Record<ShowcaseMatrixTier, number> = {
  /** ТОП 150 — расширенная матрица */
  expanded: 8,
  /** ТОП 350 — средняя */
  medium: 6,
  /** ТОП 500 — базовая */
  base: 5,
  /** Новые / потенциальные — стартовая */
  starter: 4,
};

function rotateStable<T>(arr: T[], shift: number): T[] {
  const n = arr.length;
  if (n === 0) return [];
  const s = ((shift % n) + n) % n;
  return [...arr.slice(s), ...arr.slice(0, s)];
}

export function charSumStable(s: string): number {
  let sum = 0;
  for (let i = 0; i < s.length; i += 1) sum += s.charCodeAt(i);
  return sum;
}

/** Модели для сегмента клиента: фиксированное число по сегменту, порядок сдвигается по id точки (без случайности). */
export function getShowcaseMatrixModelsForTradePoint(
  dealerId: string,
  tradePointId: string,
  clientCategory: ClientCategoryId,
): ShowcaseMatrixModelDefinition[] {
  const tier = matrixTierForClientCategory(clientCategory);
  const want = Math.min(TIER_MODEL_COUNT[tier], SHOWCASE_MATRIX_MODEL_DEFINITIONS.length);
  const base = SHOWCASE_MATRIX_MODEL_DEFINITIONS.slice(0, want);
  const shift = charSumStable(`${dealerId}|${tradePointId}`) % base.length;
  return rotateStable(base, shift);
}

export function priorityLabelRu(p: ShowcaseMatrixPriorityRank): "Высокий" | "Средний" | "Низкий" {
  if (p === "high") return "Высокий";
  if (p === "medium") return "Средний";
  return "Низкий";
}

export function resolveCatalog1cId(m: ShowcaseMatrixModelDefinition): string | null {
  return m.catalog1cId ?? null;
}

/** Ссылка на карточку каталога: напрямую в 1С при известном UUID, иначе через legacy-мост. */
export function catalogHrefForMatrixModel(m: ShowcaseMatrixModelDefinition): string {
  if (m.catalog1cId) return `/catalog/1c/${m.catalog1cId}`;
  return `/catalog/${m.id}`;
}
