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

  const { data: stats, isLoading, isError, error } = useQuery<any>({
    queryKey: [dashboardUrl],
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
                />
                <span className="text-sm text-muted-foreground">to</span>
                <Input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="h-9 w-[150px]"
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent Orders</CardTitle>
            <Link href="/orders">
              <span className="text-xs text-primary cursor-pointer hover:underline flex items-center gap-1" data-testid="link-view-all-orders">
                View All <ArrowRight className="h-3 w-3" />
              </span>
            </Link>
          </CardHeader>
          <CardContent>
            {stats?.recentOrders?.length > 0 ? (
              <div className="space-y-2">
                {stats.recentOrders.map((order: any) => (
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
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No orders in this period</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent Invoices</CardTitle>
            <Link href="/invoices">
              <span className="text-xs text-primary cursor-pointer hover:underline flex items-center gap-1" data-testid="link-view-all-invoices">
                View All <ArrowRight className="h-3 w-3" />
              </span>
            </Link>
          </CardHeader>
          <CardContent>
            {stats?.recentInvoices?.length > 0 ? (
              <div className="space-y-2">
                {stats.recentInvoices.map((inv: any) => (
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
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No invoices in this period</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
