import { useQuery } from "@tanstack/react-query";

export type WholesaleEmployeePickerRow = {
  employeeGuid: string;
  fullName: string;
  position: string | null;
  inRoster: boolean;
  accountLinkState: string;
  assignmentTypes: string[];
  clientCount: number;
};

const WHOLESALE_EMPLOYEES_KEY = ["wholesale-employees"] as const;

export function wholesaleEmployeesQueryKey() {
  return WHOLESALE_EMPLOYEES_KEY;
}

export function useWholesaleEmployees(enabled: boolean) {
  return useQuery({
    queryKey: WHOLESALE_EMPLOYEES_KEY,
    queryFn: async (): Promise<WholesaleEmployeePickerRow[]> => {
      const res = await fetch("/api/dealers/wholesale-employees", { credentials: "include" });
      const body = (await res.json()) as {
        success?: boolean;
        employees?: WholesaleEmployeePickerRow[];
        message?: string;
      };
      if (!res.ok || !body.success || !body.employees) {
        throw new Error(body.message ?? "Не удалось загрузить сотрудников ОПТ.");
      }
      return body.employees;
    },
    enabled,
    staleTime: 60_000,
  });
}
