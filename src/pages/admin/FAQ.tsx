import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit, Trash2, Eye, EyeOff, HelpCircle } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminFAQs, useDeleteFAQ, useToggleFAQPublished, FAQ } from "@/hooks/useFAQs";

const AdminFAQ = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [faqToDelete, setFaqToDelete] = useState<number | null>(null);

  const { data: faqs, isLoading, error } = useAdminFAQs();
  const deleteFAQ = useDeleteFAQ();
  const togglePublished = useToggleFAQPublished();

  // Get unique sectors
  const sectors = faqs
    ? [...new Set(faqs.map((faq) => faq.sector))].sort()
    : [];

  // Filter FAQs
  const filteredFAQs = faqs?.filter((faq) => {
    const matchesSearch =
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.sector.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      categoryFilter === "all" || faq.sector === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Group FAQs by sector
  const groupedFAQs = filteredFAQs?.reduce((acc, faq) => {
    if (!acc[faq.sector]) {
      acc[faq.sector] = [];
    }
    acc[faq.sector].push(faq);
    return acc;
  }, {} as Record<string, FAQ[]>);

  const handleDelete = (id: number) => {
    setFaqToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (faqToDelete) {
      deleteFAQ.mutate(faqToDelete);
      setDeleteDialogOpen(false);
      setFaqToDelete(null);
    }
  };

  const handleTogglePublished = (faq: FAQ) => {
    togglePublished.mutate({ id: faq.id, is_published: !faq.is_published });
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-destructive">Error loading FAQs. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Manage FAQs</h1>
          <p className="text-muted-foreground mt-2">
            Create, edit, and manage frequently asked questions
          </p>
        </div>
        <Button onClick={() => navigate("/admin/faq/new")}>
          <Plus className="h-4 w-4 mr-2" />
          Create FAQ
        </Button>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search FAQs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filter by sector" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sectors</SelectItem>
                {sectors.map((sector) => (
                  <SelectItem key={sector} value={sector}>
                    {sector}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* FAQs List */}
      {isLoading ? (
        <Card>
          <CardContent className="pt-6 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {groupedFAQs && Object.keys(groupedFAQs).length > 0 ? (
            Object.entries(groupedFAQs)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([sector, categoryFaqs]) => (
                <Card key={sector}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <HelpCircle className="h-5 w-5 text-primary" />
                      {sector}
                      <Badge variant="secondary" className="ml-2">
                        {categoryFaqs.length}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {categoryFaqs
                        .sort((a, b) => a.display_order - b.display_order)
                        .map((faq) => (
                          <div
                            key={faq.id}
                            className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <h3 className="font-medium text-sm">
                                  {faq.question}
                                </h3>
                                {faq.is_published ? (
                                  <Badge className="bg-success text-success-foreground">
                                    Published
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary">Draft</Badge>
                                )}
                                <Badge variant="outline">
                                  Order: {faq.display_order}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {faq.answer}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleTogglePublished(faq)}
                                title={
                                  faq.is_published ? "Unpublish" : "Publish"
                                }
                              >
                                {faq.is_published ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  navigate(`/admin/faq/${faq.id}/edit`)
                                }
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive"
                                onClick={() => handleDelete(faq.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              ))
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <HelpCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  {searchQuery || categoryFilter !== "all"
                    ? "No FAQs found matching your search."
                    : "No FAQs created yet."}
                </p>
                <Button onClick={() => navigate("/admin/faq/new")}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First FAQ
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the FAQ.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminFAQ;








