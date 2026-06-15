/**
 * Плоский и иерархический список пользователей для /admin/users (только представление).
 */

import { Fragment, type Dispatch, type ReactNode, type SetStateAction } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { UserRole, UserStatus } from "@shared/auth";
import type { AdminUser, ListUsersResult } from "@/lib/admin-users-api";
import { formatDisplayDateTime } from "@/lib/format-display-date";
import type { UserHierarchyResult } from "@/lib/admin-users-hierarchy";

const rolesRu: Record<UserRole, string> = {
  director: "Директор",
  rop: "РОП",
  regional_manager: "Региональный менеджер",
  manager: "Менеджер",
  marketer: "Маркетолог",
  analyst: "Аналитик",
  category_manager: "Категорийный менеджер",
  admin: "Администратор",
};

function roleBadgeClass(role: UserRole): string {
  if (role === "admin") return "border-transparent bg-foreground text-background";
  if (role === "director") return "border-primary/30 bg-primary/10 text-primary";
  if (role === "rop") return "border-blue-200 bg-blue-100 text-blue-700";
  if (role === "manager" || role === "regional_manager") return "border-secondary-border bg-secondary text-secondary-foreground";
  if (role === "marketer" || role === "analyst") return "border-border bg-muted text-muted-foreground";
  return "border-border bg-muted text-muted-foreground";
}

