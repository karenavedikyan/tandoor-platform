import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background">
      <Card className="mx-4 w-full max-w-md border-border bg-card">
        <CardContent className="pt-6">
          <div className="mb-4 flex gap-2">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <h1 className="text-2xl font-bold text-foreground">404 Страница не найдена</h1>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            Такой страницы в платформе не существует.
          </p>
          <Button asChild className="mt-4" data-testid="button-back-dashboard">
            <Link href="/">Перейти в дашборд</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
