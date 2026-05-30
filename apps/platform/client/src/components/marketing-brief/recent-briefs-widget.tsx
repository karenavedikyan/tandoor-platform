import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { fetchRecentPublishedBriefs } from "@/lib/marketing-briefs-api";
import { isBriefNew } from "@/lib/marketing-briefs-utils";
import { Card } from "@/components/ui/card";

export function RecentBriefsWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ["marketing-briefs", "recent", 3],
    queryFn: () => fetchRecentPublishedBriefs(3),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading || !data || data.length === 0) return null;

  return (
    <Card className="p-4" data-testid="widget-recent-briefs">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#222631]">Свежие материалы маркетинга</h3>
        <Link href="/marketing-briefs" className="text-xs text-muted-foreground hover:text-[#222631]">
          Все →
        </Link>
      </div>
      <ul className="space-y-2">
        {data.map((b) => (
          <li key={b.id}>
            <Link
              href={`/marketing-briefs/${b.id}`}
              className="flex items-center justify-between gap-2 rounded-md px-2 py-2 hover:bg-muted"
              data-testid={`link-recent-brief-${b.id}`}
            >
              <span className="truncate text-sm text-[#222631]">{b.title}</span>
              {isBriefNew(b.published_at) && (
                <span className="shrink-0 rounded-full bg-[#9ACA3C] px-2 py-0.5 text-xs font-medium text-[#222631]">
                  Новое
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
