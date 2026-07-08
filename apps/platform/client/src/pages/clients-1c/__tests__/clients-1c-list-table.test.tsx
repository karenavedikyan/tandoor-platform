/** @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Clients1cListTable } from "@/pages/clients-1c/clients-1c-list-table";
import type { Clients1cListItem } from "@/lib/clients-1c-api";

const items: Clients1cListItem[] = [
  {
    holding_id_1c: "h1",
    holding_name: "Альфа",
    holding_inn: "7701000001",
    holding_city: "Москва",
    stores_count: 3,
    legals_count: 2,
    responsible_managers: ["Иванов"],
    regional_managers: ["Петров"],
    distribution_filled_count: 5,
    distribution_total_targets: 10,
    distribution_percent: 50,
    orders_last_90d_count: 4,
    orders_last_90d_amount: 120000,
    last_order_at: "2026-07-01T10:00:00.000Z",
  },
  {
    holding_id_1c: "h2",
    holding_name: "Бета",
    holding_inn: "7701000002",
    holding_city: "Казань",
    stores_count: 1,
    legals_count: 1,
    responsible_managers: ["Сидоров"],
    regional_managers: [],
    distribution_filled_count: 0,
    distribution_total_targets: 0,
    distribution_percent: 0,
    orders_last_90d_count: 0,
    orders_last_90d_amount: 0,
    last_order_at: null,
  },
  {
    holding_id_1c: "h3",
    holding_name: "Гамма",
    holding_inn: null,
    holding_city: "Самара",
    stores_count: 5,
    legals_count: 3,
    responsible_managers: ["Козлов", "Новиков"],
    regional_managers: ["Орлов"],
    distribution_filled_count: 8,
    distribution_total_targets: 12,
    distribution_percent: 67,
    orders_last_90d_count: 2,
    orders_last_90d_amount: 45000,
    last_order_at: "2026-06-20T08:00:00.000Z",
  },
];

describe("Clients1cListTable", () => {
  it("renders list columns for fake items", () => {
    render(<Clients1cListTable items={items} />);
    expect(screen.getByText("Клиент")).toBeTruthy();
    expect(screen.getByText("ТТ")).toBeTruthy();
    expect(screen.getByText("Ответственные")).toBeTruthy();
    expect(screen.getByText("Дистрибуция")).toBeTruthy();
    expect(screen.getByText("Заказы 90д")).toBeTruthy();
    expect(screen.getByText("Альфа")).toBeTruthy();
    expect(screen.getByText("Бета")).toBeTruthy();
    expect(screen.getByText("Гамма")).toBeTruthy();
  });
});
