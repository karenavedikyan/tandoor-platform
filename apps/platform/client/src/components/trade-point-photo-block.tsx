"use client";

import type { ReactElement } from "react";
import { useReleaseDemoProfile } from "@/hooks/use-release-demo-profile";
import { EntityActualizationPhotoGallery } from "@/components/entity-actualization-photo-gallery";

type Props = {
  dealerId: string;
  tradePointId: string;
  canEdit: boolean;
  className?: string;
  /** Компактный вид в списках clean-актуализации */
  compact?: boolean;
};

/**
 * Фото торговой точки в актуализации: URL в состоянии, без base64 в localStorage.
 * `dealerId` сохранён в пропсах для совместимости с существующими вызовами и тестами.
 */
export function TradePointPhotoBlock({ dealerId, tradePointId, canEdit, className, compact }: Props): ReactElement {
  void dealerId;
  const { profile } = useReleaseDemoProfile();
  return (
    <EntityActualizationPhotoGallery
      entityType="trade_point"
      entityId={tradePointId}
      canEdit={canEdit}
      profile={profile}
      compact={compact}
      className={className}
    />
  );
}
