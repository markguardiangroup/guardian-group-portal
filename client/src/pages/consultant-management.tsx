import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  UserCog,
  Plus,
  MoreHorizontal,
  Pencil,
  Building2,
  Search,
  Crown,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ConsultantWithAssignments {
  id: string;
  username: string;
  email: string;
  fullName: string;
  consultantTier: string | null;
  status: string;
  createdAt: string;
  entityAssignments: {
    entityId: string;
    entityName: string;
    isPrimary: boolean;
  }[];
}

export default function ConsultantManagement() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingConsultant, setEditingConsultant] = useState<ConsultantWithAssignments | null>(null);
  
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    fullName: "",
    password: "",
    consultantTier: "standard",
  });

  const [editFormData, setEditFormData] = useState({
    consultantTier: "",
    status: "",
  });

  const { data: consultants = [], isLoading } = useQuery<ConsultantWithAssignments[]>({
    queryKey: ["/api/consultants"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest("POST", "/api/consultants", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultants"] });
      toast({ title: "Consultant created successfully" });
      setIsCreateDialogOpen(false);
      setFormData({
        username: "",
        email: "",
        fullName: "",
        password: "",
        consultantTier: "standard",
      });
    },
    onError: () => {
      toast({ title: "Failed to create consultant", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<{ consultantTier: string; status: string }> }) => {
      const response = await apiRequest("PATCH", `/api/users/${id}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultants"] });
      toast({ title: "Consultant updated successfully" });
      setEditingConsultant(null);
    },
    onError: () => {
      toast({ title: "Failed to update consultant", variant: "destructive" });
    },
  });

  const handleEditConsultant = (consultant: ConsultantWithAssignments) => {
    setEditingConsultant(consultant);
    setEditFormData({
      consultantTier: consultant.consultantTier || "standard",
      status: consultant.status || "active",
    });
  };

  const handleSaveEdit = () => {
    if (!editingConsultant) return;
    updateMutation.mutate({
      id: editingConsultant.id,
      updates: {
        consultantTier: editFormData.consultantTier,
        status: editFormData.status,
      },
    });
  };

  const filteredConsultants = consultants.filter(
    (c) =>
      c.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const tierLabels: Record<string, string> = {
    senior: "Senior",
    standard: "Standard",
    junior: "Junior",
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <UserCog className="h-6 w-6" />
            Consultant Management
          </h1>
          <p className="text-muted-foreground">
            Manage consultant accounts and their entity assignments
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-consultant">
              <Plus className="mr-2 h-4 w-4" />
              Add Consultant
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Consultant</DialogTitle>
              <DialogDescription>
                Add a new consultant to the system.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Full Name</label>
                <Input
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="John Smith"
                  data-testid="input-consultant-name"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="john@example.com"
                  data-testid="input-consultant-email"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Username</label>
                <Input
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="jsmith"
                  data-testid="input-consultant-username"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Password</label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Enter password"
                  data-testid="input-consultant-password"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Consultant Tier</label>
                <Select
                  value={formData.consultantTier}
                  onValueChange={(v) => setFormData({ ...formData, consultantTier: v })}
                >
                  <SelectTrigger data-testid="select-consultant-tier">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="senior">Senior</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="junior">Junior</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createMutation.mutate(formData)}
                disabled={createMutation.isPending || !formData.username || !formData.email || !formData.fullName || !formData.password}
                data-testid="button-confirm-create-consultant"
              >
                {createMutation.isPending ? "Creating..." : "Create Consultant"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base">Consultants ({consultants.length})</CardTitle>
            <CardDescription>All consultant accounts in the system</CardDescription>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search consultants..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-consultants"
            />
          </div>
        </CardHeader>
        <CardContent>
          {filteredConsultants.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {searchQuery ? "No consultants match your search." : "No consultants in the system."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Consultant</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Entity Assignments</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredConsultants.map((consultant) => (
                  <TableRow key={consultant.id} data-testid={`row-consultant-${consultant.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback>
                            {consultant.fullName
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{consultant.fullName}</p>
                          <p className="text-sm text-muted-foreground">{consultant.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {tierLabels[consultant.consultantTier || ""] || "Standard"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={consultant.status === "active" ? "secondary" : "outline"}
                        className={consultant.status === "active" ? "bg-emerald-500/10 text-emerald-600" : ""}
                      >
                        {consultant.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {consultant.entityAssignments.length === 0 ? (
                        <span className="text-sm text-muted-foreground">No assignments</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {consultant.entityAssignments.slice(0, 3).map((assignment) => (
                            <Badge
                              key={assignment.entityId}
                              variant="secondary"
                              className="gap-1"
                            >
                              {assignment.isPrimary && <Crown className="h-3 w-3" />}
                              {assignment.entityName}
                            </Badge>
                          ))}
                          {consultant.entityAssignments.length > 3 && (
                            <Badge variant="outline">
                              +{consultant.entityAssignments.length - 3} more
                            </Badge>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(consultant.createdAt), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            data-testid={`button-consultant-menu-${consultant.id}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditConsultant(consultant)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit Details
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Building2 className="mr-2 h-4 w-4" />
                            View Assignments
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() =>
                              updateMutation.mutate({
                                id: consultant.id,
                                updates: {
                                  status: consultant.status === "active" ? "inactive" : "active",
                                },
                              })
                            }
                          >
                            {consultant.status === "active" ? "Deactivate" : "Activate"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editingConsultant} onOpenChange={(open) => !open && setEditingConsultant(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Consultant</DialogTitle>
            <DialogDescription>
              Update {editingConsultant?.fullName}'s details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Consultant Tier</label>
              <Select
                value={editFormData.consultantTier}
                onValueChange={(v) => setEditFormData({ ...editFormData, consultantTier: v })}
              >
                <SelectTrigger data-testid="select-edit-consultant-tier">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="senior">Senior</SelectItem>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="junior">Junior</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select
                value={editFormData.status}
                onValueChange={(v) => setEditFormData({ ...editFormData, status: v })}
              >
                <SelectTrigger data-testid="select-edit-consultant-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingConsultant(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
