import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Eye, Archive } from "lucide-react";
import type { Invoice } from "@shared/schema";

type InvoiceWithCategories = Invoice & { all_categories: string[] };

export default function Invoices() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"active" | "archived">("active");
  const { data: invoices = [], isLoading } = useQuery<InvoiceWithCategories[]>({ queryKey: ["/api/invoices"] });

  const archivedCount = useMemo(() => invoices.filter(inv => inv.status === "archived").length, [invoices]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    invoices.forEach(inv => {
      if (inv.all_categories && inv.all_categories.length > 0) {
        inv.all_categories.forEach(c => set.add(c));
      }
    });
    return Array.from(set).sort();
  }, [invoices]);

  const filtered = useMemo(() => {
    return invoices.filter(inv => {
      if (viewMode === "archived") return inv.status === "archived";
      if (inv.status === "archived") return false;

      const matchesSearch = inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
        inv.customer_name.toLowerCase().includes(search.toLowerCase()) ||
        inv.company_name.toLowerCase().includes(search.toLowerCase()) ||
        inv.order_number.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || inv.status === statusFilter;
      const matchesCategory = categoryFilter === "all" ||
        (inv.all_categories && inv.all_categories.includes(categoryFilter));
      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [invoices, search, statusFilter, categoryFilter, viewMode]);

  const statusColors: Record<string, string> = {
    paid: "default",
    pending: "secondary",
    "partial-paid": "default",
    overdue: "destructive",
    cancelled: "secondary",
    archived: "secondary",
  };

  const statusCustomStyles: Record<string, string> = {
    "partial-paid": "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100",
    archived: "bg-slate-200 text-slate-600 border-slate-300",
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold" data-testid="text-invoices-title">Invoices</h1>
          <div className="flex rounded-lg border overflow-hidden">
            <button
              onClick={() => setViewMode("active")}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${viewMode === "active" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-accent"}`}
            >
              Active
            </button>
            <button
              onClick={() => setViewMode("archived")}
              className={`px-3 py-1.5 text-sm font-medium transition-colors flex items-center gap-1.5 ${viewMode === "archived" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-accent"}`}
            >
              <Archive className="h-3.5 w-3.5" />
              Archived{archivedCount > 0 ? ` (${archivedCount})` : ""}
            </button>
          </div>
        </div>
        <Link href="/invoices/create">
          <Button data-testid="button-create-invoice"><Plus className="h-4 w-4 mr-2" />Create Invoice</Button>
        </Link>
      </div>

      {viewMode === "active" && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-10" placeholder="Search invoices..." value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-search-invoices" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]" data-testid="select-invoice-status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="partial-paid">Partial Paid</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>

          {categories.length > 0 && (
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[165px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      <div className="text-xs text-muted-foreground">
        {viewMode === "archived"
          ? `${filtered.length} archived invoice${filtered.length !== 1 ? "s" : ""}`
          : `Showing ${filtered.length} of ${invoices.length - archivedCount} invoice${(invoices.length - archivedCount) !== 1 ? "s" : ""}`
        }
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">{viewMode === "archived" ? "No archived invoices" : "No invoices found"}</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((invoice) => (
            <Link key={invoice.id} href={`/invoices/${invoice.id}`}>
              <Card className="hover-elevate cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm" data-testid={`text-invoice-number-${invoice.id}`}>{invoice.invoice_number}</h3>
                        <Badge variant={(statusColors[invoice.status] || "secondary") as any} className={statusCustomStyles[invoice.status] || ""}>{invoice.status}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{invoice.company_name} - {invoice.customer_name}</p>
                      <p className="text-xs text-muted-foreground">Order: {invoice.order_number} | {new Date(invoice.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <div>
                        <p className="text-lg font-bold" data-testid={`text-invoice-total-${invoice.id}`}>${Number(invoice.total).toLocaleString()}</p>
                        {Number(invoice.discount_amount) > 0 && (
                          <p className="text-xs text-green-600">Discount: -${Number(invoice.discount_amount).toLocaleString()}</p>
                        )}
                      </div>
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
