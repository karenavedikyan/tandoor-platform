/**
 * Пилот: обучающие карточки моделей с фото.
 * Изображения — локальные WebP в `public/training-model-pilot/`, по снимкам с публичного каталога Tandoor (resize_cache).
 * Тексты и названия выровнены под фактическое изображение; `productId` только при точном совпадении с каталогом приложения.
 */

function pilotWebp(pilotId: string): string {
  return `/training-model-pilot/${pilotId}.webp`;
}

export type TrainingModelPhotoPilotCategory = "vh" | "mk";

export type TrainingModelPhotoPilotItem = {
  id: string;
  /** Только при точном совпадении с `CATALOG_PRODUCTS`; иначе кнопка «Открыть товар» скрыта. */
  productId?: string;
  title: string;
  category: TrainingModelPhotoPilotCategory;
  imageSrc: string;
  imageAlt: string;
  lineOrCollection: string;
  shortPositioning: string;
  keyFacts: string[];
  whenToOffer: string[];
  clientPitch: string;
  commonObjection: string;
  objectionAnswer: string;
  relatedTrainingMaterialIds: string[];
};

const PILOT_ITEMS: TrainingModelPhotoPilotItem[] = [
  {
    id: "pilot-vh-grand-3",
    title: "Пантеон",
    category: "vh",
    imageSrc: pilotWebp("pilot-vh-grand-3"),
    imageAlt: "Входная дверь Tandoor, модель Пантеон — как на фото каталога",
    lineOrCollection: "Входные · модель «Пантеон»",
    shortPositioning:
      "На фото — конкретная входная модель из витринной линейки: акцент на панели, фурнитуре и «силуэте» полотна для показа клиенту.",
    keyFacts: [
      "Пантеон — отдельная модель, не серия «Гранд»: опирайтесь на фактуру и комплект с фото.",
      "Покажите клиенту петли, профиль и цвет панели — это главные точки внимания на снимке.",
      "Для сравнения с другими входными группами используйте общие аргументы по теплу и шуму, не смешивая названия моделей.",
    ],
    whenToOffer: [
      "Клиент выбирает представительскую входную группу и смотрит на дизайн панели.",
      "Нужна опора «что именно на фото» — проведите пальцем по макету и совместите с полотном в зале.",
    ],
    clientPitch:
      "На витрине у нас как раз эта конфигурация «Пантеон»: давайте сравним с вашим проёмом по свету и оттенку пола — так проще принять решение.",
    commonObjection: "Это не та модель, что мы смотрели на сайте под другим названием.",
    objectionAnswer:
      "Сверимся по фото и артикулу в актуальной матрице: в каталоге названия иногда группируют по серии, а на снимке — конкретное исполнение.",
    relatedTrainingMaterialIds: ["tr-prod-vh-sales-pack", "tr-prod-ent-card"],
  },
  {
    id: "pilot-vh-grand-4",
    title: "Эра",
    category: "vh",
    imageSrc: pilotWebp("pilot-vh-grand-4"),
    imageAlt: "Входная дверь Tandoor, модель Эра",
    lineOrCollection: "Входные · модель «Эра»",
    shortPositioning: "Лаконичный вход с чёткой геометрией — на фото видно соотношение панели и фурнитуры без лишнего декора.",
    keyFacts: [
      "Эра — самостоятельная модель: не путать с «Гранд» только по толщине полотна.",
      "Хорошо заходит, когда клиенту важна спокойная графика и предсказуемый сервис.",
      "На консультации держите фокус на закрытии и петлях — они хорошо читаются на снимке.",
    ],
    whenToOffer: [
      "Запрос на современный вход без «классических молдингов».",
      "Сравнение с другой моделью по цене — показываем отличия по комплекту с фото.",
    ],
    clientPitch:
      "Это модель «Эра» в том исполнении, что на фото: спокойный фасад, понятный уровень фурнитуры — удобная база для квартирного входа.",
    commonObjection: "Хочется потеплее/потише, чем кажется по картинке.",
    objectionAnswer:
      "Тогда рядом откроем модель с более богатым уплотнением. По «Эре» честно говорим: упор на дизайн и ценность комплекта, а не на максимум опций.",
    relatedTrainingMaterialIds: ["tr-prod-vh-sales-pack", "tr-prod-compare-models-on-floor"],
  },
  {
    id: "pilot-vh-grand-5",
    title: "Ультра",
    category: "vh",
    imageSrc: pilotWebp("pilot-vh-grand-5"),
    imageAlt: "Входная дверь Tandoor, модель Ультра",
    lineOrCollection: "Входные · модель «Ультра»",
    shortPositioning: "По фото — усиленная визуальная подача: массивнее фурнитура и более «собранный» периметр полотна.",
    keyFacts: [
      "Ультра — отдельная модель, не «Гранд 5»: ориентируйтесь на снимок и актуальную карточку в матрице.",
      "Аргумент для клиента: заметнее акцент на безопасности и плотности комплекта.",
      "Для загородного входа часто сравнивают с соседними позициями — держите под рукой соседние фото.",
    ],
    whenToOffer: [
      "Клиент сразу говорит про дом, двор, второй свет.",
      "Нужна «витринная» входная дверь с богатым комплектом на фото.",
    ],
    clientPitch:
      "Здесь как раз «Ультра» в том виде, что на снимке: богаче комплект и визуально увереннее полотно — хороший шаг от базовой стали.",
    commonObjection: "Дорого относительно другой модели на стенде.",
    objectionAnswer:
      "Сравним комплект по пунктам: замки, петли, уплотнение. Разница в цене обычно укладывается в то, что видно на фото — без допридумывания.",
    relatedTrainingMaterialIds: ["tr-prod-vh-locks-guide", "tr-prod-vh-sales-pack"],
  },
  {
    id: "pilot-vh-neapol",
    title: "Пандора",
    category: "vh",
    imageSrc: pilotWebp("pilot-vh-neapol"),
    imageAlt: "Входная дверь Tandoor, модель Пандора",
    lineOrCollection: "Входные · модель «Пандора»",
    shortPositioning: "На фото — выразительная фактура панели и спокойный классический силуэт; удобно для «первого впечатления» у клиента.",
    keyFacts: [
      "Пандора — не «Неаполь»: название и декор совпадают с этим снимком из каталога.",
      "Сильная сторона — сочетание фактуры и цвета; покажите в зале рядом с образцом пола.",
      "При апселле сравнивайте с более графичными моделями, не подменяйте имя.",
    ],
    whenToOffer: [
      "Клиент просит классику с выразительной панелью.",
      "Нужна «дорогая» подача без эклектики.",
    ],
    clientPitch:
      "Это «Пандора» в исполнении как на фото: фактура и цвет — главный аргумент, остальное докрутим по комплекту.",
    commonObjection: "Путаемся в названиях похожих моделей.",
    objectionAnswer:
      "Ориентируемся на фото и артикул: здесь именно Пандора. Остальные серии покажем отдельно, чтобы не смешивать в голове клиента.",
    relatedTrainingMaterialIds: ["tr-prod-ent-card", "tr-prod-vh-sales-pack"],
  },
  {
    id: "pilot-vh-kvarc",
    title: "Лайт",
    category: "vh",
    imageSrc: pilotWebp("pilot-vh-kvarc"),
    imageAlt: "Входная дверь Tandoor, модель Лайт (лайт-исполнение)",
    lineOrCollection: "Входные · модель «Лайт»",
    shortPositioning: "Светлая, спокойная входная композиция на фото — проще бюджет и быстрее объяснить ценность «бренд + аккуратный фасад».",
    keyFacts: [
      "Лайт — не «Кварц»: это другое фактическое исполнение с витрины.",
      "Хорош для квартиры, где важны скорость решения и предсказуемый вид.",
      "На снимке хорошо виден баланс панели и короба — используйте как опору в разговоре.",
    ],
    whenToOffer: [
      "Клиент ограничен по бюджету, но не хочет «безымянную сталь».",
      "Нужна светлая входная группа под нейтральный ремонт.",
    ],
    clientPitch:
      "На фото — «Лайт»: светлый, собранный вход без перегруза декором. Если нужно проще — остаёмся здесь; если нужен шаг вверх — соседние модели покажем рядом.",
    commonObjection: "Выглядит слишком просто.",
    objectionAnswer:
      "Это осознанная простота: зато понятно, за что платим. Добавим фурнитуру или панель по матрице — но база останется честной, как на снимке.",
    relatedTrainingMaterialIds: ["tr-prod-vh-sales-pack", "tr-prod-compare-models-on-floor"],
  },
  {
    id: "pilot-mk-grand-3-mk",
    title: "Гранд 13 · Medzhik",
    category: "mk",
    imageSrc: pilotWebp("pilot-mk-grand-3-mk"),
    imageAlt: "Межкомнатная дверь Tandoor, коллекция Grand 13, отделка Medzhik",
    lineOrCollection: "Межкомнатные · гранд 13 / Grand 13 · Medzhik",
    shortPositioning: "На фото — межкомнатное полотно линейки Grand 13 в отделке Medzhik: важно называть и коллекцию, и декор.",
    keyFacts: [
      "Grand 13 и Medzhik — разные оси названия: обе отражены на этом снимке.",
      "Скрытые петли и ровный торец хорошо читаются — покажите клиенту вживую зазор.",
      "Для связки с входной группой используйте общий тон, не подменяйте номер модели.",
    ],
    whenToOffer: [
      "Клиент собирает квартиру в едином стиле и смотрит на фактуру МК.",
      "Сравнение «Гранд 13» с другими коллекциями по каталогу.",
    ],
    clientPitch:
      "Это Grand 13 в Medzhik — ровно как на фото: так мы избегаем путаницы с другими «Гранд» в названии.",
    commonObjection: "Почему не просто «Гранд 3 МК»?",
    objectionAnswer:
      "На снимке другая коллекция и отделка. По фактуре и артикулу сверимся с матрицей — так честнее для клиента и для монтажа.",
    relatedTrainingMaterialIds: ["tr-prod-mk-assortment", "tr-prod-mk-lines-diff"],
  },
  {
    id: "pilot-mk-grand-4",
    title: "Гранд 13 · Zefir",
    category: "mk",
    imageSrc: pilotWebp("pilot-mk-grand-4"),
    imageAlt: "Межкомнатная дверь Tandoor, коллекция Grand 13, отделка Zefir",
    lineOrCollection: "Межкомнатные · гранд 13 / Grand 13 · Zefir",
    shortPositioning: "Фото показывает Zefir в Grand 13 — мягкая фактура, спокойный рисунок; не смешивать с Medzhik на соседней карточке.",
    keyFacts: [
      "Zefir отличается рисунком и светотенью — сравните с Medzhik на двух образцах.",
      "Подходит для спален и детских, где не нужен агрессивный декор.",
      "При подборе к полу держите образец рядом с фото на экране.",
    ],
    whenToOffer: [
      "Клиент выбирает между двумя отделками одной коллекции.",
      "Нужна тёплая межкомнатная без «кричащего» рисунка.",
    ],
    clientPitch:
      "Здесь Grand 13 в Zefir — как на фото: мягче рисунок, чем у Medzhik; давайте приложим к вашему полу.",
    commonObjection: "Визуально почти как соседняя карточка.",
    objectionAnswer:
      "На стенде различим по свету и штриху. Зафиксируем артикул — на объекте не будет сюрприза.",
    relatedTrainingMaterialIds: ["tr-prod-mk-assortment", "tr-prod-compare-models-on-floor"],
  },
  {
    id: "pilot-mk-grand-5",
    title: "Mona 01 · brown",
    category: "mk",
    imageSrc: pilotWebp("pilot-mk-grand-5"),
    imageAlt: "Межкомнатная дверь Tandoor, Mona 01, отделка brown",
    lineOrCollection: "Межкомнатные · Mona 01 / brown",
    shortPositioning: "На фото — Mona в тёплом brown: сильный акцент на цвете и фактуре, хорошо читается на витрине.",
    keyFacts: [
      "Mona 01 — конкретная модель и цвет brown с витринного снимка.",
      "Для тёплых интерьеров и дерева пола — готовый «якорь» подборки.",
      "Проверьте освещение в зале: brown на фото и вживую может отличаться.",
    ],
    whenToOffer: [
      "Клиент хочет тёплый шоколад/кофе без красного дерева.",
      "Нужна заметная, но не кричащая дверь в гостиную.",
    ],
    clientPitch:
      "Это Mona 01 brown — как на фото: тёплый тон и спокойный рисунок; если нужно светлее — покажем соседние отделки.",
    commonObjection: "Боится, что потемнеет со временем.",
    objectionAnswer:
      "Обсудим уход и солнечную сторону; по матрице подскажем совместимость с лаком и фурнитурой — без обещаний «как у соседа».",
    relatedTrainingMaterialIds: ["tr-prod-mk-lines-diff", "tr-prod-int-coatings"],
  },
  {
    id: "pilot-mk-kapelli",
    title: "Кантата · белая",
    category: "mk",
    imageSrc: pilotWebp("pilot-mk-kapelli"),
    imageAlt: "Межкомнатная дверь Tandoor, Кантата, белое исполнение",
    lineOrCollection: "Межкомнатные · Кантата / белый",
    shortPositioning: "Фото — белая «Кантата»: чистая эмаль и ровный свет; не смешивать с серией «Капелли» из другого блока каталога.",
    keyFacts: [
      "Кантата — отдельное имя модели на снимке, не «Капелли МК».",
      "Для светлых минималистичных планировок и узких коридоров.",
      "Держите контраст с полом: белое полотно любит «опорный» цвет рядом.",
    ],
    whenToOffer: [
      "Запрос на белую дверь без филёнки.",
      "Сравнение с другими белыми моделями по фактуре эмали.",
    ],
    clientPitch:
      "Здесь именно Кантата в белом — как на фото: ровная эмаль и спокойный профиль; если нужна пара к входной — подберём отдельно по тону.",
    commonObjection: "Белое пугает в эксплуатации.",
    objectionAnswer:
      "Зафиксируем сценарий уборки и зону риска; при необходимости сдвинемся на чуть более тёплый белый из матрицы.",
    relatedTrainingMaterialIds: ["tr-prod-mk-assortment", "tr-prod-int-coatings"],
  },
  {
    id: "pilot-mk-sk-line",
    title: "SK-2 DG · белая",
    category: "mk",
    imageSrc: pilotWebp("pilot-mk-sk-line"),
    imageAlt: "Скрытая дверь Tandoor, система SK-2 DG, белое полотно под покраску",
    lineOrCollection: "Скрытая система · SK-2 DG / белый",
    shortPositioning:
      "На фото — скрытая межкомнатная система SK-2 DG в белом: полотно под покраску; в демо-каталоге приложения нет точной карточки этой SKU.",
    keyFacts: [
      "SK-2 DG — фактическое обозначение с витринного снимка; не подменяем другой артикул.",
      "Нужны согласованные этапы с малярами и замер проёма.",
      "Покажите клиенту стык со стеной — это главный «продажный» кадр.",
    ],
    whenToOffer: [
      "Дизайн-проект, стены под покраску, минимализм.",
      "Клиент просит «дверь без двери».",
    ],
    clientPitch:
      "Это SK-2 DG белая, как на фото: скрытая короб и полотно под финиш стены. Дальше синхронизируемся с бригадой по этапам.",
    commonObjection: "Где посмотреть это в каталоге на планшете?",
    objectionAnswer:
      "В демо-каталоге нет точной карточки этой SKU — не подсовываем похожую. Откройте обучающий материал по скрытым системам и зафиксируйте артикул с менеджером бренда.",
    relatedTrainingMaterialIds: ["tr-prod-mk-lines-diff", "tr-prod-mk-interior-align"],
  },
];

