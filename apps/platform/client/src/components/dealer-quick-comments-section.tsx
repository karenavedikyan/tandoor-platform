import { useCallback, useEffect, useMemo, useState } from "react";
import type { UserRole } from "@shared/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  addDealerComment,
  canEditDealerCardComments,
  DEALER_CARD_COMMENTS_EVENT,
  getDealerComments,
  type DealerCardCommentType,
} from "@/lib/dealer-card-comments";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { cn } from "@/lib/utils";

const TAB_OPTIONS: { id: DealerCardCommentType; label: string; placeholder: string }[] = [
  { id: "general", label: "В ленту", placeholder: "Комментарий по клиенту" },
  { id: "problem", label: "По проблеме", placeholder: "Комментарий по проблеме" },
  { id: "competitor", label: "По конкурентам", placeholder: "Комментарий по конкурентам" },
];

function formatCommentHead(iso: string, name: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return name;
  return `${m[3]}.${m[2]}.${m[1]} · ${name}`;
}

type Props = {
  row: DealerRow;
  profile: ReleaseDemoProfile;
  authRole?: UserRole | null;
  actorUserId: string;
  actorLabel: string;
  sectionDomId?: string;
  /** В анкете актуализации — без внешнего SectionTitle (заголовок в Accordion). */
  embedded?: boolean;
};

export function DealerQuickCommentsSection({
  row,
  profile,
  authRole,
  actorUserId,
  actorLabel,
  sectionDomId = "section-dealer-quick-comments",
  embedded = false,
}: Props) {
  const canEdit = canEditDealerCardComments(profile, row, authRole);
  const [activeTab, setActiveTab] = useState<DealerCardCommentType>("general");
  const [draftByType, setDraftByType] = useState<Record<DealerCardCommentType, string>>({
    general: "",
    problem: "",
    competitor: "",
  });
  const [commentsBump, setCommentsBump] = useState(0);

  useEffect(() => {
    const fn = () => setCommentsBump((n) => n + 1);
    window.addEventListener(DEALER_CARD_COMMENTS_EVENT, fn);
    return () => window.removeEventListener(DEALER_CARD_COMMENTS_EVENT, fn);
  }, []);

  const commentsForTab = useMemo(() => {
    void commentsBump;
    return getDealerComments(row.id).filter((c) => c.type === activeTab).slice(0, 5);
  }, [row.id, activeTab, commentsBump]);

  const draft = draftByType[activeTab];
  const activeMeta = TAB_OPTIONS.find((t) => t.id === activeTab) ?? TAB_OPTIONS[0];

  const submit = useCallback(() => {
    const body = draft.trim();
    if (!body) return;
    void addDealerComment(row.id, {
      type: activeTab,
      body,
      createdBy: actorUserId,
      createdByName: actorLabel,
    });
    setDraftByType((prev) => ({ ...prev, [activeTab]: "" }));
  }, [activeTab, actorLabel, actorUserId, draft, row.id]);

  if (!canEdit) return null;

  const inner = (
    <Card className="overflow-hidden rounded-lg border border-border/70 bg-card shadow-xs">
      <CardContent className="space-y-3 px-3 py-3 sm:px-4">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Тип комментария">
          {TAB_OPTIONS.map((tab) => (
            <Button
              key={tab.id}
              type="button"
              size="sm"
              variant={activeTab === tab.id ? "default" : "outline"}
              className={cn("min-h-8 text-xs font-semibold", activeTab === tab.id && "shadow-sm")}
              data-testid={`button-dealer-quick-comment-tab-${tab.id}`}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </Button>
          ))}
        </div>
        <div data-testid={`section-dealer-quick-comment-form-${activeTab}`} className="space-y-2">
          <Label htmlFor={`dealer-quick-comment-${activeTab}`} className="text-xs text-muted-foreground">
            {activeMeta.placeholder}
          </Label>
          <Textarea
            id={`dealer-quick-comment-${activeTab}`}
            value={draft}
            onChange={(e) => setDraftByType((prev) => ({ ...prev, [activeTab]: e.target.value }))}
            placeholder={activeMeta.placeholder}
            rows={2}
            className="min-h-[52px] resize-y text-sm"
            data-testid={`textarea-dealer-quick-comment-${activeTab}`}
          />
          <Button
            type="button"
            size="sm"
            className="min-h-9 w-full font-semibold sm:w-auto"
            data-testid={`button-dealer-quick-comment-add-${activeTab}`}
            disabled={!draft.trim()}
            onClick={submit}
          >
            Добавить комментарий
          </Button>
        </div>
        <div className="space-y-2 border-t border-border/60 pt-2.5" data-testid={`list-dealer-quick-comments-${activeTab}`}>
          {commentsForTab.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid={`text-dealer-quick-comments-empty-${activeTab}`}>
              Комментариев этого типа пока нет.
            </p>
          ) : (
            commentsForTab.map((c) => (
              <div
                key={c.id}
                data-testid={`row-dealer-quick-comment-${c.id}`}
                className="rounded-md border border-border/50 bg-muted/20 px-2.5 py-1.5 text-xs leading-relaxed"
              >
                <p className="text-[11px] font-semibold text-muted-foreground">{formatCommentHead(c.createdAt, c.createdByName)}</p>
                <p className="mt-0.5 text-sm text-foreground">{c.body}</p>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (embedded) {
    return (
      <div data-testid="section-dealer-quick-comments" className="space-y-2">
        {inner}
      </div>
    );
  }

  return (
    <section
      id={sectionDomId}
      data-testid="section-dealer-quick-comments"
      className="scroll-mt-28 space-y-2 sm:scroll-mt-32"
    >
      <div className="space-y-1">
        <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">Комментарии</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">Добавьте комментарий — по клиенту, проблеме или конкурентам.</p>
      </div>
      {inner}
    </section>
  );
}
