/**
 * GET /api/users/picker — списки РОП / РМ для dropdown.
 */

export type PickerUser = {
  id: string;
  full_name: string;
  role: string;
  status: string;
};

let ropCache: PickerUser[] | null = null;
let rmCache: PickerUser[] | null = null;
let managerCache: PickerUser[] | null = null;
let ropInflight: Promise<PickerUser[]> | null = null;
let rmInflight: Promise<PickerUser[]> | null = null;
let managerInflight: Promise<PickerUser[]> | null = null;

async function fetchPicker(role: "rop" | "regional_manager" | "manager"): Promise<PickerUser[]> {
  const res = await fetch(`/api/users/picker?role=${role}`, { credentials: "include" });
  const json = (await res.json()) as { success?: boolean; users?: PickerUser[] };
  if (!res.ok || !json.success || !Array.isArray(json.users)) {
    throw new Error(`picker ${role} failed: ${res.status}`);
  }
  return json.users;
}

export async function listRopPickerUsers(): Promise<PickerUser[]> {
  if (ropCache) return ropCache;
  if (!ropInflight) {
    ropInflight = fetchPicker("rop")
      .then((users) => {
        ropCache = users;
        return users;
      })
      .finally(() => {
        ropInflight = null;
      });
  }
  return ropInflight;
}

export async function listRegionalManagerPickerUsers(): Promise<PickerUser[]> {
  if (rmCache) return rmCache;
  if (!rmInflight) {
    rmInflight = fetchPicker("regional_manager")
      .then((users) => {
        rmCache = users;
        return users;
      })
      .finally(() => {
        rmInflight = null;
      });
  }
  return rmInflight;
}

export async function listManagerPickerUsers(): Promise<PickerUser[]> {
  if (managerCache) return managerCache;
  if (!managerInflight) {
    managerInflight = fetchPicker("manager")
      .then((users) => {
        managerCache = users;
        return users;
      })
      .finally(() => {
        managerInflight = null;
      });
  }
  return managerInflight;
}

export function invalidateUsersPickerCache(): void {
  ropCache = null;
  rmCache = null;
  managerCache = null;
}

export function pickerUserById(users: PickerUser[], id: string | null | undefined): PickerUser | null {
  if (!id?.trim()) return null;
  return users.find((u) => u.id === id) ?? null;
}
