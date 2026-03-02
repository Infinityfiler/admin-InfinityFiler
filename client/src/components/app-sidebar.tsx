import { useLocation, Link } from "wouter";
import {
  LayoutDashboard, ShoppingCart, Users, FileText, BarChart3, TrendingUp,
  Wrench, Bell, Shield, Settings, Mail, Handshake, GitBranch, LogOut, UserCog, ExternalLink
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { getCurrentUser, logout } from "@/lib/auth";
import logoPath from "@assets/logo_1772131777440.png";

const menuItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Orders", url: "/orders", icon: ShoppingCart },
  { title: "Customers", url: "/customers", icon: Users },
  { title: "Invoices", url: "/invoices", icon: FileText },
  { title: "Partners", url: "/partners", icon: Handshake },
  { title: "Referrals", url: "/referrals", icon: GitBranch },
  { title: "Services", url: "/services", icon: Wrench },
  { title: "Reminders", url: "/reminders", icon: Bell },
  { title: "Compliance", url: "/compliance", icon: Shield },
  { title: "Profit & Loss", url: "/profit-loss", icon: TrendingUp },
  { title: "Reports", url: "/reports", icon: BarChart3 },
  { title: "Send Emails", url: "/emails", icon: Mail },
  { title: "Customer Links", url: "/customer-links", icon: ExternalLink },
  { title: "Admin Users", url: "/admin-users", icon: UserCog },
  { title: "General", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const [location] = useLocation();
  const user = getCurrentUser();

  function handleLogout() {
    logout();
    window.location.href = "/";
  }

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Link href="/" data-testid="link-home">
          <div className="flex items-center gap-3">
            <img src={logoPath} alt="Infinity Filer" className="h-10 w-10 rounded-full" />
            <div>
              <h2 className="text-sm font-semibold text-sidebar-foreground">Infinity Filer</h2>
              <p className="text-xs text-muted-foreground">Admin Portal</p>
            </div>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Management</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = location === item.url || (item.url !== "/" && location.startsWith(item.url));
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild data-active={isActive} data-testid={`nav-${item.title.toLowerCase().replace(/\s/g, '-')}`}>
                      <Link href={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 space-y-2">
        {user && (
          <p className="text-xs text-muted-foreground text-center truncate" data-testid="text-admin-email">
            {user.email}
          </p>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground hover:text-destructive"
          onClick={handleLogout}
          data-testid="button-logout"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
        <p className="text-xs text-muted-foreground text-center">Infinity Filer v1.0</p>
      </SidebarFooter>
    </Sidebar>
  );
}
