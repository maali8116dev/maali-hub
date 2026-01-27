import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Mail, Calendar, FileText, Shield, Loader2, AlertCircle } from "lucide-react";
import { useUsers } from "@/hooks/useUsers";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";

const AdminUsers = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const { data: users, isLoading, error } = useUsers();

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    return users.filter(
      (user) =>
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [users, searchQuery]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Manage Users</h1>
        <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">
          View and manage all platform users
        </p>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Error State */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : "Failed to load users. Please try again."}
          </AlertDescription>
        </Alert>
      )}

      {/* Users List */}
      <Card>
        <CardHeader>
          <CardTitle>
            All Users {isLoading ? "" : `(${filteredUsers.length})`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <EmptyState
              icon={Search}
              title={searchQuery ? "No users found" : "No users yet"}
              description={
                searchQuery
                  ? "Try adjusting your search query"
                  : "Users will appear here once they register"
              }
            />
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {filteredUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 border rounded-lg hover:bg-muted/50 transition-colors gap-3 sm:gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                      <h3 className="font-semibold text-sm sm:text-base truncate">{user.name}</h3>
                      {user.role === "admin" && (
                        <Badge variant="secondary" className="text-xs">
                          <Shield className="h-3 w-3 mr-1" />
                          Admin
                        </Badge>
                      )}
                      {user.role === "reviewer" && (
                        <Badge variant="outline" className="text-xs">
                          Reviewer
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          user.status === "active"
                            ? "bg-success/10 text-success border-success/20"
                            : user.status === "suspended"
                            ? "bg-warning/10 text-warning border-warning/20"
                            : "bg-destructive/10 text-destructive border-destructive/20"
                        }`}
                      >
                        {user.status}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                      <span className="flex items-center gap-1 truncate">
                        <Mail className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{user.email}</span>
                      </span>
                      <span className="flex items-center gap-1 whitespace-nowrap">
                        <Calendar className="h-3 w-3 flex-shrink-0" />
                        Joined: {new Date(user.registeredAt).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1 whitespace-nowrap">
                        <FileText className="h-3 w-3 flex-shrink-0" />
                        {user.applicationsCount} {user.applicationsCount === 1 ? "application" : "applications"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button variant="outline" size="sm" className="min-h-[44px] sm:min-h-0 flex-1 sm:flex-initial">
                      View Profile
                    </Button>
                    {user.role !== "admin" && user.status === "active" && (
                      <Button variant="outline" size="sm" className="text-destructive min-h-[44px] sm:min-h-0 flex-1 sm:flex-initial">
                        Suspend
                      </Button>
                    )}
                    {user.status === "suspended" && (
                      <Button variant="outline" size="sm" className="text-success min-h-[44px] sm:min-h-0 flex-1 sm:flex-initial">
                        Activate
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminUsers;

