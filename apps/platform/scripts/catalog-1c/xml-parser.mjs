import fs from "node:fs";
import sax from "sax";
import { normPath, normUuid } from "./util.mjs";

/**
 * @typedef {object} CatalogCategoryRow
 * @property {string} id
 * @property {string} name
 * @property {string | null} parentId
 * @property {Record<string, string>} raw
 */

/**
 * @typedef {object} CatalogGroupRow
 * @property {string} id
 * @property {string | null} parentId
 */

/**
 * @typedef {object} CatalogPriceTypeRow
 * @property {string} id
 * @property {string} name
 */

/**
 * @typedef {object} CatalogProductRow
 * @property {string} id
 * @property {string | null} groupId
 * @property {string} name
 * @property {boolean} active
 * @property {string | null} brand
 * @property {string | null} displayName
 * @property {boolean} isOnSite
 * @property {Array<{ code: string; name: string; value: string | null }>} properties
 * @property {string[]} categoryIds
 * @property {string[]} imagePaths
 */

/**
 * @typedef {object} CatalogStockRow
 * @property {string} productId
 * @property {string} warehouseId
 * @property {number} qty
 */

/**
 * @typedef {object} CatalogExpectedStockRow
 * @property {string} productId
 * @property {string} warehouseId
 * @property {number} expectedQty
 */

/**
 * @typedef {object} ParsedCatalogXml
 * @property {CatalogCategoryRow[]} categories
 * @property {CatalogGroupRow[]} groups
 * @property {CatalogPriceTypeRow[]} priceTypes
 * @property {CatalogProductRow[]} products
 * @property {CatalogStockRow[]} stocks
 * @property {CatalogExpectedStockRow[]} expectedStocks
 * @property {Set<string>} warehouseIds
 */

function attrsToRecord(attrs) {
  /** @type {Record<string, string>} */
  const o = {};
  if (!attrs) return o;
  for (const [k, v] of Object.entries(attrs)) {
    o[k] = String(v ?? "");
  }
  return o;
}

function pickAttr(attrs, ...keys) {
  for (const k of keys) {
    if (attrs[k] != null && String(attrs[k]).trim() !== "") return String(attrs[k]).trim();
  }
  return "";
}

/**
 * SAX-парсинг catalog1.xml (один проход, буферизация секций до Товаров).
 * @param {string} filePath
 * @returns {Promise<ParsedCatalogXml>}
 */
