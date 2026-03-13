import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useAdminMentors, useDeleteMentor, useToggleMentorPublished } from "@/hooks/useMentors";
import { Plus, Search, Edit, Trash2, Eye, EyeOff, Users, MapPin, Briefcase } from "lucide-react";

const AdminMentors = () => {
  const { data: mentors, isLoading } = useAdminMentors();
  const deleteMentor = useDeleteMentor();
  const togglePublished = useToggleMentorPublished();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Filter mentors
  const filteredMentors = mentors?.filter(mentor => {
    const matchesSearch = 
      mentor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      mentor.sector.toLowerCase().includes(searchTerm.toLowerCase()) ||
      mentor.country?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = 
      statusFilter === "all" ||
      (statusFilter === "published" && mentor.is_published) ||
      (statusFilter === "draft" && !mentor.is_published);
    return matchesSearch && matchesStatus;
  });

  const handleTogglePublished = (id: number, currentStatus: boolean) => {
    togglePublished.mutate({ id, is_published: !currentStatus });
  };

  const handleDelete = (id: number) => {
    deleteMentor.mutate(id);
  };

  // Stats
  const totalMentors = mentors?.length || 0;
  const publishedMentors = mentors?.filter(m => m.is_published).length || 0;
  const uniquesectors = [...new Set(mentors?.map(m => m.sector).filter(Boolean))].length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Mentor Management</h1>
          <p className="text-muted-foreground">Manage your mentorship directory</p>
        </div>
        <Button asChild>
          <Link to="/admin/mentors/new">
            <Plus className="h-4 w-4 mr-2" />
            Add Mentor
          </Link>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Mentors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">{totalMentors}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Published</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-green-600" />
              <span className="text-2xl font-bold">{publishedMentors}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">sectors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-blue-600" />
              <span className="text-2xl font-bold">{uniquesectors}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, sector, or country..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Mentors Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-8 w-20" />
                </div>
              ))}
            </div>
          ) : filteredMentors?.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No mentors found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm || statusFilter !== "all"
                  ? "Try adjusting your search or filters"
                  : "Get started by adding your first mentor"}
              </p>
              {!searchTerm && statusFilter === "all" && (
                <Button asChild>
                  <Link to="/admin/mentors/new">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Mentor
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mentor</TableHead>
                  <TableHead>sector</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Expertise</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMentors?.map((mentor) => (
                  <TableRow key={mentor.id}>
                    <TableCell>
                      <div className="font-medium">{mentor.name}</div>
                      {mentor.bio && (
                        <div className="text-sm text-muted-foreground line-clamp-1 max-w-xs">
                          {mentor.bio}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {mentor.sector ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Briefcase className="h-3 w-3" />
                          {mentor.sector}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-/span>
                      )}
                    </TableCell>
                    <TableCell>
                      {mentor.country ? (
                        <div className="flex items-center gap-1 text-sm">
                          <MapPin className="h-3 w-3" />
                          {mentor.country}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-/span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {mentor.expertise_areas?.slice(0, 2).map((exp, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {exp}
                          </Badge>
                        ))}
                        {(mentor.expertise_areas?.length || 0) > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{mentor.expertise_areas.length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={mentor.is_published ? "default" : "secondary"}>
                        {mentor.is_published ? "Published" : "Draft"}
                      </Badge>
                    </TableCell>
                    <TableCell>{mentor.display_order}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleTogglePublished(mentor.id, mentor.is_published)}
                          title={mentor.is_published ? "Unpublish" : "Publish"}
                        >
                          {mentor.is_published ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/admin/mentors/${mentor.id}/edit`}>
                            <Edit className="h-4 w-4" />
                          </Link>
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Mentor</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{mentor.name}"? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(mentor.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminMentors;








