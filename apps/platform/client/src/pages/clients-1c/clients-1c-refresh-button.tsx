import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { refreshClients1cMv } from "@/lib/clients-1c-api";

type Clients1cRefreshButtonProps = {
  onRefreshed?: () => void;
  testId?: string;
};

export function Clients1cRefreshButton({
  onRefreshed,
  testId = "btn-clients-1c-refresh",
}: Clients1cRefreshButtonProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    try {
      const res = await refreshClients1cMv();
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Не удалось обновить данные",
          description: res.message,
        });
        return;
      }
      toast({ title: "Данные обновлены" });
      onRefreshed?.();
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Ошибка обновления",
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => void onClick()}
      disabled={loading}
      data-testid={testId}
    >
      <RefreshCw className={loading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
      Обновить
    </Button>
  );
}