export function parseCatalogXmlFile(filePath) {
  return new Promise((resolve, reject) => {
    /** @type {CatalogCategoryRow[]} */
    const categories = [];
    /** @type {CatalogGroupRow[]} */
    const groups = [];
    /** @type {CatalogPriceTypeRow[]} */
    const priceTypes = [];
    /** @type {CatalogProductRow[]} */
    const products = [];
    /** @type {CatalogStockRow[]} */
    const stocks = [];
    /** @type {CatalogExpectedStockRow[]} */
    const expectedStocks = [];
    const warehouseIds = new Set();

    const parser = sax.createStream(true, { trim: true, normalize: true });
    const stack = [];
    let textBuf = "";

    /** @type {CatalogProductRow | null} */
    let curProduct = null;
    let inProductProperties = false;
    let inProductCategories = false;
    let inProductImages = false;
    let inStocks = false;
    let inExpectedStocks = false;
    /** @type {string | null} */
    let curStockProductId = null;
    let inStockWarehouses = false;
    /** @type {string | null} */
    let curExpectedProductId = null;
    let inExpectedWarehouses = false;

    const flushText = () => {
      textBuf = "";
    };

    parser.on("opentag", (node) => {
      const name = node.name;
      const attrs = attrsToRecord(node.attributes);
      stack.push(name);

      if (name === "Раздел" && stack.length >= 2 && stack[stack.length - 2] === "Разделы" && !curProduct) {
        const id = normUuid(pickAttr(attrs, "Код", "код"));
        if (!id) return;
        const parentRaw = pickAttr(attrs, "КодРодителя", "кодродителя");
        categories.push({
          id,
          name: pickAttr(attrs, "Название", "название") || id,
          parentId: normUuid(parentRaw),
          raw: attrs,
        });
        return;
      }

      if (name === "Группа" && stack.includes("Группы") && !stack.includes("Товары")) {
        const id = normUuid(pickAttr(attrs, "Код", "код"));
        if (!id) return;
        groups.push({
          id,
          parentId: normUuid(pickAttr(attrs, "Родитель", "родитель")),
        });
        return;
      }

      if (name === "ТипЦены" && stack.includes("ТипыЦен")) {
        const id = normUuid(pickAttr(attrs, "КодЦены", "кодцены"));
        if (!id) return;
        priceTypes.push({
          id,
          name: pickAttr(attrs, "Название", "название") || id,
        });
        return;
      }

      if (name === "Товар" && stack.includes("Товары")) {
        const id = normUuid(pickAttr(attrs, "Код", "код"));
        if (!id) return;
        const g = normUuid(pickAttr(attrs, "Группа", "группа"));
        curProduct = {
          id,
          groupId: g,
          name: pickAttr(attrs, "Название", "название") || id,
          active: pickAttr(attrs, "Активность", "активность").toUpperCase() === "Y",
          brand: null,
          displayName: null,
          isOnSite: false,
          properties: [],
          categoryIds: [],
          imagePaths: [],
        };
        inProductProperties = false;
        inProductCategories = false;
        inProductImages = false;
        return;
      }

      if (name === "Свойства" && curProduct) {
        inProductProperties = true;
        return;
      }
      if (name === "Свойство" && curProduct && inProductProperties) {
        const code = normUuid(pickAttr(attrs, "Код", "код"));
        if (!code) return;
        const propName = pickAttr(attrs, "Название", "название");
        const value = pickAttr(attrs, "Значение", "значение") || null;
        curProduct.properties.push({ code, name: propName, value });
        const n = propName.trim().toLowerCase();
        if (n === "бренд" && value) curProduct.brand = value;
        if (n === "название для сайта" && value) curProduct.displayName = value;
        if (n === "сайт тандор" && value.trim().toLowerCase() === "да") curProduct.isOnSite = true;
        return;
      }

      if (name === "Разделы" && curProduct) {
        inProductCategories = true;
        return;
      }
      if (name === "Раздел" && curProduct && inProductCategories) {
        const cid = normUuid(pickAttr(attrs, "Код", "код"));
        if (cid) curProduct.categoryIds.push(cid);
        return;
      }

      if (name === "Картинки" && curProduct) {
        inProductImages = true;
        return;
      }

      if (name === "ОстаткиСклада") {
        inStocks = true;
        return;
      }
      if (name === "Остаток" && inStocks && !inExpectedStocks) {
        curStockProductId = normUuid(pickAttr(attrs, "Код", "код"));
        inStockWarehouses = false;
        return;
      }
      if (name === "Склады" && inStocks && curStockProductId) {
        inStockWarehouses = true;
        return;
      }
      if (name === "Склад" && inStocks && inStockWarehouses && curStockProductId) {
        const wh = normUuid(pickAttr(attrs, "СкладID", "складid", "СкладId"));
        if (!wh) return;
        warehouseIds.add(wh);
        const qty = Number(pickAttr(attrs, "Количество", "количество").replace(",", "."));
        stocks.push({
          productId: curStockProductId,
          warehouseId: wh,
          qty: Number.isFinite(qty) ? qty : 0,
        });
        return;
      }

      if (name === "ОжидаемыеОстаткиСклада") {
        inExpectedStocks = true;
        return;
      }
      if (name === "Остаток" && inExpectedStocks) {
        curExpectedProductId = normUuid(pickAttr(attrs, "Код", "код"));
        inExpectedWarehouses = false;
        return;
      }
      if (name === "Склады" && inExpectedStocks && curExpectedProductId) {
        inExpectedWarehouses = true;
        return;
      }
      if (name === "Склад" && inExpectedStocks && inExpectedWarehouses && curExpectedProductId) {
        const wh = normUuid(pickAttr(attrs, "СкладID", "складid", "СкладId"));
        if (!wh) return;
        warehouseIds.add(wh);
        const qty = Number(pickAttr(attrs, "Количество", "количество").replace(",", "."));
        expectedStocks.push({
          productId: curExpectedProductId,
          warehouseId: wh,
          expectedQty: Number.isFinite(qty) ? qty : 0,
        });
      }
    });

    parser.on("text", (t) => {
      if (inProductImages && curProduct && stack[stack.length - 1] === "Картинка") {
        textBuf += t;
      }
    });

    parser.on("closetag", (name) => {
      if (name === "Картинка" && curProduct && inProductImages) {
        const p = normPath(textBuf);
        if (p) curProduct.imagePaths.push(p);
        flushText();
      }
      if (name === "Картинки" && curProduct) inProductImages = false;
      if (name === "Разделы" && curProduct) inProductCategories = false;
      if (name === "Свойства" && curProduct) inProductProperties = false;

      if (name === "Товар" && curProduct) {
        products.push(curProduct);
        curProduct = null;
      }

      if (name === "Склады" && inStocks && curStockProductId) inStockWarehouses = false;
      if (name === "Остаток" && inStocks && !inExpectedStocks) curStockProductId = null;
      if (name === "ОстаткиСклада") inStocks = false;

      if (name === "Склады" && inExpectedStocks && curExpectedProductId) inExpectedWarehouses = false;
      if (name === "Остаток" && inExpectedStocks) curExpectedProductId = null;
      if (name === "ОжидаемыеОстаткиСклада") inExpectedStocks = false;

      stack.pop();
    });

    parser.on("error", (e) => reject(e));
    parser.on("end", () => {
      resolve({ categories, groups, priceTypes, products, stocks, expectedStocks, warehouseIds });
    });

    fs.createReadStream(filePath).pipe(parser);
  });
}
