import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, Eye, X, Filter, Archive } from "lucide-react";
import type { Order } from "@shared/schema";

type OrderWithInvoice = Order & { invoice_status: string; all_services: string[]; all_categories: string[]; llc_types: Record<string, string> };

function OrderStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    completed: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800",
    "in-progress": "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
    pending: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
    cancelled: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
    archived: "bg-slate-200 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
  };
  return <Badge variant="secondary" className={colors[status] || ""}>{status}</Badge>;
}

function InvoiceStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    paid: "bg-emerald-100 text-emerald-800 border-emerald-200",
    "partial-paid": "bg-blue-100 text-blue-800 border-blue-200",
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
    overdue: "bg-red-100 text-red-800 border-red-200",
    cancelled: "bg-gray-100 text-gray-600 border-gray-200",
    archived: "bg-slate-200 text-slate-600 border-slate-300",
    unknown: "bg-gray-100 text-gray-500 border-gray-200",
  };
  return (
    <span className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full border ${colors[status] || colors.unknown}`}>
      Inv: {status}
    </span>
  );
}

export default function Orders() {
  const [search, setSearch] = useState("");
  const [orderStatus, setOrderStatus] = useState("all");
  const [invoiceStatus, setInvoiceStatus] = useState("all");
  const [referralFilter, setReferralFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"active" | "archived">("active");

  const { data: orders = [], isLoading } = useQuery<OrderWithInvoice[]>({ queryKey: ["/api/orders"] });

  const referrals = useMemo(() => {
    const set = new Set(orders.map(o => o.referral_name).filter(Boolean));
    return Array.from(set).sort();
  }, [orders]);

  const services = useMemo(() => {
    const set = new Set<string>();
    orders.forEach(o => {
      if (o.all_services && o.all_services.length > 0) {
        o.all_services.forEach(s => set.add(s));
      } else if (o.service_type) {
        set.add(o.service_type);
      }
    });
    return Array.from(set).sort();
  }, [orders]);

  const states = useMemo(() => {
    const set = new Set(orders.map(o => o.state).filter(s => s && s.trim()));
    return Array.from(set).sort();
  }, [orders]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    orders.forEach(o => {
      if (o.all_categories && o.all_categories.length > 0) {
        o.all_categories.forEach(c => set.add(c));
      }
    });
    return Array.from(set).sort();
  }, [orders]);

  const activeFilterCount = [orderStatus, invoiceStatus, referralFilter, serviceFilter, stateFilter, categoryFilter]
    .filter(f => f !== "all").length + (search ? 1 : 0);

  const clearFilters = () => {
    setSearch("");
    setOrderStatus("all");
    setInvoiceStatus("all");
    setReferralFilter("all");
    setServiceFilter("all");
    setStateFilter("all");
    setCategoryFilter("all");
  };

  const archivedCount = useMemo(() => orders.filter(o => o.status === "archived").length, [orders]);

  const filtered = useMemo(() => {
    return orders.filter(o => {
      if (viewMode === "archived") return o.status === "archived";
      if (o.status === "archived") return false;

      const s = search.toLowerCase();
      const allSvcText = (o.all_services || []).join(" ").toLowerCase();
      const matchesSearch = !s || 
        (o.order_number || "").toLowerCase().includes(s) ||
        (o.customer_name || "").toLowerCase().includes(s) ||
        (o.company_name || "").toLowerCase().includes(s) ||
        (o.service_type || "").toLowerCase().includes(s) ||
        allSvcText.includes(s) ||
        (o.state || "").toLowerCase().includes(s) ||
        (o.invoice_number || "").toLowerCase().includes(s) ||
        (o.referral_name && o.referral_name.toLowerCase().includes(s));
      const matchesOrderStatus = orderStatus === "all" || o.status === orderStatus;
      const matchesInvoiceStatus = invoiceStatus === "all" || o.invoice_status === invoiceStatus;
      const matchesReferral = referralFilter === "all" || o.referral_name === referralFilter;
      const matchesService = serviceFilter === "all" || 
        (o.all_services && o.all_services.includes(serviceFilter)) ||
        o.service_type === serviceFilter;
      const matchesState = stateFilter === "all" || o.state === stateFilter;
      const matchesCategory = categoryFilter === "all" ||
        (o.all_categories && o.all_categories.includes(categoryFilter));
      return matchesSearch && matchesOrderStatus && matchesInvoiceStatus && matchesReferral && matchesService && matchesState && matchesCategory;
    });
  }, [orders, search, orderStatus, invoiceStatus, referralFilter, serviceFilter, stateFilter, categoryFilter, viewMode]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold" data-testid="text-orders-title">Orders</h1>
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
        {activeFilterCount > 0 && viewMode === "active" && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
            <X className="h-4 w-4 mr-1" /> Clear {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""}
          </Button>
        )}
      </div>

      {viewMode === "active" && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-10"
              placeholder="Search by order#, invoice#, name, company, service, state, referral..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-4 w-4 text-muted-foreground" />

            <Select value={orderStatus} onValueChange={setOrderStatus}>
              <SelectTrigger className="w-[155px] h-9 text-sm">
                <SelectValue placeholder="Order Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Order Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            <Select value={invoiceStatus} onValueChange={setInvoiceStatus}>
              <SelectTrigger className="w-[165px] h-9 text-sm">
                <SelectValue placeholder="Invoice Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Invoice Status</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            {referrals.length > 0 && (
              <Select value={referralFilter} onValueChange={setReferralFilter}>
                <SelectTrigger className="w-[155px] h-9 text-sm">
                  <SelectValue placeholder="Referral" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Referrals</SelectItem>
                  {referrals.map(r => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {services.length > 1 && (
              <Select value={serviceFilter} onValueChange={setServiceFilter}>
                <SelectTrigger className="w-[180px] h-9 text-sm">
                  <SelectValue placeholder="Service" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Services</SelectItem>
                  {services.map(s => (
                    <SelectItem key={s} value={s}>{s.length > 30 ? s.slice(0, 30) + "..." : s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {categories.length > 0 && (
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[165px] h-9 text-sm">
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

            {states.length > 0 && (
              <Select value={stateFilter} onValueChange={setStateFilter}>
                <SelectTrigger className="w-[150px] h-9 text-sm">
                  <SelectValue placeholder="State" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All States</SelectItem>
                  {states.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      )}

      <div className="text-xs text-muted-foreground">
        {viewMode === "archived"
          ? `${filtered.length} archived order${filtered.length !== 1 ? "s" : ""}`
          : `Showing ${filtered.length} of ${orders.length - archivedCount} order${(orders.length - archivedCount) !== 1 ? "s" : ""}`
        }
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">No orders found</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((order) => {
            const displayServices = order.all_services && order.all_services.length > 0
              ? order.all_services
              : order.service_type ? [order.service_type] : [];

            return (
              <Link key={order.id} href={`/orders/${order.id}`}>
                <Card className="hover-elevate cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-sm">{order.order_number}</h3>
                          <OrderStatusBadge status={order.status} />
                          <InvoiceStatusBadge status={order.invoice_status} />
                        </div>
                        <div className="flex items-center gap-2 flex-wrap mt-1">
                          <p className="text-sm text-foreground">{order.company_name} - {order.customer_name}</p>
                          {order.referral_name && (
                            <Badge variant="outline" className="text-xs">Ref: {order.referral_name}</Badge>
                          )}
                        </div>
                        <div className="mt-1 overflow-hidden">
                          {displayServices.length <= 1 ? (
                            <div className="flex items-center gap-1 flex-wrap">
                              <p className="text-xs text-muted-foreground truncate">
                                {displayServices[0] || "No service"}
                                {order.state ? ` | ${order.state}` : ""}
                                {" | "}{order.invoice_number}
                                {" | "}{new Date(order.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              </p>
                              {displayServices[0] && order.llc_types?.[displayServices[0]] && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0 border-purple-300 text-purple-700 bg-purple-50">
                                  {order.llc_types[displayServices[0]] === "single-member" ? "SM" : "MM"}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <>
                              <div className="flex flex-wrap gap-1 mb-0.5 max-w-full overflow-hidden">
                                {displayServices.map((svc, i) => {
                                  const llcType = order.llc_types?.[svc];
                                  return (
                                    <span key={i} className="inline-flex items-center gap-0.5">
                                      <Badge variant="outline" className="text-[10px] font-normal px-1.5 py-0 shrink-0 max-w-full truncate">
                                        {svc}
                                      </Badge>
                                      {llcType && (
                                        <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0 border-purple-300 text-purple-700 bg-purple-50">
                                          {llcType === "single-member" ? "SM" : "MM"}
                                        </Badge>
                                      )}
                                    </span>
                                  );
                                })}
                              </div>
                              <p className="text-xs text-muted-foreground truncate">
                                {order.state ? `${order.state} | ` : ""}
                                {order.invoice_number}
                                {" | "}{new Date(order.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                      <Eye className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
