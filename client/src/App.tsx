import { useState, useEffect } from "react";
import { Switch, Route, Router, useRoute } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { isAuthenticated, tryRestoreSession, setAuthChangeHandler, getCurrentUser, getAuthHeaders, type AuthUser } from "@/lib/auth";
import FloatingChat from "@/components/floating-chat";
import AdminLogin from "@/pages/admin-login";
import CustomerPortal from "@/pages/customer-portal";
import Dashboard from "@/pages/dashboard";
import Orders from "@/pages/orders";
import OrderDetail from "@/pages/order-detail";
import Customers from "@/pages/customers";
import CustomerDetail from "@/pages/customer-detail";
import Invoices from "@/pages/invoices";
import InvoiceDetail from "@/pages/invoice-detail";
import CreateInvoice from "@/pages/create-invoice";
import EditInvoice from "@/pages/edit-invoice";
import Services from "@/pages/services";
import Reminders from "@/pages/reminders";
import Compliance from "@/pages/compliance";
import ProfitLoss from "@/pages/profit-loss";
import Reports from "@/pages/reports";
import Emails from "@/pages/emails";
import CustomerLinks from "@/pages/customer-links";
import Partners from "@/pages/partners";
import Referrals from "@/pages/referrals";
import AdminUsers from "@/pages/admin-users";
import GeneralSettings from "@/pages/settings";
import NotFound from "@/pages/not-found";
import { Loader2 } from "lucide-react";

function AdminFloatingChat() {
  const [, params] = useRoute("/orders/:id");
  const id = params?.id ? Number(params.id) : 0;
  if (!id || isNaN(id)) return null;
  return (
    <FloatingChat
      orderId={id}
      senderType="admin"
      senderName="Admin"
      fetchUrl={`/api/orders/${id}/chats`}
      postUrl={`/api/orders/${id}/chats`}
      downloadUrlPrefix={`/api/orders/${id}/chats`}
      markAsReadUrl={`/api/orders/${id}/chats/read`}
      authHeaders={getAuthHeaders()}
    />
  );
}

function AppRoutes() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/orders" component={Orders} />
      <Route path="/orders/:id" component={OrderDetail} />
      <Route path="/customers" component={Customers} />
      <Route path="/customers/:id" component={CustomerDetail} />
      <Route path="/invoices" component={Invoices} />
      <Route path="/invoices/create" component={CreateInvoice} />
      <Route path="/invoices/:id/edit" component={EditInvoice} />
      <Route path="/invoices/:id" component={InvoiceDetail} />
      <Route path="/partners" component={Partners} />
      <Route path="/referrals" component={Referrals} />
      <Route path="/services" component={Services} />
      <Route path="/reminders" component={Reminders} />
      <Route path="/compliance" component={Compliance} />
      <Route path="/profit-loss" component={ProfitLoss} />
      <Route path="/reports" component={Reports} />
      <Route path="/emails" component={Emails} />
      <Route path="/customer-links" component={CustomerLinks} />
      <Route path="/admin-users" component={AdminUsers} />
      <Route path="/settings" component={GeneralSettings} />
      <Route component={NotFound} />
    </Switch>
  );
}

const sidebarStyle = {
  "--sidebar-width": "16rem",
  "--sidebar-width-icon": "3rem",
};

const isPortalRoute = window.location.pathname.startsWith("/portal/");

function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    if (isPortalRoute) {
      setAuthChecked(true);
      return;
    }
    setAuthChangeHandler((u) => setUser(u));
    tryRestoreSession().then((u) => {
      setUser(u);
      setAuthChecked(true);
    });
  }, []);

  if (isPortalRoute) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Router>
            <Switch>
              <Route path="/portal/:token" component={CustomerPortal} />
            </Switch>
          </Router>
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated()) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AdminLogin onLoginSuccess={() => {
            const currentUser = getCurrentUser();
            if (currentUser) setUser({ ...currentUser });
          }} />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router>
        <SidebarProvider style={sidebarStyle as React.CSSProperties}>
          <div className="flex h-screen w-full">
            <AppSidebar />
            <div className="flex flex-col flex-1 min-w-0">
              <header className="flex items-center gap-2 p-3 border-b bg-background sticky top-0 z-50">
                <SidebarTrigger data-testid="button-sidebar-toggle" />
                <h1 className="text-sm font-medium text-muted-foreground">Infinity Filer Admin</h1>
              </header>
              <main className="flex-1 overflow-auto">
                <AppRoutes />
              </main>
            </div>
          </div>
        </SidebarProvider>
        <AdminFloatingChat />
        </Router>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
