import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, ExternalLink, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";

type Partner = {
  id: number;
  name: string;
  description: string | null;
  logo_url: string | null;
  website_url: string | null;
  sector: string;
  display_order: number;
  featured: boolean;
  status: string;
  user_id: string | null;
  created_at: string;
  updated_at: string;
  linkedUser?: string;
};

const AdminPartners = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [partnerToDelete, setPartnerToDelete] = useState<number | null>(null);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPartners = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("partners")
        .select("*")
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false });

      if (error) throw error;
      const partnerList = (data || []) as Partner[];

      // Fetch linked user profiles
      const userIds = partnerList.map((p) => p.user_id).filter(Boolean) as string[];
      let profileMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, first_name, last_name")
          .in("user_id", userIds);
        if (profiles) {
          profiles.forEach((p) => {
            profileMap[p.user_id] = [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unnamed";
          });
        }
      }

      setPartners(
        partnerList.map((p) => ({
          ...p,
          linkedUser: p.user_id ? profileMap[p.user_id] : undefined,
        }))
      );
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to fetch partners", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPartners();
  }, [fetchPartners]);

  const handleDelete = (id: number) => {
    setPartnerToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!partnerToDelete) return;
    try {
      const { error } = await supabase.from("partners").delete().eq("id", partnerToDelete);
      if (error) throw error;
      toast({ title: "Success", description: "Partner deleted successfully" });
      setPartners((prev) => prev.filter((p) => p.id !== partnerToDelete));
      setDeleteDialogOpen(false);
      setPartnerToDelete(null);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to delete partner", variant: "destructive" });
    }
  };

  const columns: ColumnDef<Partner>[] = [
    {
      id: "logo",
      header: "",
      cell: ({ row }) => {
        const partner = row.original;
        return (
          <div className="w-10 h-10 rounded-full overflow-hidden bg-muted flex items-center justify-center flex-shrink-0">
            {partner.logo_url ? (
              <img
                src={partner.logo_url}
                alt={partner.name}
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <span className="text-lg">ðŸ¢</span>
            )}
          </div>
        );
      },
      enableSorting: false,
    },
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => {
        const partner = row.original;
        return (
          <div>
            <div className="flex items-center gap-2 font-medium">
              {partner.name}
              {partner.featured && <Badge variant="default" className="text-xs">Featured</Badge>}
            </div>
            {partner.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 max-w-xs">{partner.description}</p>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "sector",
      header: "sector",
      cell: ({ row }) => {
        const colors: Record<string, string> = {
          Funding: "bg-blue-500/15 text-blue-700 border-blue-300",
          Support: "bg-green-500/15 text-green-700 border-green-300",
          Impact: "bg-purple-500/15 text-purple-700 border-purple-300",
          Regional: "bg-orange-500/15 text-orange-700 border-orange-300",
          Technology: "bg-teal-500/15 text-teal-700 border-teal-300",
          Strategic: "bg-pink-500/15 text-pink-700 border-pink-300",
        };
        const cls = colors[row.original.sector] || "bg-muted text-muted-foreground";
        return <Badge variant="outline" className={cls}>{row.original.sector}</Badge>;
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const s = row.original.status;
        if (s === "active") return <Badge className="bg-success text-success-foreground">Active</Badge>;
        if (s === "inactive") return <Badge variant="secondary">Inactive</Badge>;
        return <Badge variant="outline">{s}</Badge>;
      },
    },
    {
      id: "linkedUser",
      header: "Linked User",
      accessorKey: "linkedUser",
      cell: ({ row }) => {
        const name = row.original.linkedUser;
        return (
          <div className="flex items-center gap-1.5 text-sm">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            {name ? (
              <span className="text-primary font-medium">{name}</span>
            ) : (
              <span className="text-muted-foreground">No user linked</span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "display_order",
      header: "Order",
      cell: ({ row }) => <span className="text-muted-foreground text-sm">{row.original.display_order}</span>,
    },
    {
      id: "website",
      header: "Website",
      enableSorting: false,
      cell: ({ row }) =>
        row.original.website_url ? (
          <a
            href={row.original.website_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Visit
          </a>
        ) : (
          <span className="text-muted-foreground text-sm">-/span>
        ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/admin/partners/${row.original.id}/edit`)}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => handleDelete(row.original.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Manage Partners</h1>
          <p className="text-muted-foreground mt-2">Create, edit, and manage partner organizations</p>
        </div>
        <Button onClick={() => navigate("/admin/partners/new")}>
          <Plus className="h-4 w-4 mr-2" />
          Add Partner
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={partners}
        searchKey="name"
        searchPlaceholder="Search by name or sector..."
        pageSize={10}
        enableExport={false}
        onRefresh={fetchPartners}
        isRefreshing={isLoading}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the partner.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminPartners;








