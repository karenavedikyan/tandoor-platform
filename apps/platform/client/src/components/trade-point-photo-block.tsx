import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  compressImageFileToDataUrl,
  getTradePointPhotoDataUrl,
  removeTradePointPhoto,
  setTradePointPhotoDataUrl,
  TRADE_POINT_PHOTO_EVENT,
} from "@/lib/trade-point-photo-storage";

type Props = {
  dealerId: string;
  tradePointId: string;
  canEdit: boolean;
  className?: string;
};

export function TradePointPhotoBlock({ dealerId, tradePointId, canEdit, className }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<string | null>(() => getTradePointPhotoDataUrl(dealerId, tradePointId));
  const [err, setErr] = useState("");

  useEffect(() => {
    const fn = () => setPhoto(getTradePointPhotoDataUrl(dealerId, tradePointId));
    window.addEventListener(TRADE_POINT_PHOTO_EVENT, fn);
    return () => window.removeEventListener(TRADE_POINT_PHOTO_EVENT, fn);
  }, [dealerId, tradePointId]);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setErr("");
    const r = await compressImageFileToDataUrl(f);
    if (!r.ok) {
      setErr(r.error);
      return;
    }
    setTradePointPhotoDataUrl(dealerId, tradePointId, r.dataUrl);
    setPhoto(r.dataUrl);
  };

  return (
    <div className={cn("space-y-2", className)}>
      {err ? <p className="text-xs font-medium text-destructive">{err}</p> : null}
      {photo ? (
        <img
          src={photo}
          alt=""
          className="max-h-48 w-full rounded-md border border-border/70 object-contain"
          data-testid={`img-trade-point-photo-${tradePointId}`}
        />
      ) : (
        <div
          className="flex min-h-[7rem] items-center justify-center rounded-md border border-dashed border-border/80 bg-muted/20 px-2 text-center text-xs text-muted-foreground"
          data-testid={`placeholder-trade-point-photo-${tradePointId}`}
        >
          Фото не добавлено
        </div>
      )}
      {canEdit ? (
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            data-testid={`input-trade-point-photo-${tradePointId}`}
            onChange={onFile}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-9 text-xs"
            data-testid={`button-trade-point-photo-add-${tradePointId}`}
            onClick={() => inputRef.current?.click()}
          >
            {photo ? "Изменить фото" : "Добавить фото"}
          </Button>
          {photo ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="min-h-9 text-xs"
              data-testid={`button-trade-point-photo-remove-${tradePointId}`}
              onClick={() => {
                removeTradePointPhoto(dealerId, tradePointId);
                setPhoto(null);
              }}
            >
              Удалить фото
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
