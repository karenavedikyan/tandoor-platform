import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/** Публичный preview: раздел недоступен (например, бывшая страница архитектуры). */
export default function PreviewUnavailable() {
  return (
    <div className="mx-auto max-w-md py-8" data-testid="page-preview-unavailable">
      <Card className="border-neutral-200/80 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Раздел недоступен в preview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>Этот раздел не входит в текущий этап демонстрации.</p>
          <Button asChild variant="outline" className="w-full border-neutral-200 bg-white" data-testid="button-preview-unavailable-to-dealer">
            <Link href="/dealer-card-foundation">К первому этапу</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