export function getTrainingModelPhotoPilotItems(): TrainingModelPhotoPilotItem[] {
  return PILOT_ITEMS;
}

export function buildTrainingModelPhotoPilotSearchHaystack(item: TrainingModelPhotoPilotItem): string {
  const parts = [
    item.title,
    item.lineOrCollection,
    item.shortPositioning,
    item.clientPitch,
    item.commonObjection,
    item.objectionAnswer,
    item.category === "vh" ? "входные ВХ" : "межкомнатные МК",
    ...item.keyFacts,
    ...item.whenToOffer,
    ...item.relatedTrainingMaterialIds,
  ];
  if (item.productId) parts.push(item.productId);
  return parts.join(" ").toLowerCase();
}

export function filterTrainingModelPhotoPilotItems(
  items: TrainingModelPhotoPilotItem[],
  opts: { category: "all" | TrainingModelPhotoPilotCategory; searchQuery: string },
): TrainingModelPhotoPilotItem[] {
  const byCat =
    opts.category === "all" ? items : items.filter((i) => i.category === opts.category);
  const q = opts.searchQuery.trim();
  if (q.length < 2) return byCat;
  const nq = q.toLowerCase();
  if (nq === "мк" || nq === "mk") {
    if (!byCat.some((i) => i.category === "mk")) return [];
    return byCat.filter((i) => i.category === "mk");
  }
  if (nq === "вх" || nq === "vh") {
    if (!byCat.some((i) => i.category === "vh")) return [];
    return byCat.filter((i) => i.category === "vh");
  }
  const matched = byCat.filter((i) => pilotItemMatchesSearch(i, q));
  return matched.length > 0 ? matched : byCat;
}

/** Поиск по пилоту: приоритет названию модели, затем полный haystack; при нескольких словах — все должны встречаться. */
function pilotItemMatchesSearch(item: TrainingModelPhotoPilotItem, rawQuery: string): boolean {
  const q = rawQuery.trim().toLowerCase().replace(/\s+/g, " ");
  if (q.length < 2) return true;
  const title = item.title.toLowerCase();
  const hay = buildTrainingModelPhotoPilotSearchHaystack(item);
  if (title.includes(q) || q.includes(title)) return true;
  const parts = q.split(" ").filter((p) => p.length > 0);
  if (parts.length >= 2) {
    return parts.every((p) => {
      if (/^\d+$/.test(p)) return title.includes(p);
      return title.includes(p) || hay.includes(p);
    });
  }
  return title.includes(parts[0] ?? q) || hay.includes(parts[0] ?? q);
}
