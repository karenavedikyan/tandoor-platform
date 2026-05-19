/**
 * Общая логика POST /api/bitrix24/tasks/test для Express (Node).
 */

import { executeBitrix24TaskAdd } from "../api/bitrix24/webhook-task-core";

const TEST_TASK_TITLE = "Тестовая задача из Тандор";
const TEST_TASK_DESCRIPTION =
  "POC интеграции Тандор + Bitrix24. Задача создана из встроенной страницы /bitrix24.";

export type Bitrix24TasksTestHttpResult = {
  status: number;
  body: Record<string, unknown>;
};

/**
 * Выполняет вызов Bitrix24 `tasks.task.add` (или возвращает 503, если webhook не настроен).
 */
export async function runBitrix24TasksTest(): Promise<Bitrix24TasksTestHttpResult> {
  return executeBitrix24TaskAdd(
    { TITLE: TEST_TASK_TITLE, DESCRIPTION: TEST_TASK_DESCRIPTION },
    {
      successMessage: "Тестовая задача создана в Bitrix24",
      logPrefix: "[bitrix24]",
    },
  );
}
