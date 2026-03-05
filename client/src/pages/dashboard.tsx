import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { authFetch } from "@/lib/auth";
import { Users, ShoppingCart, FileText, DollarSign, Clock, ArrowRight, CheckCircle2, RefreshCw, Calendar, TrendingUp, AlertTriangle } from "lucide-react";
import { useState, useMemo } from "react";
import { usePagination } from "@/hooks/use-pagination";
import PaginationControls from "@/components/pagination-controls";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
} from "recharts";

function StatusBadge({ status, type }: { status: string; type: "order" | "invoice" }) {
  if (type === "order") {
    const colors: Record<string, string> = {
      completed: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800",
      "in-progress": "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
      pending: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
      cancelled: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
      archived: "bg-slate-200 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
    };
    return <Badge variant="secondary" className={colors[status] || ""}>{status}</Badge>;
  }
  const colors: Record<string, string> = {
    paid: "bg-green-100 text-green-800 border-green-200",
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
    "partial-paid": "bg-blue-100 text-blue-800 border-blue-200",
    overdue: "bg-red-100 text-red-800 border-red-200",
    cancelled: "bg-gray-100 text-gray-800 border-gray-200",
    archived: "bg-slate-200 text-slate-600 border-slate-300",
  };
  return <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border ${colors[status] || "bg-gray-100 text-gray-800"}`}>{status}</span>;
}

function getDateRange(preset: string): { startDate: string; endDate: string } {
  const now = new Date();
  const end = now.toISOString().split("T")[0];
  let start: Date;

  switch (preset) {
    case "7d":
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "30d":
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case "90d":
      start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case "6m":
      start = new Date(now);
      start.setMonth(start.getMonth() - 6);
      break;
    case "1y":
      start = new Date(now);
      start.setFullYear(start.getFullYear() - 1);
      break;
    case "thisMonth":
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "lastMonth": {
      const lastM = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      return { startDate: lastM.toISOString().split("T")[0], endDate: lastMEnd.toISOString().split("T")[0] };
    }
    case "all":
      return { startDate: "", endDate: "" };
    default:
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
  return { startDate: start.toISOString().split("T")[0], endDate: end };
}

function buildQS(sd: string, ed: string) {
  const params = new URLSearchParams();
  if (sd) params.set("startDate", sd);
  if (ed) params.set("endDate", ed);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

function formatChartDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;

  const isDollarMetric = (name: string) => {
    const lower = name.toLowerCase();
    return lower.includes("revenue") || lower.includes("profit") || lower.includes("cost") || lower.includes("collected") || lower.includes("invoiced") || lower.includes("cumulative revenue");
  };

  return (
    <div className="bg-popover border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium text-foreground mb-1">{formatChartDate(label)}</p>
      {payload.map((entry: any, idx: number) => (
        <p key={idx} style={{ color: entry.color }} className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          {entry.name}: {isDollarMetric(entry.name) ? `$${Number(entry.value).toLocaleString()}` : entry.value}
        </p>
      ))}
    </div>
  );
}

function OrdersChart({ data }: { data: any[] }) {
  if (!data.length) return <p className="text-sm text-muted-foreground text-center py-8">No data available for this period</p>;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <defs>
          <linearGradient id="ordersGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="cumOrdersGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="date" tickFormatter={formatChartDate} className="text-xs" tick={{ fontSize: 11 }} />
        <YAxis yAxisId="daily" className="text-xs" tick={{ fontSize: 11 }} />
        <YAxis yAxisId="cumulative" orientation="right" className="text-xs" tick={{ fontSize: 11 }} />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: "12px" }} />
        <Area yAxisId="daily" type="monotone" dataKey="orders" name="Daily Orders" stroke="#3b82f6" fill="url(#ordersGradient)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        <Line yAxisId="cumulative" type="monotone" dataKey="cumulativeOrders" name="Total Orders" stroke="#8b5cf6" strokeWidth={2} dot={false} strokeDasharray="5 5" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function ProfitChart({ data }: { data: any[] }) {
  if (!data.length) return <p className="text-sm text-muted-foreground text-center py-8">No data available for this period</p>;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <defs>
          <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="date" tickFormatter={formatChartDate} className="text-xs" tick={{ fontSize: 11 }} />
        <YAxis className="text-xs" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `$${v}`} />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: "12px" }} />
        <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#10b981" fill="url(#revenueGradient)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        <Area type="monotone" dataKey="profit" name="Profit" stroke="#6366f1" fill="url(#profitGradient)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        <Line type="monotone" dataKey="cost" name="Cost" stroke="#ef4444" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function LeadsChart({ data }: { data: any[] }) {
  if (!data.length) return <p className="text-sm text-muted-foreground text-center py-8">No data available for this period</p>;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <defs>
          <linearGradient id="leadsGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="cumLeadsGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ec4899" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="date" tickFormatter={formatChartDate} className="text-xs" tick={{ fontSize: 11 }} />
        <YAxis yAxisId="daily" className="text-xs" tick={{ fontSize: 11 }} />
        <YAxis yAxisId="cumulative" orientation="right" className="text-xs" tick={{ fontSize: 11 }} />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: "12px" }} />
        <Area yAxisId="daily" type="monotone" dataKey="leads" name="New Customers" stroke="#f59e0b" fill="url(#leadsGradient)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        <Line yAxisId="cumulative" type="monotone" dataKey="cumulativeLeads" name="Total Customers" stroke="#ec4899" strokeWidth={2} dot={false} strokeDasharray="5 5" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function RevenueChart({ data }: { data: any[] }) {
  if (!data.length) return <p className="text-sm text-muted-foreground text-center py-8">No data available for this period</p>;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <defs>
          <linearGradient id="invoicedGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="collectedGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="date" tickFormatter={formatChartDate} className="text-xs" tick={{ fontSize: 11 }} />
        <YAxis className="text-xs" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `$${v}`} />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: "12px" }} />
        <Area type="monotone" dataKey="revenue" name="Invoiced" stroke="#0ea5e9" fill="url(#invoicedGradient)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        <Area type="monotone" dataKey="collected" name="Collected" stroke="#22c55e" fill="url(#collectedGradient)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        <Line type="monotone" dataKey="cumulativeRevenue" name="Cumulative Revenue" stroke="#7c3aed" strokeWidth={2} dot={false} strokeDasharray="5 5" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function RecentOrdersSection({ orders }: { orders: any[] }) {
  const ordersPagination = usePagination(orders, { defaultPageSize: 20 });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-1">
        <CardTitle className="text-lg">Recent Orders</CardTitle>
        <Link href="/orders">
          <span className="text-xs text-primary cursor-pointer hover:underline flex items-center gap-1" data-testid="link-view-all-orders">
            View All <ArrowRight className="h-3 w-3" />
          </span>
        </Link>
      </CardHeader>
      <CardContent>
        {orders.length > 0 ? (
          <div className="space-y-2">
            {ordersPagination.paginatedData.map((order: any) => (
              <Link key={order.id} href={`/orders/${order.id}`}>
                <div className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors" data-testid={`order-row-${order.id}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">{order.order_number}</span>
                      <span className="text-xs text-muted-foreground">{order.service_type}{order.state ? ` - ${order.state}` : ""}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-sm text-foreground">{order.company_name}</span>
                      {order.customer_name && order.customer_name !== order.company_name && (
                        <span className="text-xs text-muted-foreground">({order.customer_name})</span>
                      )}
                      {order.referral_name && (
                        <Badge variant="outline" className="text-[10px] h-4">Ref: {order.referral_name}</Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                  </div>
                  <StatusBadge status={order.status} type="order" />
                </div>
              </Link>
            ))}
            <PaginationControls
              page={ordersPagination.page}
              pageSize={ordersPagination.pageSize}
              totalPages={ordersPagination.totalPages}
              totalItems={ordersPagination.totalItems}
              startIndex={ordersPagination.startIndex}
              endIndex={ordersPagination.endIndex}
              pageSizeOptions={ordersPagination.pageSizeOptions}
              onPageChange={ordersPagination.setPage}
              onPageSizeChange={ordersPagination.setPageSize}
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No orders in this period</p>
        )}
      </CardContent>
    </Card>
  );
}

