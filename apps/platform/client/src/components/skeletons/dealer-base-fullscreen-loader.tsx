import type { ReactElement } from "react";
import {
  BrandDistributionLoader,
  type BrandDistributionLoaderProgress,
} from "@/components/distribution/brand-distribution-loader";

interface DealerBaseFullscreenLoaderProps {
  progress?: BrandDistributionLoaderProgress;
}

/**
 * Полноэкранный фирменный лоадер первичной загрузки /dealer-base.
 * Показывается вместо серых скелетонов, пока грузятся основные данные страницы.
 */
export function DealerBaseFullscreenLoader({ progress }: DealerBaseFullscreenLoaderProps): ReactElement {
  return (
    <div
      data-testid="dealer-base-fullscreen-loader"
      className="flex min-h-[70vh] w-full flex-col items-center justify-center bg-background px-4 py-16"
    >
      <div className="w-full max-w-sm">
        <BrandDistributionLoader
          size="md"
          progress={progress}
          testIdPrefix="dealer-base-page"
          hideCaption
        />
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Готовим точную информацию по команде
        </p>
      </div>
    </div>
  );
}
