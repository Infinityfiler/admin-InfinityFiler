import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Admin } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { UserCog, Shield, Clock, LogIn, Pencil, Trash2, Loader2 } from "lucide-react";

export default function AdminUsers() {
  const { toast } = useToast();
  const [editAdmin, setEditAdmin] = useState<Admin | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteAdmin, setDeleteAdmin] = useState<Admin | null>(null);

  const { data: admins = [], isLoading } = useQuery<Admin[]>({
    queryKey: ["/api/admins"],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Admin> }) => {
      const res = await apiRequest("PATCH", `/api/admins/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admins"] });
      setEditAdmin(null);
      toast({ title: "Admin updated" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admins/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admins"] });
      setDeleteAdmin(null);
      toast({ title: "Admin removed" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "Never";
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  function openEdit(admin: Admin) {
    setEditName(admin.name || "");
    setEditAdmin(admin);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Admin Users</h1>
          <p className="text-muted-foreground text-sm">Track admin sign-in activity and manage admin accounts</p>
        </div>
        <Badge variant="outline" className="text-sm" data-testid="badge-admin-count">
          <UserCog className="h-3.5 w-3.5 mr-1" />
          {admins.length} Admin{admins.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <UserCog className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="stat-total-admins">{admins.length}</p>
                <p className="text-xs text-muted-foreground">Total Admins</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Shield className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="stat-active-admins">
                  {admins.filter((a) => a.status === "active").length}
                </p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <LogIn className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="stat-total-logins">
                  {admins.reduce((sum, a) => sum + (a.login_count || 0), 0)}
                </p>
                <p className="text-xs text-muted-foreground">Total Sign-ins</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Admin Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          {admins.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No admin accounts found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Sign-in</TableHead>
                  <TableHead className="text-center">Sign-ins</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.map((admin) => (
                  <TableRow key={admin.id} data-testid={`row-admin-${admin.id}`}>
                    <TableCell className="font-medium" data-testid={`text-admin-name-${admin.id}`}>
                      {admin.name || "—"}
                    </TableCell>
                    <TableCell data-testid={`text-admin-email-${admin.id}`}>
                      {admin.email}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={admin.status === "active" ? "default" : "secondary"}
                        data-testid={`badge-admin-status-${admin.id}`}
                      >
                        {admin.status}
                      </Badge>
                    </TableCell>
                    <TableCell data-testid={`text-admin-last-login-${admin.id}`}>
                      <div className="flex items-center gap-1.5 text-sm">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        {formatDate(admin.last_login_at)}
                      </div>
                    </TableCell>
                    <TableCell className="text-center" data-testid={`text-admin-login-count-${admin.id}`}>
                      {admin.login_count || 0}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(admin.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(admin)}
                          data-testid={`button-edit-admin-${admin.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteAdmin(admin)}
                          disabled={admins.length <= 1}
                          data-testid={`button-delete-admin-${admin.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editAdmin} onOpenChange={(open) => !open && setEditAdmin(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Admin</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Admin name"
                data-testid="input-edit-admin-name"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Email</label>
              <Input value={editAdmin?.email || ""} disabled className="bg-muted" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditAdmin(null)} data-testid="button-cancel-edit">
              Cancel
            </Button>
            <Button
              onClick={() => editAdmin && updateMutation.mutate({ id: editAdmin.id, data: { name: editName } })}
              disabled={updateMutation.isPending}
              data-testid="button-save-admin"
            >
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteAdmin} onOpenChange={(open) => !open && setDeleteAdmin(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Admin</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{deleteAdmin?.email}</strong> from admin tracking?
              This only removes the tracking record — it does not delete their Supabase auth account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteAdmin && deleteMutation.mutate(deleteAdmin.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
