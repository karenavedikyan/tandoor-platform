/**
 * Фото дилеров и ТТ в ActualizationState (URL + метаданные, без base64).
 */

import type { ActualizationEntityPhoto, ActualizationState } from "@/lib/client-base-actualization-state";

export function isPhotoActive(p: ActualizationEntityPhoto): boolean {
  return !p.archivedAt?.trim();
}

export function listActiveDealerPhotos(act: ActualizationState, dealerId: string): ActualizationEntityPhoto[] {
  const list = act.dealerPhotosByDealerId[dealerId] ?? [];
  return list.filter(isPhotoActive).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.uploadedAt.localeCompare(b.uploadedAt));
}

export function listActiveTradePointPhotos(act: ActualizationState, tradePointId: string): ActualizationEntityPhoto[] {
  const list = act.tradePointPhotosByTradePointId[tradePointId] ?? [];
  return list.filter(isPhotoActive).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.uploadedAt.localeCompare(b.uploadedAt));
}

export function getDealerCoverPhoto(act: ActualizationState, dealerId: string): ActualizationEntityPhoto | null {
  const active = listActiveDealerPhotos(act, dealerId);
  const cover = active.find((p) => p.isCover);
  if (cover) return cover;
  return active[0] ?? null;
}

export function getTradePointCoverPhoto(act: ActualizationState, tradePointId: string): ActualizationEntityPhoto | null {
  const active = listActiveTradePointPhotos(act, tradePointId);
  const cover = active.find((p) => p.isCover);
  if (cover) return cover;
  return active[0] ?? null;
}

export function getDealerCoverDisplayUrls(act: ActualizationState, dealerId: string): { url: string; thumb: string } | null {
  const p = getDealerCoverPhoto(act, dealerId);
  if (!p) return null;
  const thumb = p.thumbnailUrl?.trim() || p.url;
  return { url: p.url, thumb };
}

export function getTradePointCoverDisplayUrls(act: ActualizationState, tradePointId: string): { url: string; thumb: string } | null {
  const p = getTradePointCoverPhoto(act, tradePointId);
  if (!p) return null;
  const thumb = p.thumbnailUrl?.trim() || p.url;
  return { url: p.url, thumb };
}

/** Снимает isCover у всех фото сущности одного типа. */
function clearCoverFlags(list: ActualizationEntityPhoto[]): ActualizationEntityPhoto[] {
  return list.map((p) => ({ ...p, isCover: false }));
}

/** Установить главное фото по id; остальные isCover=false. */
export function setDealerCoverPhoto(act: ActualizationState, dealerId: string, photoId: string): ActualizationState {
  const list = act.dealerPhotosByDealerId[dealerId] ?? [];
  const next = clearCoverFlags(list).map((p) => (p.id === photoId && isPhotoActive(p) ? { ...p, isCover: true } : p));
  return { ...act, dealerPhotosByDealerId: { ...act.dealerPhotosByDealerId, [dealerId]: next } };
}

export function setTradePointCoverPhoto(act: ActualizationState, tradePointId: string, photoId: string): ActualizationState {
  const list = act.tradePointPhotosByTradePointId[tradePointId] ?? [];
  const next = clearCoverFlags(list).map((p) => (p.id === photoId && isPhotoActive(p) ? { ...p, isCover: true } : p));
  return { ...act, tradePointPhotosByTradePointId: { ...act.tradePointPhotosByTradePointId, [tradePointId]: next } };
}

export function archiveDealerPhoto(
  act: ActualizationState,
  dealerId: string,
  photoId: string,
  archivedBy: string,
  archivedByName: string,
  archivedAt: string,
): ActualizationState {
  const list = act.dealerPhotosByDealerId[dealerId] ?? [];
  const wasCover = list.some((p) => p.id === photoId && p.isCover);
  const next = list.map((p) =>
    p.id === photoId
      ? { ...p, isCover: false, archivedAt, archivedBy, archivedByName }
      : p,
  );
  let st = { ...act, dealerPhotosByDealerId: { ...act.dealerPhotosByDealerId, [dealerId]: next } };
  if (wasCover) {
    const first = listActiveDealerPhotos(st, dealerId)[0];
    if (first) st = setDealerCoverPhoto(st, dealerId, first.id);
  }
  return st;
}

