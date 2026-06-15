## Что меняет PR

<кратко>

## Затронутые роли

<какие UserRole-ы видят результат этого PR? все? только manager? только директор/admin?>

## Чек-лист

- [ ] Если PR трогает auth-access / role-mapping / dealer-base-role-views / real-scope / my-codes / persona-маппинг — обновил `docs/roles-matrix.md`.
- [ ] Запустил `npm run test:role-smoke` локально — зелёное.
- [ ] Запустил релевантные тесты: `npm run test:auth-access`, `npm run test:sidebar-dealer-count-vs-page`, `npm run test:sidebar-trade-points-count` — зелёное.
- [ ] Если добавлена новая роль / новый реальный руководитель — добавил UUID в `LEADERS_UUID_TO_PERSONA` или `UUID_TO_MGR_FOR_ACTUALIZATION_DEDUPE`.
- [ ] Если меняется поведение sidebar-counter — добавил кейс в `role-smoke.test.ts`.

## Проверено вручную под ролями

- [ ] admin
- [ ] director
- [ ] rop (хотя бы один из Купянский/Сапожков/Скалабан)
- [ ] manager
- [ ] regional_manager
- [ ] marketer
- [ ] analyst
- [ ] category_manager
