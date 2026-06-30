/**
 * Компактный срез публичного seed-каталога для матрицы витрины (8 фиксированных моделей).
 * Значения зафиксированы из tandoor-real-catalog-seed.generated на момент промта 4b.
 */

export type ShowcaseMatrixSeedSubsetItem = {
  id: string;
  title: string;
  category: "entrance" | "interior" | "hardware";
  imageSrc: string;
};

export const SHOWCASE_MATRIX_SEED_SUBSET: readonly ShowcaseMatrixSeedSubsetItem[] = [
  {
    id: "tc-vh-era-grafit-belyy-matovyy-860kh2050-levaya",
    title: "Эра Графит / Белый матовый 860х2050 левая",
    category: "entrance",
    imageSrc: "/catalog-real/tc-vh-era-grafit-belyy-matovyy-860kh2050-levaya-01.webp",
  },
  {
    id: "tc-mk-baget-12-mokko-pet-dg-2000-800-94",
    title: "Багет-12 Мокко ПЭТ ДГ 2000*800 (94)",
    category: "interior",
    imageSrc: "/catalog-real/tc-mk-baget-12-mokko-pet-dg-2000-800-94-01.webp",
  },
  {
    id: "tc-vh-panteon-bukle-temno-seryy-chernyy-kvarts-860kh2050-levaya",
    title: "Пантеон Букле темно-серый / Черный кварц 860х2050 левая",
    category: "entrance",
    imageSrc: "/catalog-real/tc-vh-panteon-bukle-temno-seryy-chernyy-kvarts-860kh2050-levaya-01.webp",
  },
  {
    id: "tc-mk-grand-13-medzhik-pet-dg-2000-800",
    title: "Гранд 13 мэджик ПЭТ ДГ 2000*800",
    category: "interior",
    imageSrc: "/catalog-real/tc-mk-grand-13-medzhik-pet-dg-2000-800-01.webp",
  },
  {
    id: "tc-vh-midas-orekh-pekan-shokolad-emalit-belyy-860kh2050-levaya",
    title: "Мидас Орех пекан шоколад / Эмалит белый 860х2050 левая",
    category: "entrance",
    imageSrc: "/catalog-real/tc-vh-midas-orekh-pekan-shokolad-emalit-belyy-860kh2050-levaya-01.webp",
  },
  {
    id: "tc-vh-ultra-pikhtovyy-emalit-belyy-860kh2050-levaya",
    title: "Ультра Пихтовый / Эмалит белый 860х2050 левая",
    category: "entrance",
    imageSrc: "/catalog-real/tc-vh-ultra-pikhtovyy-emalit-belyy-860kh2050-levaya-01.webp",
  },
  {
    id: "tc-mk-baget-13-makiato-pet-dg-2000-800-91",
    title: "Багет-13 Макиато ПЭТ ДГ 2000*800 (91)",
    category: "interior",
    imageSrc: "/catalog-real/tc-mk-baget-13-makiato-pet-dg-2000-800-91-01.webp",
  },
  {
    id: "tc-mk-m-36-emal-belaya-dg-2000-800",
    title: "М-36 эмаль белая ДГ 2000*800",
    category: "interior",
    imageSrc: "/catalog-real/tc-mk-m-36-emal-belaya-dg-2000-800-01.webp",
  },
] as const;

export const SHOWCASE_MATRIX_SEED_SUBSET_BY_ID = new Map(
  SHOWCASE_MATRIX_SEED_SUBSET.map((row) => [row.id, row]),
);
