import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/**
 * Skeleton «Пользователи и доступ» (foundation). Рабочие действия — в следующих PR.
 */
export default function UsersAndAccessPage() {
  return (
    <div className="mx-auto max-w-[1200px] space-y-6" data-testid="page-users-and-access">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-[#222631]">Пользователи и доступ</h1>
        <p className="text-sm text-[#8F96B0]">Раздел только для просмотра на этапе foundation.</p>
      </div>

      <Alert className="border-[#E3E6F3] bg-[#F7F8FC] text-[#222631]">
        <AlertTitle>Foundation подключён</AlertTitle>
        <AlertDescription>
          Рабочие действия (приглашения, роли, команды) будут добавлены в следующих PR блока auth. См.{" "}
          <span className="font-mono text-xs">docs/auth-access-foundation.md</span>.
        </AlertDescription>
      </Alert>

      <div className="overflow-hidden rounded-lg border border-[#E3E6F3] bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>ФИО</TableHead>
              <TableHead>Роль</TableHead>
              <TableHead>Команда</TableHead>
              <TableHead>Город / регион</TableHead>
              <TableHead>Телефон</TableHead>
              <TableHead>Статус профиля</TableHead>
              <TableHead>Последний вход</TableHead>
              <TableHead>Кто пригласил</TableHead>
              <TableHead>Дата приглашения</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={9} className="h-24 text-center text-sm text-muted-foreground">
                Нет данных — таблица будет заполнена после подключения серверной модели пользователей.
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
