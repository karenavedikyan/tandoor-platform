/**
 * Пилот: обучающие карточки моделей с фото с публичного каталога tandoor.ru (resize_cache).
 * Не подменяет основной каталог и не тянет внешние API в runtime — только статические URL.
 */

const TANDOOR_ORIGIN = "https://tandoor.ru";

export type TrainingModelPhotoPilotCategory = "vh" | "mk";

export type TrainingModelPhotoPilotItem = {
  id: string;
  productId: string;
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

function u(path: string): string {
  return `${TANDOOR_ORIGIN}${path}`;
}

const PILOT_ITEMS: TrainingModelPhotoPilotItem[] = [
  {
    id: "pilot-vh-grand-3",
    productId: "vh-grand-3",
    title: "Гранд 3",
    category: "vh",
    imageSrc: u(
      "/upload/resize_cache/iblock/4b7/avm82yhk3hx7gxh2i73jp1f7gezkc3o2/440_550_1/1_panteon__05_05_2026__04_32_13.jpg",
    ),
    imageAlt: "Входная дверь Tandoor, серия Гранд — пример фактуры для консультации",
    lineOrCollection: "Серия «Гранд»",
    shortPositioning: "Флагман входной группы: тепло-, шумоизоляция и представительный вид для квартиры или дома.",
    keyFacts: [
      "Терморазрыв и несколько контуров уплотнения — аргумент для клиента с требованиями к комфорту.",
      "Совместимость по тону с межкомнатными сериями Tandoor — продаём «единый стиль квартиры».",
      "Ригельный комплект и усиленное полотно — спокойствие по безопасности без перегруза деталями.",
    ],
    whenToOffer: [
      "Клиент сравнивает с конкурентом по «толщине» и «контурам».",
      "Нужна входная дверь для основного входа в квартиру или коттедж.",
      "Запрос на тёплый контур и тихий замок без обсуждения цены в первой фразе.",
    ],
    clientPitch:
      "Это наша представительская входная серия: тёплый контур, плотное закрытие и внешний вид, который можно подобрать к вашим межкомнатным дверям.",
    commonObjection: "Дорого по сравнению с базовой сталью в строительном магазине.",
    objectionAnswer:
      "Согласен, цена выше базовой стали: здесь другой уровень уплотнения и фурнитуры. Давайте зафиксируем, что для вас важнее — шум с лестницы, тепло у двери или внешний вид — и подберём комплектацию без лишнего.",
    relatedTrainingMaterialIds: ["tr-prod-ent-card", "tr-prod-vh-sales-pack"],
  },
  {
    id: "pilot-vh-grand-4",
    productId: "vh-grand-4",
    title: "Гранд 4",
    category: "vh",
    imageSrc: u(
      "/upload/resize_cache/iblock/5c2/wh1y556tkn4gyakegzbpn7s3vjnuny23/440_550_1/1_era__05_05_2026__04_31_19.jpg",
    ),
    imageAlt: "Входная дверь Tandoor — лаконичная комплектация серии Гранд",
    lineOrCollection: "Серия «Гранд»",
    shortPositioning: "Та же геометрия серии, более простая комплектация — удобная точка входа в линейку.",
    keyFacts: [
      "Терморазрыв сохраняется — не «упрощёнка без тепла», а рациональный набор.",
      "Базовый замковой комплект — проще объяснить срок поставки и сервис.",
      "Подходит для типовой квартиры, где клиент хочет серию «Гранд», но без максимума опций.",
    ],
    whenToOffer: [
      "Бюджет чуть ниже, чем у «Гранд 3/5», но запрос к бренду и серии остаётся.",
      "Первичное жильё или сдача в аренду с аккуратным фасадом.",
    ],
    clientPitch:
      "Это «Гранд» в более собранной комплектации: сохраняем узнаваемый стиль и теплый контур, упрощаем набор опций — проще по бюджету и срокам.",
    commonObjection: "Чем отличается от «Гранд 3», если выглядит похоже?",
    objectionAnswer:
      "Близко по дизайну, но комплектация легче: меньше опций по замкам и фурнитуре. Если важнее максимум по безопасности и шуму — смотрим «Гранд 3» или «Гранд 5», если нужен баланс цена/комфорт — эта модель очень часто заходит.",
    relatedTrainingMaterialIds: ["tr-prod-vh-sales-pack", "tr-prod-compare-models-on-floor"],
  },
  {
    id: "pilot-vh-grand-5",
    productId: "vh-grand-5",
    title: "Гранд 5",
    category: "vh",
    imageSrc: u(
      "/upload/resize_cache/iblock/7a8/3vnvx2t4g0gez6wd5vftlbkj2ek15is3/440_550_1/1_ultra__05_05_2026__04_31_36.jpg",
    ),
    imageAlt: "Входная дверь Tandoor — усиленная комплектация серии Гранд",
    lineOrCollection: "Серия «Гранд»",
    shortPositioning: "Расширенная комплектация для клиентов, которые сразу говорят про дом, шум и безопасность.",
    keyFacts: [
      "Дополнительные контуры уплотнения — говорим про комфорт «на ощупь» у двери.",
      "Усиленный замковой узел — без давления, просто фиксируем запрос к безопасности.",
      "Подходит для загородного использования чаще, чем базовые модели.",
    ],
    whenToOffer: [
      "Клиент ссылается на шум с улицы или сквозняк в подъезде.",
      "Дом/коттедж, отдельный вход, повышенные ожидания по комплектации.",
    ],
    clientPitch:
      "Если нужен максимум спокойствия по дому и двери — это усиленная версия «Гранд»: плотнее закрывается, богаче по комплектации, хорошо заходит туда, где семья проводит много времени дома.",
    commonObjection: "Нам хватит более простой двери.",
    objectionAnswer:
      "Можем и проще — вопрос сценария. Если дом шумный или дверь — главный вход с улицы, разница в уплотнении и замке окупается комфортом. Давайте сравним с «Гранд 4» по двум параметрам, которые для вас критичны.",
    relatedTrainingMaterialIds: ["tr-prod-vh-locks-guide", "tr-prod-vh-sales-pack"],
  },
  {
    id: "pilot-vh-neapol",
    productId: "vh-neapol",
    title: "Неаполь",
    category: "vh",
    imageSrc: u(
      "/upload/resize_cache/iblock/6b4/0mtv48e23k57mkcygu7s655ujrn4lzmg/440_550_1/1_pandora__05_05_2026__04_30_13.jpg",
    ),
    imageAlt: "Входная дверь Tandoor с фактурной МДФ-панелью — для консультации по серии Неаполь",
    lineOrCollection: "Серия «Неаполь»",
    shortPositioning: "Классика с фактурными панелями — для клиентов, которые хотят «дорого и спокойно», без эксперимента.",
    keyFacts: [
      "Устойчивый спрос — можно опереться на «проверенный хит», не на личные предпочтения менеджера.",
      "Фактура МДФ хорошо смотрится вживую — важно пригласить к полотну в зале.",
      "Сочетание с тёплыми оттенами пола — готовый скрипт подборки.",
    ],
    whenToOffer: [
      "Клиент просит классику, молдинги, спокойные цвета.",
      "Ремонт в тёплых тонах дерева или камня.",
    ],
    clientPitch:
      "«Неаполь» — это спокойная классика: фактура панели и фурнитура выглядят собранно, дверь легко вписать в традиционный интерьер без спорных трендов.",
    commonObjection: "Хочется что-то современнее.",
    objectionAnswer:
      "Тогда рядом покажем более графичные серии. Если важна тёплая классика и предсказуемый результат — «Неаполь» экономит время: меньше риска «не зайдёт» у семьи.",
    relatedTrainingMaterialIds: ["tr-prod-ent-card", "tr-prod-vh-sales-pack"],
  },
  {
    id: "pilot-vh-kvarc",
    productId: "vh-kvarc",
    title: "Кварц",
    category: "vh",
    imageSrc: u(
      "/upload/resize_cache/iblock/2e1/vwe42nxfvmwer1fl6btluo3ys5hdf8jy/440_550_1/1_layt_bg__05_05_2026__04_54_34.jpg",
    ),
    imageAlt: "Входная дверь Tandoor среднего сегмента — пример для серии Кварц",
    lineOrCollection: "Серия «Кварц»",
    shortPositioning: "Практичный вход для квартиры: сталь, базовый замок, понятная ценность без «перегруза» опциями.",
    keyFacts: [
      "Два контура уплотнения — честный минимум для квартирного входа.",
      "Регулируемые петли — аргумент про сервис и долгую эксплуатацию.",
      "Часто участвует в акциях — удобно для быстрого решения.",
    ],
    whenToOffer: [
      "Клиент ограничен по бюджету, но не хочет «совсем базу без бренда».",
      "Квартира для сдачи или второе жильё.",
    ],
    clientPitch:
      "«Кварц» — рабочая лошадка: брендовая дверь с нормальным уплотнением и аккуратным видом, без переплаты за опции, которые клиенту не нужны.",
    commonObjection: "Выглядит проще, чем на картинке у конкурента.",
    objectionAnswer:
      "Да, здесь проще фасад — зато прозрачно, что входит в цену. Предлагаю сравнить «на ощупь» закрытие и петли, а потом решить, нужен ли шаг вверх до «Неаполя» или «Гранд».",
    relatedTrainingMaterialIds: ["tr-prod-vh-sales-pack", "tr-prod-compare-models-on-floor"],
  },
  {
    id: "pilot-mk-grand-3-mk",
    productId: "mk-grand-3-mk",
    title: "Гранд 3 МК",
    category: "mk",
    imageSrc: u(
      "/upload/resize_cache/iblock/564/jbejw26kjv3uvxe17vsd0zaf26igbtmp/440_550_1/grand_13_medzhik__05_05_2026__04_30_20.jpg",
    ),
    imageAlt: "Межкомнатная дверь Tandoor серии Гранд — пример для консультации",
    lineOrCollection: "Серия «Гранд» (МК)",
    shortPositioning: "Межкомнатная линия в одной фактуре с входной «Гранд» — продаём комплект «вход + комнаты».",
    keyFacts: [
      "Скрытые петли — аккуратный зазор и современный вид.",
      "Несколько ширин полотна — быстро закрываем типовые проёмы.",
      "Согласованность с входной серией снижает спор о цвете у семьи.",
    ],
    whenToOffer: [
      "Клиент уже выбирает или купил входную «Гранд».",
      "Нужен единый стиль по квартире без смешения брендов.",
    ],
    clientPitch:
      "Чтобы квартира смотрелась собранно, межкомнатные берём в пару к входной «Гранд» — та же логика фактуры, меньше риска «не попали в оттенок».",
    commonObjection: "Можно ли дешевле от другого производителя?",
    objectionAnswer:
      "Можно, но тогда теряем гарантированное попадание в тон и фурнитуру. Если важен результат «с первого раза» — комплект Tandoor обычно дешевле переделок и времени.",
    relatedTrainingMaterialIds: ["tr-prod-mk-assortment", "tr-prod-mk-lines-diff"],
  },
  {
    id: "pilot-mk-grand-4",
    productId: "mk-grand-4",
    title: "Гранд 4 МК",
    category: "mk",
    imageSrc: u(
      "/upload/resize_cache/iblock/6a2/go9lnx315nmn0ii7vp0sy387vdfj73zd/440_550_1/grand_13_zefir__05_05_2026__04_30_22.jpg",
    ),
    imageAlt: "Межкомнатная дверь Tandoor серии Гранд — базовая комплектация",
    lineOrCollection: "Серия «Гранд» (МК)",
    shortPositioning: "Быстрые проекты и типовые проёмы — базовый комплект без лишнего.",
    keyFacts: [
      "Совместимость с входной серией сохраняется.",
      "Меньше опций — проще объяснить срок и монтаж.",
      "Хорошая позиция для спальни/детской, где не нужен максимум фурнитуры.",
    ],
    whenToOffer: [
      "Нужно много одинаковых дверей по квартире в умеренном бюджете.",
      "Клиент сравнивает с моделью «Гранд 3 МК» по цене.",
    ],
    clientPitch:
      "Если по комнатам нужен тот же стиль «Гранд», но без максимума опций — «Гранд 4 МК» закрывает типовые проёмы быстрее и спокойнее по бюджету.",
    commonObjection: "Чем отличается от «Гранд 3 МК»?",
    objectionAnswer:
      "По стилю — в одной линейке, по комплектации проще: меньше опций по петлям и покрытию. Если нужен акцент на витринном «вау» — смотрим «Гранд 3/5 МК».",
    relatedTrainingMaterialIds: ["tr-prod-mk-assortment", "tr-prod-compare-models-on-floor"],
  },
  {
    id: "pilot-mk-grand-5",
    productId: "mk-grand-5",
    title: "Гранд 5 МК",
    category: "mk",
    imageSrc: u(
      "/upload/resize_cache/iblock/5fb/g2gb2bgb7y9ekbk7sa3oidcplxnm51po/440_550_1/mona_01_brown__05_05_2026__04_31_57.jpg",
    ),
    imageAlt: "Межкомнатная дверь Tandoor — усиленная комплектация серии Гранд",
    lineOrCollection: "Серия «Гранд» (МК)",
    shortPositioning: "Усиленная межкомнатная версия: магнитная защёлка и скрытые петли для витринной зоны.",
    keyFacts: [
      "Скрытые петли и магнитный замок — понятные «вау»-фичи без перегруза техникой.",
      "Soft-touch или богаче покрытие — уточняйте по актуальной матрице.",
      "Для главных комнат квартиры, где клиент хочет «как на входе».",
    ],
    whenToOffer: [
      "Клиент хочет «как в шоуруме» в комнатах.",
      "Повышенные ожидания по тактильности и звуку закрывания.",
    ],
    clientPitch:
      "Это «Гранд» для комнат, где важен премиальный опыт: мягкое закрывание, скрытые петли, собранный вид — хорошо смотрится на главной витрине квартирного набора.",
    commonObjection: "Нужно ли это в детской?",
    objectionAnswer:
      "Не обязательно. Часто здесь оставляем «Гранд 4 МК», а «Гранд 5 МК» ставим в гостиную и мастер-спальню — так бюджет сбалансирован, а эффект премиума сохраняется там, где семья проводит больше времени.",
    relatedTrainingMaterialIds: ["tr-prod-mk-lines-diff", "tr-prod-mk-compilation-checklist"],
  },
  {
    id: "pilot-mk-kapelli",
    productId: "mk-kapelli",
    title: "Капелли МК",
    category: "mk",
    imageSrc: u(
      "/upload/resize_cache/iblock/688/1zwszyg1efskb7rbyb2c6ijrul6j8ypd/440_550_1/kantata_belaya__05_05_2026__04_31_46.jpg",
    ),
    imageAlt: "Межкомнатная дверь Tandoor — лаконичная эмаль, серия Капелли",
    lineOrCollection: "Серия «Капелли»",
    shortPositioning: "Узкая коробка и чистая эмаль — для современных планировок и светлых интерьеров.",
    keyFacts: [
      "Хорошо стыкуется с входной «Капелли» — продаём пару.",
      "Лаконичный дизайн — меньше споров «много декора».",
      "Акционные периоды — следите за актуальной политикой бренда.",
    ],
    whenToOffer: [
      "Светлый минимализм, мало места по толщине стены.",
      "Клиент уже смотрит входную «Капелли».",
    ],
    clientPitch:
      "Если входную берёте «Капелли», межкомнатные в той же логике делают квартиру визуально спокойнее: тонкий короб, чистые плоскости, меньше визуального шума.",
    commonObjection: "Боится белого цвета в эксплуатации.",
    objectionAnswer:
      "Обсудим зону риска: дети, животные, солнечная сторона. По уходу — короткая памятка по эмалям и фурнитуре; при необходимости сместим оттенок на чуть более «живой».",
    relatedTrainingMaterialIds: ["tr-prod-mk-assortment", "tr-prod-int-coatings"],
  },
  {
    id: "pilot-mk-sk-line",
    productId: "sk-line",
    title: "Скрытая дверь «Линия»",
    category: "mk",
    imageSrc: u(
      "/upload/resize_cache/iblock/1ad/18r6kw6aozmvl932a1ny35hxwcx45p1y/440_550_1/sk_2_dg_belyy__05_05_2026__04_31_27.jpg",
    ),
    imageAlt: "Скрытая межкомнатная дверь Tandoor под покраску — линейка «Линия»",
    lineOrCollection: "Серия «Линия»",
    shortPositioning: "Полотно под покраску и скрытая коробка — для клиентов с запросом «дверь исчезает в стене».",
    keyFacts: [
      "Нужен аккуратный замер и согласование с малярами — фиксируем заранее.",
      "Магнитный замок — комфорт закрытия без лишнего шума.",
      "Продаём как часть дизайн-проекта, не как импульсную позицию.",
    ],
    whenToOffer: [
      "Дизайнер в проекте, стены под покраску, минимализм.",
      "Клиент хочет единую плоскость стены.",
    ],
    clientPitch:
      "Скрытая «Линия» — это про «дверь без двери»: полотно под покраску и короб, который не выбивается из плоскости. Важно заранее согласовать ответственность с отделочниками.",
    commonObjection: "Дорого и долго по монтажу.",
    objectionAnswer:
      "Да, это другой класс работ: зато вы получаете ровную стену без наличников. Давайте прикинем этапы с бригадой: кто готовит проём, кто красит, когда вешаем полотно — так снимаем страх «растянется ремонт».",
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
    item.productId,
  ];
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
