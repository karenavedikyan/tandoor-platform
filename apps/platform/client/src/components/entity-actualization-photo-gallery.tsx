"use client";

import type { ReactElement } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClientAvatar } from "@/components/ui/client-avatar";
import { SafeImage } from "@/components/safe-image";
import { useClientBaseActualization } from "@/context/client-base-actualization-context";
import { useCurrentUser } from "@/hooks/use-current-user";
import { toast } from "@/hooks/use-toast";
import { prepareImageFileForUpload } from "@/lib/client-image-upload-pipeline";
import { fetchUploadConfig, uploadClientBaseImagePair } from "@/lib/client-base-actualization-upload-api";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { userLabelFromProfile } from "@/lib/showcase-distribution-data";
import type { ActualizationEntityPhoto, ActualizationEntityPhotoKind } from "@/lib/client-base-actualization-state";
import {
  archiveDealerPhoto,
  archiveTradePointPhoto,
  appendDealerPhoto,
  appendTradePointPhoto,
  listActiveDealerPhotos,
  listActiveTradePointPhotos,
  newActualizationPhotoId,
  patchDealerPhoto,
  patchTradePointPhoto,
  setDealerCoverPhoto,
  setDealerFacadeAndCover,
  setTradePointCoverPhoto,
  setTradePointFacadeAndCover,
} from "@/lib/client-base-actualization-photos";
import { cn } from "@/lib/utils";
import { formatDisplayDateTime } from "@/lib/format-display-date";

const KIND_LABELS: Record<ActualizationEntityPhotoKind, string> = {
  facade: "Фасад",
  logo: "Логотип",
  showcase: "Витрина",
  interior: "Интерьер",
  other: "Другое",
};

const DEALER_KINDS: ActualizationEntityPhotoKind[] = ["facade", "logo", "showcase", "interior", "other"];
const TP_KINDS: ActualizationEntityPhotoKind[] = ["facade", "showcase", "interior", "other"];

export type EntityActualizationPhotoGalleryProps = {
  entityType: "dealer" | "trade_point";
  entityId: string;
  /** Имя клиента / название точки — для показа инициалов в фолбэк-аватаре, если фото нет. */
  entityName?: string;
  /** Стабильный сид для цвета фолбэк-аватара (обычно id владельца). */
  entitySeed?: string;
  canEdit: boolean;
  profile: ReleaseDemoProfile;
  className?: string;
  compact?: boolean;
};