export function archiveTradePointPhoto(
  act: ActualizationState,
  tradePointId: string,
  photoId: string,
  archivedBy: string,
  archivedByName: string,
  archivedAt: string,
): ActualizationState {
  const list = act.tradePointPhotosByTradePointId[tradePointId] ?? [];
  const wasCover = list.some((p) => p.id === photoId && p.isCover);
  const next = list.map((p) =>
    p.id === photoId
      ? { ...p, isCover: false, archivedAt, archivedBy, archivedByName }
      : p,
  );
  let st = { ...act, tradePointPhotosByTradePointId: { ...act.tradePointPhotosByTradePointId, [tradePointId]: next } };
  if (wasCover) {
    const first = listActiveTradePointPhotos(st, tradePointId)[0];
    if (first) st = setTradePointCoverPhoto(st, tradePointId, first.id);
  }
  return st;
}

export function appendDealerPhoto(act: ActualizationState, dealerId: string, photo: ActualizationEntityPhoto): ActualizationState {
  const prev = act.dealerPhotosByDealerId[dealerId] ?? [];
  const activeBefore = prev.filter(isPhotoActive);
  const isFirstActive = activeBefore.length === 0;
  const newP: ActualizationEntityPhoto = { ...photo, isCover: false };
  let list = [...prev, newP];
  if (isFirstActive || photo.isCover) {
    list = list.map((p) => ({ ...p, isCover: isPhotoActive(p) && p.id === photo.id }));
  }
  return { ...act, dealerPhotosByDealerId: { ...act.dealerPhotosByDealerId, [dealerId]: list } };
}

export function appendTradePointPhoto(act: ActualizationState, tradePointId: string, photo: ActualizationEntityPhoto): ActualizationState {
  const prev = act.tradePointPhotosByTradePointId[tradePointId] ?? [];
  const activeBefore = prev.filter(isPhotoActive);
  const isFirstActive = activeBefore.length === 0;
  const newP: ActualizationEntityPhoto = { ...photo, isCover: false };
  let list = [...prev, newP];
  if (isFirstActive || photo.isCover) {
    list = list.map((p) => ({ ...p, isCover: isPhotoActive(p) && p.id === photo.id }));
  }
  return { ...act, tradePointPhotosByTradePointId: { ...act.tradePointPhotosByTradePointId, [tradePointId]: list } };
}

export function newActualizationPhotoId(): string {
  return `act-photo-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function patchDealerPhoto(
  act: ActualizationState,
  dealerId: string,
  photoId: string,
  patch: Partial<Pick<ActualizationEntityPhoto, "kind" | "title" | "comment" | "sortOrder">>,
): ActualizationState {
  const list = act.dealerPhotosByDealerId[dealerId] ?? [];
  const next = list.map((p) => (p.id === photoId ? { ...p, ...patch } : p));
  return { ...act, dealerPhotosByDealerId: { ...act.dealerPhotosByDealerId, [dealerId]: next } };
}

export function patchTradePointPhoto(
  act: ActualizationState,
  tradePointId: string,
  photoId: string,
  patch: Partial<Pick<ActualizationEntityPhoto, "kind" | "title" | "comment" | "sortOrder">>,
): ActualizationState {
  const list = act.tradePointPhotosByTradePointId[tradePointId] ?? [];
  const next = list.map((p) => (p.id === photoId ? { ...p, ...patch } : p));
  return { ...act, tradePointPhotosByTradePointId: { ...act.tradePointPhotosByTradePointId, [tradePointId]: next } };
}

/** Тип «фасад» + главное фото (быстрый action в UI). */
export function setDealerFacadeAndCover(act: ActualizationState, dealerId: string, photoId: string): ActualizationState {
  return setDealerCoverPhoto(patchDealerPhoto(act, dealerId, photoId, { kind: "facade" }), dealerId, photoId);
}

export function setTradePointFacadeAndCover(act: ActualizationState, tradePointId: string, photoId: string): ActualizationState {
  return setTradePointCoverPhoto(patchTradePointPhoto(act, tradePointId, photoId, { kind: "facade" }), tradePointId, photoId);
}