function RecentInvoicesSection({ invoices }: { invoices: any[] }) {
  const invoicesPagination = usePagination(invoices, { defaultPageSize: 20 });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-1">
        <CardTitle className="text-lg">Recent Invoices</CardTitle>
        <Link href="/invoices">
          <span className="text-xs text-primary cursor-pointer hover:underline flex items-center gap-1" data-testid="link-view-all-invoices">
            View All <ArrowRight className="h-3 w-3" />
          </span>
        </Link>
      </CardHeader>
      <CardContent>
        {invoices.length > 0 ? (
          <div className="space-y-2">
            {invoicesPagination.paginatedData.map((inv: any) => (
              <Link key={inv.id} href={`/invoices/${inv.id}`}>
                <div className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors" data-testid={`invoice-row-${inv.id}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">{inv.invoice_number}</span>
                      <span className="text-sm font-bold text-foreground">${Number(inv.total).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-sm text-foreground">{inv.company_name}</span>
                      {inv.customer_name && inv.customer_name !== inv.company_name && (
                        <span className="text-xs text-muted-foreground">({inv.customer_name})</span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{new Date(inv.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                  </div>
                  <StatusBadge status={inv.status} type="invoice" />
                </div>
              </Link>
            ))}
            <PaginationControls
              page={invoicesPagination.page}
              pageSize={invoicesPagination.pageSize}
              totalPages={invoicesPagination.totalPages}
              totalItems={invoicesPagination.totalItems}
              startIndex={invoicesPagination.startIndex}
              endIndex={invoicesPagination.endIndex}
              pageSizeOptions={invoicesPagination.pageSizeOptions}
              onPageChange={invoicesPagination.setPage}
              onPageSizeChange={invoicesPagination.setPageSize}
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No invoices in this period</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [rangePreset, setRangePreset] = useState("30d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const { startDate, endDate } = useMemo(() => {
    if (rangePreset === "custom") {
      return { startDate: customStart, endDate: customEnd };
    }
    return getDateRange(rangePreset);
  }, [rangePreset, customStart, customEnd]);

  const dashboardUrl = `/api/dashboard${buildQS(startDate, endDate)}`;
  const chartsUrl = `/api/dashboard/charts${buildQS(startDate, endDate)}`;

  const { data: stats, isLoading, isError, error } = useQuery<any>({
    queryKey: [dashboardUrl],
  });

  const { data: chartData, isLoading: chartsLoading, isError: chartsError } = useQuery<any>({
    queryKey: [chartsUrl],
    refetchInterval: 60000,
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    const qs = buildQS(startDate, endDate);
    try {
      const res = await authFetch(`/api/refresh-database${qs}`);
      if (!res.ok) throw new Error("Refresh failed");
      const data = await res.json();
      queryClient.setQueryData([dashboardUrl], data.stats);
      queryClient.invalidateQueries({ queryKey: [chartsUrl] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/compliance-records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reminders"] });
      const parts: string[] = [];
      if (data.overdueCount > 0) parts.push(`${data.overdueCount} invoice(s) updated`);
      if (data.complianceSync?.synced > 0 || data.complianceSync?.created > 0)
        parts.push(`Compliance: ${data.complianceSync.synced} synced, ${data.complianceSync.created} created`);
      if (data.remindersCreated > 0) parts.push(`${data.remindersCreated} reminder(s) generated`);
      if (data.referralSync) {
        const rParts: string[] = [];
        if (data.referralSync.codesAssigned > 0) rParts.push(`${data.referralSync.codesAssigned} codes assigned`);
        if (data.referralSync.created > 0) rParts.push(`${data.referralSync.created} partners created`);
        if (data.referralSync.synced > 0) rParts.push(`${data.referralSync.synced} linked`);
        if (rParts.length > 0) parts.push(`Referrals: ${rParts.join(", ")}`);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/partners"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({
        title: "Database Refreshed",
        description: parts.length > 0 ? parts.join(" | ") : "All data is up to date",
      });
    } catch {
      toast({ title: "Refresh Failed", description: "Could not refresh data", variant: "destructive" });
    } finally {
      setRefreshing(false);
    }
  };

  const rangeLabel = useMemo(() => {
    if (!startDate && !endDate) return "All Time";
    const fmt = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    if (startDate && endDate) return `${fmt(startDate)} - ${fmt(endDate)}`;
    if (startDate) return `From ${fmt(startDate)}`;
    return `Until ${fmt(endDate)}`;
  }, [startDate, endDate]);

  if (isError) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Card><CardContent className="p-6 text-red-500">Error loading dashboard: {(error as Error)?.message}</CardContent></Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-20" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  const cards = [
    { title: "Total Customers", value: stats?.totalCustomers || 0, icon: Users, color: "text-blue-500", href: "/customers" },
    { title: "Total Orders", value: stats?.totalOrders || 0, icon: ShoppingCart, color: "text-green-500", href: "/orders" },
    { title: "Pending Orders", value: stats?.pendingOrders || 0, icon: Clock, color: "text-orange-500", href: "/orders" },
    { title: "Completed Orders", value: stats?.completedOrders || 0, icon: CheckCircle2, color: "text-emerald-500", href: "/orders" },
    { title: "Total Revenue", value: `$${(stats?.totalRevenue || 0).toLocaleString()}`, icon: DollarSign, color: "text-emerald-600", href: "/invoices" },
    { title: "Total Collected", value: `$${(stats?.totalCollected || 0).toLocaleString()}`, icon: TrendingUp, color: "text-teal-500", href: "/invoices" },
    { title: "Pending Invoices", value: stats?.pendingInvoices || 0, icon: FileText, color: "text-purple-500", href: "/invoices" },
    { title: "Paid Invoices", value: stats?.paidInvoices || 0, icon: CheckCircle2, color: "text-green-600", href: "/invoices" },
    { title: "Overdue Invoices", value: stats?.overdueInvoices || 0, icon: AlertTriangle, color: "text-red-500", href: "/invoices" },
  ];

  const timeSeriesData = chartData?.chartData || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-bold" data-testid="text-dashboard-title">Dashboard</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing..." : "Refresh Database"}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Date Range:</span>
            </div>
            <select
              value={rangePreset}
              onChange={(e) => setRangePreset(e.target.value)}
              className="h-9 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              data-testid="select-date-range"
            >
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="6m">Last 6 Months</option>
              <option value="1y">Last 1 Year</option>
              <option value="thisMonth">This Month</option>
              <option value="lastMonth">Last Month</option>
              <option value="all">All Time</option>
              <option value="custom">Custom Range</option>
            </select>
            {rangePreset === "custom" && (
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="h-9 w-[150px]"
                  data-testid="input-custom-start"
                />
                <span className="text-sm text-muted-foreground">to</span>
                <Input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="h-9 w-[150px]"
                  data-testid="input-custom-end"
                />
              </div>
            )}
            <Badge variant="outline" className="text-xs">
              {rangeLabel}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <Link key={card.title} href={card.href}>
            <Card className="cursor-pointer transition-all hover:shadow-md hover:border-primary/30 group" data-testid={`card-${card.title.toLowerCase().replace(/\s/g, '-')}`}>
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </CardHeader>
              <CardContent>
                <div className="flex items-end justify-between">
                  <span className="text-2xl font-bold" data-testid={`stat-${card.title.toLowerCase().replace(/\s/g, '-')}`}>
                    {card.value}
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {chartsLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-[280px]" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : chartsError ? (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground">Unable to load charts. Data will retry automatically.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card data-testid="chart-orders">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-blue-500" />
                <CardTitle className="text-base">Orders Trend</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <OrdersChart data={timeSeriesData} />
            </CardContent>
          </Card>

          <Card data-testid="chart-revenue">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-500" />
                <CardTitle className="text-base">Revenue & Collections</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <RevenueChart data={timeSeriesData} />
            </CardContent>
          </Card>

          <Card data-testid="chart-profit">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-indigo-500" />
                <CardTitle className="text-base">Profit & Loss</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <ProfitChart data={timeSeriesData} />
            </CardContent>
          </Card>

          <Card data-testid="chart-leads">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-amber-500" />
                <CardTitle className="text-base">Customer Growth</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <LeadsChart data={timeSeriesData} />
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentOrdersSection orders={stats?.recentOrders || []} />
        <RecentInvoicesSection invoices={stats?.recentInvoices || []} />
      </div>
    </div>
  );
}
