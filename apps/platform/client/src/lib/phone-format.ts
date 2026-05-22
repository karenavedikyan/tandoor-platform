/** Плейсхолдер и сообщение об ошибке для российского мобильного номера в формате E.164 (код страны 7). */
export const RU_PHONE_PLACEHOLDER = "+7 XXX XXXXXXX";

export const RU_PHONE_INVALID_MESSAGE = "Введите телефон в формате +7 XXX XXXXXXX.";

/**
 * Форматирует ввод телефона РФ для отображения: +7 XXX XXXXXXX.
 * Принимает ввод с 8, 7, +7 или 10 локальных цифр; лишние символы отбрасываются;
 * локальная часть ограничена 10 цифрами; пустой ввод → "".
 */
export function formatRussianPhoneInput(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (!digits) return "";
  let normalized = digits;
  if (normalized.startsWith("8")) normalized = `7${normalized.slice(1)}`;
  const local = normalized.startsWith("7") ? normalized.slice(1) : normalized;
  const ten = local.slice(0, 10);
  if (!ten) return "";
  const first = ten.slice(0, 3);
  const rest = ten.slice(3);
  return rest ? `+7 ${first} ${rest}` : `+7 ${first}`;
}

/**
 * true, если после нормализации 10 цифр подряд или 11 цифр, начинающихся с 7 или 8.
 */
export function isValidRussianPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return true;
  if (digits.length === 11 && (digits.startsWith("7") || digits.startsWith("8"))) return true;
  return false;
}
