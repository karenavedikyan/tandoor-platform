import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function PreviewUnavailable() {
  return (
    <div className="mx-auto max-w-md py-8" data-testid="page-preview-unavailable">
      <Card className="border-border bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Раздел недоступен</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>Этот адрес сейчас не используется.</p>
          <Button asChild variant="outline" className="w-full border-border bg-card" data-testid="button-preview-unavailable-to-dealer">
            <Link href="/dealer-base">К клиентской базе</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
