import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

interface PaginationControlsProps {
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
  startIndex: number;
  endIndex: number;
  pageSizeOptions: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export default function PaginationControls({
  page,
  pageSize,
  totalPages,
  totalItems,
  startIndex,
  endIndex,
  pageSizeOptions,
  onPageChange,
  onPageSizeChange,
}: PaginationControlsProps) {
  if (totalItems === 0) return null;

  return (
    <div className="flex items-center justify-between gap-4 flex-wrap pt-3" data-testid="pagination-controls">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Showing {startIndex + 1}-{endIndex} of {totalItems}</span>
        <span className="mx-1">|</span>
        <span>Rows:</span>
        <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
          <SelectTrigger className="h-7 w-[70px] text-xs" data-testid="select-page-size">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pageSizeOptions.map(opt => (
              <SelectItem key={opt} value={String(opt)}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          disabled={page <= 1}
          onClick={() => onPageChange(1)}
          data-testid="button-first-page"
        >
          <ChevronsLeft className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          data-testid="button-prev-page"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="text-xs text-muted-foreground px-2 select-none">
          Page {page} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          data-testid="button-next-page"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          disabled={page >= totalPages}
          onClick={() => onPageChange(totalPages)}
          data-testid="button-last-page"
        >
          <ChevronsRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
