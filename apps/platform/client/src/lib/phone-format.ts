/** Плейсхолдер и сообщение об ошибке для российского мобильного номера (каталог дилеров, контакты). */
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
 * Используется в формах дилеров и контактов (не профиль пользователя).
 */
export function isValidRussianPhoneLoose(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return true;
  if (digits.length === 11 && (digits.startsWith("7") || digits.startsWith("8"))) return true;
  return false;
}

/** Нормализованный вид для хранения и серверной валидации. Пример: "+79991234567". */
export function normalizePhone(input: string): string {
  return normalizeToCanonical(input);
}

/** Маска для отображения. "+7 (999) 123-45-67" для нормализованной формы. */
export function formatPhoneMask(normalized: string): string {
  if (!normalized || normalized === "+7") {
    return "+7 ";
  }
  if (/^\+7\d*$/.test(normalized)) {
    return maskOnInput(normalized);
  }
  return normalized;
}

/** Из произвольного ввода → отображаемая маска (для контролируемого input). */
export function maskOnInput(rawInput: string): string {
  const canonical = normalizeToCanonical(rawInput);
  const digits = canonical.slice(2);
  const len = digits.length;
  let s = "+7 ";
  if (len === 0) return s;
  s += "(" + digits.slice(0, Math.min(3, len));
  if (len <= 3) return s;
  s += ") " + digits.slice(3, Math.min(6, len));
  if (len <= 6) return s;
  s += "-" + digits.slice(6, Math.min(8, len));
  if (len <= 8) return s;
  s += "-" + digits.slice(8, Math.min(10, len));
  return s;
}

/** true если строка == "+7" + ровно 10 цифр. */
export function isValidRussianPhone(normalized: string): boolean {
  return /^\+7\d{10}$/.test(normalized);
}

/**
 * Удалить всё, что не цифра, нормализовать первые символы:
 * если начинается с 8 → заменить на 7;
 * если первая цифра не 7 → префиксовать 7;
 * Обрезать до 11 цифр.
 * Вернуть строку "+7" + национальная часть (0–10 цифр).
 */
export function normalizeToCanonical(rawInput: string): string {
  const digits = rawInput.replace(/\D/g, "");
  if (digits.length === 0) {
    return "+7";
  }
  let d = digits;
  if (d.startsWith("8")) {
    d = "7" + d.slice(1);
  }
  if (!d.startsWith("7")) {
    d = "7" + d;
  }
  d = d.slice(0, 11);
  return `+${d}`;
}
