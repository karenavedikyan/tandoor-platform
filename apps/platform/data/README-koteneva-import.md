# Импорт клиентов Котеневой А.В.

Положите файл **`Spisok-klientov_Koteneva-A.xlsx`** в эту папку (`apps/platform/data/`), лист **`Лист2`**, колонки как в задании.

Затем из каталога `apps/platform`:

```bash
npm run release:import-koteneva
```

Скрипт перезапишет `client/src/lib/release-client-seed-koteneva.generated.ts`.

Пока файла нет в CI, в репозитории может лежать **synthetic** набор (флаг `--synthetic-koteneva` в `scripts/import-koteneva-clients.mjs`).
