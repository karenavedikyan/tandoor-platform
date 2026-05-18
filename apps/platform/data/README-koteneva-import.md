# Импорт клиентов Котеневой А.В.

## Рекомендуемый путь: Excel

1. Положите **`Spisok-klientov_Koteneva-A.xlsx`** в эту папку (`apps/platform/data/`), лист **`Лист2`**, колонки: Наименование, Населенный пункт, Код, РОП, Ответственный менеджер тандор, Адрес, Тип клиента.

2. Файл можно закоммитить: в корневом `.gitignore` добавлено исключение `!apps/platform/data/Spisok-klientov_Koteneva-A.xlsx` (остальные `*.xlsx` по-прежнему игнорируются).

3. Из каталога `apps/platform`:

```bash
npm run release:import-koteneva
```

В шапке `release-client-seed-koteneva.generated.ts` будет **`Источник: xlsx:...`**.

## Альтернатива: JSON (если Excel не в репозитории)

Создайте **`koteneva-clients.source.json`** — массив объектов или `{ "rows": [...] }` с полями `name`, `city`, `code`, `address`, `clientType` (как в Excel). Затем снова `npm run release:import-koteneva` (при отсутствии xlsx скрипт возьмёт JSON). В шапке сида будет **`json:data/koteneva-clients.source.json`**.

## Временный режим без файла (только dev/CI)

Если ни xlsx, ни JSON нет, можно один раз сгенерировать сид из **подряд идущих 117 строк** общего релизного сида (реальные коды `MA-*` и наименования из `release-client-seed.generated.ts`, **это не список из файла Котеневой**):

```bash
npm run release:import-koteneva:slice1981
```

В шапке будет **`seed-slice:release-client-seed.generated.ts#1981`**. После появления Excel перегенерируйте импортом из xlsx и закоммитьте заново.

## Слияние с основным сидом

В `release-client-data.ts` строки Котеневой **заменяют** строки основного сида с тем же полем `code`, чтобы не было дубликатов клиентов в объединённом списке.