export function EntityActualizationPhotoGallery(props: EntityActualizationPhotoGalleryProps): ReactElement {
  const { entityType, entityId, entityName, entitySeed, canEdit, profile, className, compact } = props;
  const actx = useClientBaseActualization();
  const { user } = useCurrentUser();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploadConfigured, setUploadConfigured] = useState<boolean | null>(null);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState<ActualizationEntityPhoto | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const c = await fetchUploadConfig();
      if (!cancelled) setUploadConfigured(c.configured);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const kindOptions = entityType === "dealer" ? DEALER_KINDS : TP_KINDS;

  const photos = useMemo(() => {
    if (entityType === "dealer") return listActiveDealerPhotos(actx.state, entityId);
    return listActiveTradePointPhotos(actx.state, entityId);
  }, [actx.state, entityType, entityId]);

  const emptyHint =
    entityType === "dealer"
      ? "Добавьте фото или логотип\nСделайте клиента узнаваемым"
      : "Добавьте фасад или витрину точки, чтобы быстро понимать формат магазина.";

  const uploaderId = (user?.id?.trim() || profile.personaUserId || "unknown").slice(0, 96);
  const uploaderName = userLabelFromProfile(profile);

  const runPersist = useCallback(
    async (msgOk: string, updater: Parameters<typeof actx.persist>[0]) => {
      const r = await actx.persist(updater);
      if (!r.success) {
        toast({ title: "Не удалось сохранить", description: "Повторите попытку позже.", variant: "destructive" });
        return false;
      }
      toast({ title: msgOk });
      return true;
    },
    [actx],
  );

  const onUploadFile = async (file: File) => {
    if (!actx.enabled) return;
    if (uploadConfigured === false) {
      toast({
        title: "Загрузка фото пока не настроена",
        description: "Нужен токен BLOB_READ_WRITE_TOKEN на сервере.",
        variant: "destructive",
      });
      return;
    }
    if (uploadConfigured === null) {
      toast({ title: "Проверьте настройки", description: "Подождите пару секунд и попробуйте снова." });
      return;
    }
    setUploading(true);
    try {
      const prep = await prepareImageFileForUpload(file);
      if (!prep.ok) {
        toast({ title: "Файл не подходит", description: prep.error, variant: "destructive" });
        return;
      }
      const up = await uploadClientBaseImagePair({
        image: prep.image,
        thumbnail: prep.thumbnail,
        fileName: file.name,
      });
      if (!up.success) {
        toast({
          title: "Ошибка загрузки",
          description: up.message,
          variant: "destructive",
        });
        return;
      }
      const iso = new Date().toISOString();
      const photo: ActualizationEntityPhoto = {
        id: newActualizationPhotoId(),
        entityId,
        entityType,
        url: up.url,
        thumbnailUrl: up.thumbnailUrl,
        fileName: file.name,
        mimeType: "image/jpeg",
        sizeBytes: prep.image.size,
        width: prep.width,
        height: prep.height,
        kind: "facade",
        isCover: false,
        uploadedAt: iso,
        uploadedBy: uploaderId,
        uploadedByName: uploaderName,
      };
      await runPersist("Фото добавлено", (prev) =>
        entityType === "dealer" ? appendDealerPhoto(prev, entityId, photo) : appendTradePointPhoto(prev, entityId, photo),
      );
    } finally {
      setUploading(false);
    }
  };

  const makeCover = async (photoId: string) => {
    const ok = await runPersist("Главное фото обновлено", (prev) =>
      entityType === "dealer" ? setDealerCoverPhoto(prev, entityId, photoId) : setTradePointCoverPhoto(prev, entityId, photoId),
    );
    if (ok) setLightbox(null);
  };

  const makeFacadeAndCover = async (photoId: string) => {
    const ok = await runPersist("Фасад установлен как главное фото", (prev) =>
      entityType === "dealer"
        ? setDealerFacadeAndCover(prev, entityId, photoId)
        : setTradePointFacadeAndCover(prev, entityId, photoId),
    );
    if (ok) setLightbox(null);
  };

  const archive = async (photoId: string) => {
    const iso = new Date().toISOString();
    const ok = await runPersist("Фото в архиве", (prev) =>
      entityType === "dealer"
        ? archiveDealerPhoto(prev, entityId, photoId, uploaderId, uploaderName, iso)
        : archiveTradePointPhoto(prev, entityId, photoId, uploaderId, uploaderName, iso),
    );
    if (ok) setLightbox((cur) => (cur?.id === photoId ? null : cur));
  };

  const patchKind = async (photoId: string, kind: ActualizationEntityPhotoKind) => {
    if (entityType === "trade_point" && kind === "logo") return;
    const r = await actx.persist((prev) =>
      entityType === "dealer"
        ? patchDealerPhoto(prev, entityId, photoId, { kind })
        : patchTradePointPhoto(prev, entityId, photoId, { kind }),
    );
    if (!r.success) {
      toast({ title: "Не удалось сохранить тип фото", variant: "destructive" });
      return;
    }
    setLightbox((cur) => (cur?.id === photoId ? { ...cur, kind } : cur));
  };

  return (
    <div className={cn("space-y-3", className)}>
      {uploadConfigured === false ? (
        <p className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-foreground">
          Загрузка фото пока не настроена. Фотографии из галереи по-прежнему отображаются; добавление новых недоступно до настройки хранилища.
        </p>
      ) : null}

      {photos.length === 0 ? (
        <div className="space-y-3" data-testid={`entity-photo-empty-${entityType}-${entityId}`}>
          {entityType === "dealer" && entityName && entityName.trim() ? (
            <div className="flex justify-center">
              <ClientAvatar
                name={entityName}
                seed={entitySeed ?? entityName}
                size={140}
                shape="square"
                className="rounded-2xl"
              />
            </div>
          ) : null}
          <div className="whitespace-pre-line rounded-lg border border-dashed border-border bg-card px-3 py-6 text-center text-sm text-muted-foreground">
            {emptyHint}
          </div>
        </div>
      ) : (
        <div className={cn("grid gap-3", compact ? "grid-cols-1" : "sm:grid-cols-2 lg:grid-cols-3")}>
          {photos.map((p) => {
            const thumb = p.thumbnailUrl?.trim() || p.url;
            return (
              <div
                key={p.id}
                className="space-y-2 rounded-lg border border-border bg-card p-2 shadow-sm"
                data-testid={`entity-photo-tile-${p.id}`}
              >
                <button
                  type="button"
                  className="relative aspect-square w-full overflow-hidden rounded-md border border-border bg-muted text-left outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-primary"
                  onClick={() => setLightbox(p)}
                >
                  <SafeImage src={thumb} alt={p.title || KIND_LABELS[p.kind]} className="absolute inset-0 h-full w-full" />
                  {p.isCover ? (
                    <span className="absolute left-1.5 top-1.5 rounded bg-primary px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary-foreground">
                      Главное фото
                    </span>
                  ) : null}
                </button>
                <div className="flex flex-wrap items-center gap-1">
                  <Badge variant="outline" className="border-primary/35 bg-card text-[10px] font-medium text-foreground">
                    {KIND_LABELS[p.kind]}
                  </Badge>
                </div>
                {canEdit ? (
                  <div className="space-y-2">
                    <Select value={p.kind} onValueChange={(v) => void patchKind(p.id, v as ActualizationEntityPhotoKind)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Тип" />
                      </SelectTrigger>
                      <SelectContent>
                        {kindOptions.map((k) => (
                          <SelectItem key={k} value={k} className="text-xs">
                            {KIND_LABELS[k]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex flex-col gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="h-8 w-full bg-primary text-xs font-semibold text-primary-foreground hover:bg-[#86B832]"
                        disabled={p.isCover}
                        onClick={() => void makeCover(p.id)}
                      >
                        Сделать главным
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 w-full border-primary/40 text-xs font-medium text-foreground hover:bg-primary/10"
                        onClick={() => void makeFacadeAndCover(p.id)}
                      >
                        Фасад и главное
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 w-full border-border text-xs text-foreground hover:bg-muted"
                        onClick={() => void archive(p.id)}
                      >
                        В архив
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {canEdit ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            className="hidden"
            data-testid={`input-entity-photo-${entityType}-${entityId}`}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void onUploadFile(f);
            }}
          />
          <Button
            type="button"
            size="sm"
            className="h-9 bg-primary font-semibold text-primary-foreground hover:bg-[#86B832] disabled:opacity-60"
            disabled={uploading || uploadConfigured === false}
            data-testid={`button-entity-photo-add-${entityType}-${entityId}`}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? "Загрузка…" : "Добавить фото"}
          </Button>
        </div>
      ) : null}

      <Dialog open={lightbox != null} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent className="max-h-[min(100dvh,48rem)] w-[calc(100vw-1rem)] max-w-lg overflow-y-auto border-border p-0 sm:max-w-2xl">
          {lightbox ? (
            <>
              <DialogHeader className="space-y-1 border-b border-border px-4 py-3 text-left">
                <DialogTitle className="text-base text-foreground">
                  {lightbox.title?.trim() || KIND_LABELS[lightbox.kind]}
                </DialogTitle>
                <p className="text-xs text-muted-foreground">{KIND_LABELS[lightbox.kind]}</p>
              </DialogHeader>
              <div className="max-h-[55vh] w-full overflow-hidden bg-muted/40 px-2 py-3 sm:max-h-[60vh]">
                <div className="relative mx-auto flex max-h-[52vh] max-w-full items-center justify-center sm:max-h-[58vh]">
                  <SafeImage
                    src={lightbox.url}
                    alt={lightbox.title || ""}
                    className="max-h-[52vh] max-w-full rounded-md sm:max-h-[58vh]"
                    objectFit="contain"
                  />
                </div>
              </div>
              <div className="space-y-2 px-4 py-3 text-sm text-foreground">
                {lightbox.comment?.trim() ? (
                  <p>
                    <span className="text-[10px] font-semibold uppercase text-muted-foreground">Комментарий</span>
                    <span className="mt-0.5 block whitespace-pre-wrap">{lightbox.comment}</span>
                  </p>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  Загрузил{lightbox.uploadedByName ? ` ${lightbox.uploadedByName}` : ""}
                  {lightbox.uploadedAt ? ` · ${formatDisplayDateTime(lightbox.uploadedAt)}` : ""}
                </p>
              </div>
              {canEdit ? (
                <DialogFooter className="flex-col gap-2 border-t border-border px-4 py-3 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="w-full bg-primary text-primary-foreground hover:bg-[#86B832] sm:w-auto"
                    disabled={lightbox.isCover}
                    onClick={() => void makeCover(lightbox.id)}
                  >
                    Сделать главным
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-full border-primary/40 sm:w-auto"
                    onClick={() => void makeFacadeAndCover(lightbox.id)}
                  >
                    Фасад и главное
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => void archive(lightbox.id)}
                  >
                    В архив
                  </Button>
                </DialogFooter>
              ) : null}
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
