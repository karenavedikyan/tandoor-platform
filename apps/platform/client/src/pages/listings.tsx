import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function ListingsPage() {
  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-8" data-testid="page-listings">
      <div className="space-y-3">
        <h1 className="text-xl font-semibold text-[#222631]" data-testid="text-listings-title">
          Листовки
        </h1>
        <p className="text-sm leading-relaxed text-[#8F96B0]" data-testid="text-listings-description">
          Раздел для размещения и распространения листовок. Здесь будут карточки листовок, загрузка PDF/изображений и
          публикация для команды продаж.
        </p>
        <p className="text-sm text-[#8F96B0]">
          Скоро здесь появится функционал. Если хотите задать структуру разделов — напишите пожелания.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button asChild className="bg-[#9ACA3C] text-[#222631] hover:bg-[#86B832]" data-testid="button-listings-home">
          <Link href="/main">Вернуться на главную</Link>
        </Button>
      </div>
    </div>
  );
}
