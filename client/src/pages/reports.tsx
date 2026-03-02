import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, BarChart3, Users, ShoppingCart, FileText } from "lucide-react";
import type { Customer, Order, Invoice, Service } from "@shared/schema";

export default function Reports() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [reportType, setReportType] = useState("all");

  const { data, isLoading } = useQuery<{ customers: Customer[]; orders: Order[]; invoices: Invoice[]; services: Service[] }>({
    queryKey: ["/api/reports"],
  });

  const customers = data?.customers || [];
  const orders = data?.orders || [];
  const invoices = data?.invoices || [];
  const services = data?.services || [];

  const filteredOrders = orders.filter(o => {
    if (dateFrom && new Date(o.created_at) < new Date(dateFrom)) return false;
    if (dateTo && new Date(o.created_at) > new Date(dateTo + "T23:59:59")) return false;
    return true;
  });

  const filteredInvoices = invoices.filter(i => {
    if (dateFrom && new Date(i.created_at) < new Date(dateFrom)) return false;
    if (dateTo && new Date(i.created_at) > new Date(dateTo + "T23:59:59")) return false;
    return true;
  });

  const totalRevenue = filteredInvoices.filter(i => i.status === "paid").reduce((sum, i) => sum + Number(i.total), 0);
  const pendingRevenue = filteredInvoices.filter(i => i.status === "pending").reduce((sum, i) => sum + Number(i.total), 0);
  const totalDiscount = filteredInvoices.reduce((sum, i) => sum + Number(i.discount_amount), 0);

  const ordersByStatus = filteredOrders.reduce((acc, o) => { acc[o.status] = (acc[o.status] || 0) + 1; return acc; }, {} as Record<string, number>);
  const invoicesByStatus = filteredInvoices.reduce((acc, i) => { acc[i.status] = (acc[i.status] || 0) + 1; return acc; }, {} as Record<string, number>);

  const servicesByCategory = services.reduce((acc, s) => { acc[s.category] = (acc[s.category] || 0) + 1; return acc; }, {} as Record<string, number>);

  const ordersByState = filteredOrders.reduce((acc, o) => {
    if (o.state) acc[o.state] = (acc[o.state] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topStates = Object.entries(ordersByState).sort((a, b) => b[1] - a[1]).slice(0, 10);

  const referralCounts = customers.reduce((acc, c) => {
    if (c.referred_by) acc[c.referred_by] = (acc[c.referred_by] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const topReferrals = Object.entries(referralCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

  const exportToExcel = async (type: string) => {
    try {
      const XLSX = await import("xlsx");
      let sheetData: any[] = [];

      if (type === "customers") {
        sheetData = customers.map(c => ({
          "Company": c.company_name, "Name": c.individual_name, "Email": c.email,
          "Phone": c.phone, "Country": c.country, "State": c.state, "Referred By": c.referred_by,
          "Created": new Date(c.created_at).toLocaleDateString(),
        }));
      } else if (type === "orders") {
        sheetData = filteredOrders.map(o => ({
          "Order #": o.order_number, "Company": o.company_name, "Customer": o.customer_name,
          "Service": o.service_type, "State": o.state, "Status": o.status,
          "Created": new Date(o.created_at).toLocaleDateString(),
        }));
      } else if (type === "invoices") {
        sheetData = filteredInvoices.map(i => ({
          "Invoice #": i.invoice_number, "Order #": i.order_number, "Company": i.company_name,
          "Customer": i.customer_name, "Subtotal": Number(i.subtotal).toFixed(2),
          "Discount": Number(i.discount_amount).toFixed(2), "Total": Number(i.total).toFixed(2),
          "Status": i.status, "Created": new Date(i.created_at).toLocaleDateString(),
        }));
      } else if (type === "services") {
        sheetData = services.map(s => ({
          "Name": s.name, "Category": s.category, "State": s.state,
          "State Fee": Number(s.state_fee).toFixed(2), "Agent Fee": Number(s.agent_fee).toFixed(2),
          "Service Charges": Number(s.service_charges).toFixed(2),
          "Total": (Number(s.state_fee) + Number(s.agent_fee) + Number(s.unique_address) + Number(s.vyke_number) + Number(s.service_charges)).toFixed(2),
        }));
      }

      const ws = XLSX.utils.json_to_sheet(sheetData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, type);
      XLSX.writeFile(wb, `${type}_report_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      console.error("Export failed:", err);
    }
  };

  if (isLoading) return <div className="p-6 space-y-6"><h1 className="text-2xl font-bold">Reports</h1><Skeleton className="h-64" /></div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold" data-testid="text-reports-title">Reports</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="secondary" size="sm" onClick={() => exportToExcel("customers")} data-testid="button-export-customers"><Download className="h-4 w-4 mr-1" />Customers</Button>
          <Button variant="secondary" size="sm" onClick={() => exportToExcel("orders")} data-testid="button-export-orders"><Download className="h-4 w-4 mr-1" />Orders</Button>
          <Button variant="secondary" size="sm" onClick={() => exportToExcel("invoices")} data-testid="button-export-invoices"><Download className="h-4 w-4 mr-1" />Invoices</Button>
          <Button variant="secondary" size="sm" onClick={() => exportToExcel("services")} data-testid="button-export-services"><Download className="h-4 w-4 mr-1" />Services</Button>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div><Label className="text-xs">From</Label><Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></div>
        <div><Label className="text-xs">To</Label><Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-3"><Users className="h-5 w-5 text-blue-500" /><div><p className="text-xs text-muted-foreground">Total Customers</p><p className="text-xl font-bold">{customers.length}</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><ShoppingCart className="h-5 w-5 text-green-500" /><div><p className="text-xs text-muted-foreground">Orders (filtered)</p><p className="text-xl font-bold">{filteredOrders.length}</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><FileText className="h-5 w-5 text-purple-500" /><div><p className="text-xs text-muted-foreground">Revenue (paid)</p><p className="text-xl font-bold">${totalRevenue.toLocaleString()}</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><BarChart3 className="h-5 w-5 text-orange-500" /><div><p className="text-xs text-muted-foreground">Pending Revenue</p><p className="text-xl font-bold">${pendingRevenue.toLocaleString()}</p></div></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-lg">Orders by Status</CardTitle></CardHeader>
          <CardContent>
            {Object.keys(ordersByStatus).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(ordersByStatus).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <span className="text-sm capitalize">{status}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-accent h-3 rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${(count / filteredOrders.length) * 100}%` }} />
                      </div>
                      <span className="text-sm font-medium w-8 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">No orders data</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Invoices by Status</CardTitle></CardHeader>
          <CardContent>
            {Object.keys(invoicesByStatus).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(invoicesByStatus).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <span className="text-sm capitalize">{status}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-accent h-3 rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${(count / filteredInvoices.length) * 100}%` }} />
                      </div>
                      <span className="text-sm font-medium w-8 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">No invoice data</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Top States</CardTitle></CardHeader>
          <CardContent>
            {topStates.length > 0 ? (
              <div className="space-y-2">
                {topStates.map(([state, count]) => (
                  <div key={state} className="flex items-center justify-between">
                    <span className="text-sm">{state}</span>
                    <span className="text-sm font-medium">{count} orders</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">No state data</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Top Referrals</CardTitle></CardHeader>
          <CardContent>
            {topReferrals.length > 0 ? (
              <div className="space-y-2">
                {topReferrals.map(([ref, count]) => (
                  <div key={ref} className="flex items-center justify-between">
                    <span className="text-sm">{ref}</span>
                    <span className="text-sm font-medium">{count} customers</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">No referral data</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Services by Category</CardTitle></CardHeader>
          <CardContent>
            {Object.keys(servicesByCategory).length > 0 ? (
              <div className="space-y-2">
                {Object.entries(servicesByCategory).map(([cat, count]) => (
                  <div key={cat} className="flex items-center justify-between">
                    <span className="text-sm">{cat}</span>
                    <span className="text-sm font-medium">{count}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">No services data</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Financial Summary</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm"><span>Total Revenue (Paid)</span><span className="font-semibold text-green-600">${totalRevenue.toLocaleString()}</span></div>
            <div className="flex justify-between text-sm"><span>Pending Revenue</span><span className="font-semibold text-orange-600">${pendingRevenue.toLocaleString()}</span></div>
            <div className="flex justify-between text-sm"><span>Total Discounts Given</span><span className="font-semibold text-red-600">${totalDiscount.toLocaleString()}</span></div>
            <div className="flex justify-between text-sm border-t pt-2"><span className="font-semibold">Total Invoiced</span><span className="font-bold">${(totalRevenue + pendingRevenue).toLocaleString()}</span></div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
