import { Link } from "wouter";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="flex justify-center py-12" data-testid="page-not-found">
      <Card className="w-full max-w-md border-border bg-card shadow-sm">
        <CardContent className="space-y-4 pt-6">
          <div className="flex gap-3">
            <AlertCircle className="h-8 w-8 shrink-0 text-red-500" aria-hidden />
            <div>
              <h1 className="text-xl font-semibold text-foreground">Страница не найдена</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Проверьте адрес в строке браузера или вернитесь к клиентской базе.
              </p>
            </div>
          </div>
          <Button variant="outline" asChild className="w-full border-border bg-card" data-testid="button-back-to-dealer-base">
            <Link href="/dealer-base">К клиентской базе</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
