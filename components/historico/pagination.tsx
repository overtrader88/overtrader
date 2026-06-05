"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  page: number;
  pageSize: number;
  total: number;
}

export function Pagination({ page, pageSize, total }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const go = (p: number) => {
    const next = new URLSearchParams(params.toString());
    if (p === 1) next.delete("page");
    else next.set("page", String(p));
    router.push(`${pathname}?${next.toString()}` as never, { scroll: false });
  };

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between gap-2 mt-4 flex-wrap">
      <div className="text-xs text-muted-foreground">
        Mostrando <b className="text-foreground">{start}-{end}</b> de{" "}
        <b className="text-foreground">{total}</b>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => go(page - 1)}
          aria-label="Página anterior"
        >
          <ChevronLeft className="h-3 w-3" />
          Anterior
        </Button>
        <span className="text-xs tabular-nums text-muted-foreground px-2">
          Página {page} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => go(page + 1)}
          aria-label="Próxima página"
        >
          Próxima
          <ChevronRight className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