function userStatusBadge(status: UserStatus) {
  if (status === "active") {
    return (
      <span className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
        Активен
      </span>
    );
  }
  if (status === "invited") {
    return (
      <span className="inline-flex rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
        Приглашён
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground line-through">
      Отключён
    </span>
  );
}

export type AdminUsersListingProps = {
  hierarchyMode: boolean;
  hierarchy: UserHierarchyResult | null;
  expandedRop: Record<string, boolean>;
  setExpandedRop: Dispatch<SetStateAction<Record<string, boolean>>>;
  listQ: UseQueryResult<ListUsersResult, Error>;
  actionsSlot: (row: AdminUser, triggerTestId?: string) => ReactNode;
  telegramSlot: (row: AdminUser) => ReactNode;
};

function mobileSummary(row: AdminUser) {
  return (
    <div className="min-w-0 flex-1">
      <p className="font-medium text-foreground">{row.fullName}</p>
      <Tooltip>
        <TooltipTrigger asChild>
          <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{row.email}</p>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-sm break-all">
          {row.email}
        </TooltipContent>
      </Tooltip>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-xs font-medium", roleBadgeClass(row.role))}>
          {rolesRu[row.role] ?? row.role}
        </span>
        {userStatusBadge(row.status)}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Создан: {formatDisplayDateTime(row.createdAt)}</p>
    </div>
  );
}

export function AdminUsersMobilePanels(props: AdminUsersListingProps) {
  const { hierarchyMode, hierarchy, expandedRop, setExpandedRop, listQ, actionsSlot } = props;

  return (
    <div className="grid gap-3 md:hidden">
      {listQ.isLoading ? (
        <div className="rounded-lg border border-card-border bg-card p-6 text-center text-sm text-muted-foreground">Загрузка…</div>
      ) : null}
      {listQ.isError ? (
        <div className="rounded-lg border border-destructive/40 bg-card p-6 text-center text-sm text-destructive">Не удалось загрузить список.</div>
      ) : null}
      {!listQ.isLoading && listQ.data && listQ.data.users.length === 0 ? (
        <div className="rounded-lg border border-card-border bg-card p-6 text-center text-sm text-muted-foreground">Пользователи не найдены.</div>
      ) : null}

      {hierarchyMode && hierarchy ? (
        <>
          {hierarchy.roots.map((root) => (
            <Fragment key={root.key}>
              <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                <div className="flex items-start gap-2">
                  {root.salesRole === "team_lead" && root.children.length > 0 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-11 min-h-11 w-11 shrink-0 text-muted-foreground hover:bg-muted"
                      aria-expanded={Boolean(expandedRop[root.user.id])}
                      aria-label={expandedRop[root.user.id] ? "Свернуть команду" : "Развернуть команду"}
                      onClick={() => setExpandedRop((prev) => ({ ...prev, [root.user.id]: !prev[root.user.id] }))}
                    >
                      <ChevronRight
                        className={cn("h-5 w-5 transition-transform motion-reduce:transition-none", expandedRop[root.user.id] && "rotate-90")}
                        aria-hidden
                      />
                    </Button>
                  ) : (
                    <span className="inline-block h-11 w-11 shrink-0" aria-hidden />
                  )}
                  <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
                    {mobileSummary(root.user)}
                    {actionsSlot(root.user)}
                  </div>
                </div>
              </div>
              {root.salesRole === "team_lead" && root.children.length > 0 && expandedRop[root.user.id]
                ? root.children.map((child) => (
                    <div
                      key={child.id}
                      className="ml-4 rounded-lg border border-border border-l border-border bg-secondary/40 p-4 pl-10 shadow-sm dark:bg-muted/30"
                    >
                      <div className="flex items-start justify-between gap-2">
                        {mobileSummary(child)}
                        {actionsSlot(child)}
                      </div>
                    </div>
                  ))
                : null}
            </Fragment>
          ))}
          {hierarchy.others.length > 0 ? (
            <>
              <div className="px-1 py-2 text-sm font-medium text-muted-foreground">Прочие</div>
              {hierarchy.others.map((row) => (
                <div key={row.id} className="rounded-lg border border-card-border bg-card p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    {mobileSummary(row)}
                    {actionsSlot(row)}
                  </div>
                </div>
              ))}
            </>
          ) : null}
        </>
      ) : (
        listQ.data?.users.map((row) => (
          <div key={row.id} className="rounded-lg border border-card-border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              {mobileSummary(row)}
              {actionsSlot(row)}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function desktopCoreCells(row: AdminUser) {
  return (
    <>
      <TableCell className="font-medium">{row.fullName}</TableCell>
      <TableCell className="max-w-[220px] font-mono text-sm">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="block truncate">{row.email}</span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-sm break-all">
            {row.email}
          </TooltipContent>
        </Tooltip>
      </TableCell>
      <TableCell>
        <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-xs font-medium", roleBadgeClass(row.role))}>
          {rolesRu[row.role] ?? row.role}
        </span>
      </TableCell>
      <TableCell>{userStatusBadge(row.status)}</TableCell>
      <TableCell className="text-sm text-muted-foreground">—</TableCell>
      <TableCell className="text-sm text-muted-foreground">{formatDisplayDateTime(row.createdAt)}</TableCell>
    </>
  );
}

export function AdminUsersDesktopPanels(props: AdminUsersListingProps) {
  const { hierarchyMode, hierarchy, expandedRop, setExpandedRop, listQ, actionsSlot, telegramSlot } = props;

  const colSpan = hierarchyMode ? 10 : 9;

  const tailCells = (row: AdminUser, triggerTestId?: string) => (
    <>
      <TableCell className="text-sm text-muted-foreground">{row.lastLoginAt ? formatDisplayDateTime(row.lastLoginAt) : "—"}</TableCell>
      <TableCell className="align-top">{telegramSlot(row)}</TableCell>
      <TableCell className="text-right">{actionsSlot(row, triggerTestId)}</TableCell>
    </>
  );

  return (
    <div className="hidden overflow-hidden rounded-lg border border-card-border bg-card shadow-sm md:block">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {hierarchyMode ? <TableHead className="w-10" aria-label="Разворот" /> : null}
            <TableHead>ФИО</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Роль</TableHead>
            <TableHead>Статус</TableHead>
            <TableHead>Команда</TableHead>
            <TableHead>Создан</TableHead>
            <TableHead>Последний вход</TableHead>
            <TableHead className="min-w-[200px]">Telegram user-id</TableHead>
            <TableHead className="min-w-[132px] text-right">Действия</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {listQ.isLoading ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={colSpan} className="h-24 text-center text-sm text-muted-foreground">
                Загрузка…
              </TableCell>
            </TableRow>
          ) : listQ.isError ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={colSpan} className="h-24 text-center text-sm text-destructive">
                Не удалось загрузить список.
              </TableCell>
            </TableRow>
          ) : listQ.data && listQ.data.users.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={colSpan} className="h-24 text-center text-sm text-muted-foreground">
                Пользователи не найдены.
              </TableCell>
            </TableRow>
          ) : hierarchyMode && hierarchy ? (
            <>
              {hierarchy.roots.map((root) => (
                <Fragment key={root.key}>
                  <TableRow className="bg-card hover:bg-muted/40">
                    {hierarchyMode ? (
                      <TableCell className="w-10 align-middle">
                        {root.salesRole === "team_lead" && root.children.length > 0 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-11 min-h-11 w-11 text-muted-foreground hover:bg-muted"
                            aria-expanded={Boolean(expandedRop[root.user.id])}
                            aria-label={expandedRop[root.user.id] ? "Свернуть команду" : "Развернуть команду"}
                            onClick={() => setExpandedRop((prev) => ({ ...prev, [root.user.id]: !prev[root.user.id] }))}
                          >
                            <ChevronRight
                              className={cn(
                                "h-5 w-5 transition-transform motion-reduce:transition-none",
                                expandedRop[root.user.id] && "rotate-90",
                              )}
                              aria-hidden
                            />
                          </Button>
                        ) : null}
                      </TableCell>
                    ) : null}
                    {desktopCoreCells(root.user)}
                    {tailCells(root.user, `button-user-actions-${root.user.id}`)}
                  </TableRow>
                  {root.salesRole === "team_lead" && root.children.length > 0 && expandedRop[root.user.id]
                    ? root.children.map((child) => (
                        <TableRow
                          key={child.id}
                          className="bg-secondary/40 hover:bg-muted/40 dark:bg-muted/30 [&>td:first-child]:border-l [&>td:first-child]:border-border [&>td:first-child]:pl-10"
                        >
                          {hierarchyMode ? <TableCell className="w-10" /> : null}
                          {desktopCoreCells(child)}
                          {tailCells(child, `button-user-actions-${child.id}`)}
                        </TableRow>
                      ))
                    : null}
                </Fragment>
              ))}
              {hierarchy.others.length > 0 ? (
                <>
                  <TableRow className="bg-muted/50 hover:bg-transparent">
                    <TableCell colSpan={colSpan} className="text-sm font-medium text-muted-foreground">
                      Прочие
                    </TableCell>
                  </TableRow>
                  {hierarchy.others.map((row) => (
                    <TableRow key={row.id} className="hover:bg-muted/40">
                      {hierarchyMode ? <TableCell className="w-10" /> : null}
                      {desktopCoreCells(row)}
                      {tailCells(row, `button-user-actions-${row.id}`)}
                    </TableRow>
                  ))}
                </>
              ) : null}
            </>
          ) : (
            listQ.data?.users.map((row) => (
              <TableRow key={row.id} className="hover:bg-muted/40">
                {desktopCoreCells(row)}
                {tailCells(row, `button-user-actions-${row.id}`)}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
