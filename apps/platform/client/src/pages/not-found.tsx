import { Link } from "wouter";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="flex justify-center py-12" data-testid="page-not-found">
      <Card className="w-full max-w-md border-neutral-200/80 bg-white shadow-sm">
        <CardContent className="space-y-4 pt-6">
          <div className="flex gap-3">
            <AlertCircle className="h-8 w-8 shrink-0 text-red-500" aria-hidden />
            <div>
              <h1 className="text-xl font-semibold text-foreground">Страница не найдена</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Такого маршрута нет в preview-режиме. Проверьте адрес или вернитесь к первому этапу.
              </p>
            </div>
          </div>
          <Button variant="outline" asChild className="w-full border-neutral-200 bg-white" data-testid="button-not-found-to-stage">
            <Link href="/dealer-card-foundation">К первому этапу</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
