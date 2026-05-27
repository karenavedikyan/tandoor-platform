import { useEffect, useState } from "react";
import { Link } from "wouter";
import { fetchTradePointLegalEntityLink } from "@/lib/legal-entities-payment-api";
import { buildHashPath } from "@/lib/hash-route-utils";

type Props = {
  dealerId: string;
  tradePointId: string;
};

export function TradePointLegalEntityLink({ dealerId, tradePointId }: Props) {
  const [name, setName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchTradePointLegalEntityLink(tradePointId).then((link) => {
      if (cancelled) return;
      setName(link?.legalEntity.name?.trim() || null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [tradePointId]);

  if (loading) return null;
  if (!name) return null;

  const href = buildHashPath(`/dealers/${dealerId}`, { section: "payment_requisites" });

  return (
    <p className="text-sm text-muted-foreground" data-testid="trade-point-legal-entity-link">
      Юрлицо:{" "}
      <Link href={href} className="font-medium text-primary underline-offset-4 hover:underline">
        {name}
      </Link>
    </p>
  );
}
