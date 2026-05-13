/**
 * Координаты по адресу клиента (импорт CSV).
 * Генерация: node scripts/geocode-release-client-addresses.mjs --import-address-csv
 */
export type ReleaseClientAddressCoordinateEntry = { lat: number; lng: number; source: "address" };

export const RELEASE_CLIENT_ADDRESS_COORDINATES: Record<string, ReleaseClientAddressCoordinateEntry> = {
  "client-ma-ma085093": { lat: 44.9880694, lng: 34.152904, source: "address" as const },
};
