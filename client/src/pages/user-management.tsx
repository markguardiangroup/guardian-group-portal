import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSiteFilter } from "@/hooks/use-site-filter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import {
  Users,
  Search,
  Plus,
  MoreHorizontal,
  Pencil,
  Shield,
  Building2,
  Mail,
  UserCheck,
  UserX,
  ChevronLeft,
  ChevronRight,
  Copy,
  RefreshCw,
  Link,
  Clock,
  MapPin,
  X,
  AlertTriangle,
  Eye,
  Phone,
  Smartphone,
  Briefcase,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import type { UserRole, ClientPermissionRole, ConsultantTier } from "@shared/schema";

interface SiteAssignment {
  siteId: string;
  siteName: string;
  companyName: string;
  isPrimary: boolean;
}

interface UserWithAssignments {
  id: string;
  referenceNumber?: string | null;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  companyId: string | null;
  status: "active" | "inactive" | "invited" | "site_required" | "invite_required";
  lastLogin: string | null;
  consultantTier?: ConsultantTier | null;
  clientPermissionRole?: ClientPermissionRole | null;
  siteAssignments?: SiteAssignment[];
  // Profile fields
  title?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  phone?: string | null;
  mobile?: string | null;
  preferredContactMethod?: "email" | "phone" | "mobile" | null;
  notes?: string | null;
}

interface SiteBasic {
  id: string;
  name: string;
  companyId: string;
}

const ITEMS_PER_PAGE = 15;

const roleColors: Record<UserRole, string> = {
  admin: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/20",
  consultant: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20",
  client: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
};

const roleLabels: Record<UserRole, string> = {
  admin: "Administrator",
  consultant: "Consultant",
  client: "Client",
};

export default function UserManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { selectedCompany, handleCompanyChange } = useSiteFilter();
  const companyFilter = selectedCompany || "all";
  const setCompanyFilter = (val: string) => handleCompanyChange(val === "all" ? null : val);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "invited" | "site_required" | "invite_required" | "all">("all");
  const [page, setPage] = useState(1);
  const [editingUser, setEditingUser] = useState<UserWithAssignments | null>(null);
  const [viewingUser, setViewingUser] = useState<UserWithAssignments | null>(null);
  const [statusConfirm, setStatusConfirm] = useState<{ user: UserWithAssignments; newStatus: "active" | "inactive" } | null>(null);
  const [editFormData, setEditFormData] = useState<{
    email: string;
    title: string;
    firstName: string;
    lastName: string;
    jobTitle: string;
    department: string;
    phone: string;
    mobile: string;
    preferredContactMethod: "email" | "phone" | "mobile";
    notes: string;
    role: "admin" | "consultant" | "client";
    companyId: string;
    consultantTier: string;
    clientPermissionRole: string;
  } | null>(null);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    username: "",
    email: "",
    fullName: "",
    title: "",
    firstName: "",
    lastName: "",
    jobTitle: "",
    department: "",
    phone: "",
    mobile: "",
    preferredContactMethod: "email" as "email" | "phone" | "mobile",
    notes: "",
    role: "client" as "admin" | "consultant" | "client",
    companyId: "",
    consultantTier: "senior" as "" | "standard" | "senior" | "principal",
    clientPermissionRole: "owner" as "viewer" | "contributor" | "manager" | "owner",
  });
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showSiteAssignmentMessage, setShowSiteAssignmentMessage] = useState(false);
  
  // Site assignment state
  const [userSiteAssignments, setUserSiteAssignments] = useState<{
    siteId: string;
    siteName: string;
    companyId: string;
    companyName: string;
    isPrimary: boolean;
  }[]>([]);
  const [siteAssignmentConfirm, setSiteAssignmentConfirm] = useState<{
    type: "add" | "remove";
    siteId: string;
    siteName: string;
  } | null>(null);
  const [selectedSiteToAdd, setSelectedSiteToAdd] = useState<string>("");

  const generateUsername = (firstName: string, lastName: string): string => {
    const cleanFirst = firstName.toLowerCase().replace(/[^a-z]/g, '');
    const cleanLast = lastName.toLowerCase().replace(/[^a-z]/g, '');
    let base = '';
    if (cleanFirst && cleanLast) {
      base = `${cleanFirst}.${cleanLast}`;
    } else if (cleanFirst) {
      base = cleanFirst;
    } else if (cleanLast) {
      base = cleanLast;
    } else {
      return '';
    }
    const existingUsernames = new Set(allUsers.map(u => u.username?.toLowerCase()));
    if (!existingUsernames.has(base)) return base;
    let counter = 2;
    while (existingUsernames.has(`${base}${counter}`)) {
      counter++;
    }
    return `${base}${counter}`;
  };

  const isAdmin = user?.role === "admin";
  const isConsultant = user?.role === "consultant";

  const { data: allUsers = [], isLoading: isLoadingUsers } = useQuery<UserWithAssignments[]>({
    queryKey: ["/api/users"],
    enabled: isAdmin || isConsultant,
  });

  const { data: consultantsWithAssignments = [] } = useQuery<UserWithAssignments[]>({
    queryKey: ["/api/consultants"],
    enabled: isAdmin,
  });

  const { data: sites = [] } = useQuery<SiteBasic[]>({
    queryKey: ["/api/sites"],
    enabled: isAdmin || isConsultant,
  });

  const { data: companiesResponse } = useQuery<{ companies: { id: string; name: string; contactEmail?: string | null; contactName?: string | null }[] }>({
    queryKey: ["/api/companies"],
    enabled: isAdmin || isConsultant,
  });
  const companies = companiesResponse?.companies || [];

  // Helper to check if a user is the primary contact for their company
  const isPrimaryContact = (u: UserWithAssignments) => {
    if (u.role !== "client" || !u.companyId) return false;
    const company = companies.find(c => c.id === u.companyId);
    if (!company?.contactEmail) return false;
    return company.contactEmail.toLowerCase() === u.email.toLowerCase();
  };

  const usersWithSiteInfo = allUsers.map((u) => {
    if (u.role === "client" && u.companyId) {
      const company = companies.find((c) => c.id === u.companyId);
      return {
        ...u,
        companyName: company?.name || null,
      };
    }
    // siteAssignments are now included directly from /api/users for both consultants and clients
    return u;
  });

  if (!isAdmin && !isConsultant) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              Only administrators and consultants can access user management.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const getVisibleUsers = () => {
    if (isAdmin) return usersWithSiteInfo;
    if (isConsultant) return usersWithSiteInfo.filter((u) => u.role === "client");
    return [];
  };

  const filteredUsers = getVisibleUsers().filter((u) => {
    const matchesSearch = 
      u.fullName.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      (u.jobTitle && u.jobTitle.toLowerCase().includes(search.toLowerCase()));
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    const matchesStatus = statusFilter === "all" || u.status === statusFilter;
    const matchesCompany = companyFilter === "all" || u.companyId === companyFilter;
    return matchesSearch && matchesRole && matchesStatus && matchesCompany;
  });

  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
  const paginatedUsers = filteredUsers.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  const openEditDialog = (u: UserWithAssignments) => {
    setEditingUser(u);
    setEditFormData({
      email: u.email,
      title: u.title || "",
      firstName: u.firstName || "",
      lastName: u.lastName || "",
      jobTitle: u.jobTitle || "",
      department: u.department || "",
      phone: u.phone || "",
      mobile: u.mobile || "",
      preferredContactMethod: u.preferredContactMethod || "email",
      notes: u.notes || "",
      role: u.role,
      companyId: u.companyId || "",
      consultantTier: "senior",
      clientPermissionRole: "owner",
    });
    // Fetch site assignments for consultants and clients
    if (u.role !== "admin" && isAdmin) {
      fetchUserSiteAssignments(u.id);
    } else {
      setUserSiteAssignments([]);
    }
    setSelectedSiteToAdd("");
  };

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof editFormData }) => {
      const fullName = data ? 
        `${data.firstName} ${data.lastName}`.trim() || editingUser?.fullName : 
        editingUser?.fullName;
      const response = await apiRequest("PATCH", `/api/users/${id}`, {
        ...data,
        fullName,
        consultantTier: data?.consultantTier || null,
        companyId: data?.companyId || null,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "User Updated",
        description: "User profile has been updated successfully.",
      });
      setEditingUser(null);
      setEditFormData(null);
    },
    onError: () => {
      toast({ title: "Failed to update user", variant: "destructive" });
    },
  });

  const handleSaveEdit = () => {
    if (!editingUser || !editFormData) return;
    updateUserMutation.mutate({ id: editingUser.id, data: editFormData });
  };

  // Fetch site assignments when editing a user
  const fetchUserSiteAssignments = async (userId: string) => {
    try {
      const response = await apiRequest("GET", `/api/users/${userId}/all-site-assignments`);
      const data = await response.json();
      setUserSiteAssignments(data || []);
    } catch (error) {
      console.error("Failed to fetch user site assignments:", error);
      setUserSiteAssignments([]);
    }
  };

  // Add site assignment mutation
  const addSiteAssignmentMutation = useMutation({
    mutationFn: async ({ userId, siteId }: { userId: string; siteId: string }) => {
      const response = await apiRequest("POST", `/api/users/${userId}/site-assignments/${siteId}`, {});
      return response.json();
    },
    onSuccess: () => {
      if (editingUser) {
        fetchUserSiteAssignments(editingUser.id);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/consultants"] });
      toast({
        title: "Site Assigned",
        description: "Site has been assigned to the user successfully.",
      });
      setSiteAssignmentConfirm(null);
      setSelectedSiteToAdd("");
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to assign site", 
        description: error.message,
        variant: "destructive" 
      });
      setSiteAssignmentConfirm(null);
    },
  });

  // Remove site assignment mutation
  const removeSiteAssignmentMutation = useMutation({
    mutationFn: async ({ userId, siteId }: { userId: string; siteId: string }) => {
      const response = await apiRequest("DELETE", `/api/users/${userId}/site-assignments/${siteId}`);
      return response.json();
    },
    onSuccess: () => {
      if (editingUser) {
        fetchUserSiteAssignments(editingUser.id);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/consultants"] });
      toast({
        title: "Site Removed",
        description: "Site has been removed from the user successfully.",
      });
      setSiteAssignmentConfirm(null);
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to remove site", 
        description: error.message,
        variant: "destructive" 
      });
      setSiteAssignmentConfirm(null);
    },
  });

  // Get available sites for assignment (filtered based on user role)
  const getAvailableSitesForUser = () => {
    if (!editingUser) return [];
    
    const assignedSiteIds = userSiteAssignments.map(a => a.siteId);
    
    if (editingUser.role === "consultant") {
      // Consultants can be assigned to any site
      return sites.filter(s => !assignedSiteIds.includes(s.id));
    } else if (editingUser.role === "client" && editingUser.companyId) {
      // Clients can only be assigned to sites in their company
      return sites.filter(s => s.companyId === editingUser.companyId && !assignedSiteIds.includes(s.id));
    }
    return [];
  };

  const handleAddSiteConfirm = () => {
    if (!editingUser || !selectedSiteToAdd) return;
    const site = sites.find(s => s.id === selectedSiteToAdd);
    if (site) {
      setSiteAssignmentConfirm({
        type: "add",
        siteId: selectedSiteToAdd,
        siteName: site.name,
      });
    }
  };

  const handleRemoveSiteClick = (siteId: string, siteName: string) => {
    setSiteAssignmentConfirm({
      type: "remove",
      siteId,
      siteName,
    });
  };

  const handleConfirmSiteAssignment = () => {
    if (!editingUser || !siteAssignmentConfirm) return;
    
    if (siteAssignmentConfirm.type === "add") {
      addSiteAssignmentMutation.mutate({
        userId: editingUser.id,
        siteId: siteAssignmentConfirm.siteId,
      });
    } else {
      removeSiteAssignmentMutation.mutate({
        userId: editingUser.id,
        siteId: siteAssignmentConfirm.siteId,
      });
    }
  };

  const createUserMutation = useMutation({
    mutationFn: async (data: typeof newUser) => {
      const payload = {
        ...data,
        consultantTier: data.consultantTier || null,
        companyId: data.companyId || null,
      };
      const response = await apiRequest("POST", "/api/users", payload);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsAddUserOpen(false);
      setNewUser({
        username: "",
        email: "",
        fullName: "",
        title: "",
        firstName: "",
        lastName: "",
        jobTitle: "",
        department: "",
        phone: "",
        mobile: "",
        preferredContactMethod: "email",
        notes: "",
        role: "client",
        companyId: "",
        consultantTier: "senior",
        clientPermissionRole: "owner",
      });
      // Show invite URL dialog if returned (for non-client users)
      if (data.inviteUrl) {
        setInviteUrl(data.inviteUrl);
        setShowInviteDialog(true);
      } else if (data.requiresSiteAssignment) {
        setShowSiteAssignmentMessage(true);
      } else {
        toast({
          title: "User Created",
          description: "New user has been created successfully.",
        });
      }
    },
    onError: () => {
      toast({ title: "Failed to create user", variant: "destructive" });
    },
  });

  const handleAddUser = () => {
    if (!newUser.username.trim() || !newUser.email.trim()) {
      toast({ title: "Username and email are required", variant: "destructive" });
      return;
    }
    // Clients must be assigned to a company
    if (newUser.role === "client" && !newUser.companyId) {
      toast({ title: "Company is required for client users", variant: "destructive" });
      return;
    }
    // Auto-generate fullName from firstName and lastName if not provided
    const fullName = newUser.fullName.trim() || 
      `${newUser.firstName} ${newUser.lastName}`.trim() || 
      newUser.username;
    createUserMutation.mutate({ ...newUser, fullName });
  };

  const resendInviteMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest("POST", `/api/users/${userId}/resend-invite`);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.inviteUrl) {
        setInviteUrl(data.inviteUrl);
        setShowInviteDialog(true);
      }
      toast({
        title: data.emailSent ? "Invitation Email Sent" : "Invitation Link Generated",
        description: data.emailSent 
          ? "An invitation email has been sent to the user."
          : "Email could not be sent. You can copy the link below to share manually.",
      });
    },
    onError: () => {
      toast({ title: "Failed to resend invitation", variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "inactive" }) => {
      return apiRequest("PATCH", `/api/users/${id}`, { status });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: variables.status === "active" ? "User Activated" : "User Deactivated",
        description: `User has been ${variables.status === "active" ? "activated" : "deactivated"} successfully.`,
      });
      setStatusConfirm(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update user status. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleToggleStatus = (targetUser: UserWithAssignments) => {
    const newStatus = targetUser.status === "active" ? "inactive" : "active";
    setStatusConfirm({ user: targetUser, newStatus });
  };

  const handleConfirmStatusChange = () => {
    if (statusConfirm) {
      updateStatusMutation.mutate({ id: statusConfirm.user.id, status: statusConfirm.newStatus });
    }
  };

  const handleCopyInviteLink = async () => {
    if (inviteUrl) {
      try {
        await navigator.clipboard.writeText(inviteUrl);
        toast({
          title: "Link Copied",
          description: "The invitation link has been copied to your clipboard.",
        });
      } catch (err) {
        toast({
          title: "Copy Failed",
          description: "Please copy the link manually.",
          variant: "destructive",
        });
      }
    }
  };

  const renderSiteAssignments = (u: UserWithAssignments) => {
    // For consultants with site assignments
    if (u.role === "consultant" && u.siteAssignments && u.siteAssignments.length > 0) {
      const displayCount = 6;
      const visibleAssignments = u.siteAssignments.slice(0, displayCount);
      const remainingCount = u.siteAssignments.length - displayCount;

      return (
        <div className="flex flex-wrap items-center gap-1">
          {visibleAssignments.map((a) => (
            <Badge
              key={a.siteId}
              variant="outline"
              className="text-xs"
              data-testid={`badge-site-${a.siteId}`}
            >
              {a.isPrimary && <Shield className="h-3 w-3 mr-1" />}
              {a.siteName}
            </Badge>
          ))}
          {remainingCount > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="secondary" className="text-xs cursor-default">
                  +{remainingCount} more
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-1">
                  {u.siteAssignments.slice(displayCount).map((a) => (
                    <div key={a.siteId} className="text-xs">
                      {a.isPrimary && "(Primary) "}
                      {a.siteName}
                    </div>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      );
    }

    if (u.role === "consultant") {
      return <span className="text-sm text-muted-foreground">No assignments</span>;
    }

    // For clients - show assigned sites from siteAssignments
    if (u.role === "client" && u.siteAssignments && u.siteAssignments.length > 0) {
      const displayCount = 6;
      const visibleAssignments = u.siteAssignments.slice(0, displayCount);
      const remainingCount = u.siteAssignments.length - displayCount;
      
      return (
        <div className="flex flex-wrap items-center gap-1">
          {visibleAssignments.map((a) => (
            <Badge
              key={a.siteId}
              variant="outline"
              className="text-xs"
              data-testid={`badge-site-${a.siteId}`}
            >
              {a.siteName}
            </Badge>
          ))}
          {remainingCount > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="secondary" className="text-xs cursor-default">
                  +{remainingCount} more
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-1">
                  {u.siteAssignments.slice(displayCount).map((a) => (
                    <div key={a.siteId} className="text-xs">
                      {a.siteName}
                    </div>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      );
    }
    
    if (u.role === "client") {
      return <span className="text-sm text-muted-foreground">No assignments</span>;
    }

    // For admins - show "All Sites"
    if (u.role === "admin") {
      return <span className="text-sm text-muted-foreground">All Sites</span>;
    }

    return <span className="text-sm text-muted-foreground">-</span>;
  };

  if (isLoadingUsers) {
    return (
      <div className="space-y-6 p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Skeleton className="h-9 w-48" />
            <Skeleton className="mt-2 h-5 w-64" />
          </div>
        </div>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Sites Assigned</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[1, 2, 3, 4, 5].map((i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-10 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Users</h1>
          <p className="mt-1 text-muted-foreground">
            {isAdmin ? "Manage all users across the platform" : "View client users"}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setIsAddUserOpen(true)} data-testid="button-add-user">
            <Plus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or username..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
            data-testid="input-search-users"
          />
        </div>

        {isAdmin && (
          <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v as UserRole | "all"); setPage(1); }}>
            <SelectTrigger className="w-[150px]" data-testid="select-role-filter">
              <SelectValue placeholder="All roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="admin">Administrators</SelectItem>
              <SelectItem value="consultant">Consultants</SelectItem>
              <SelectItem value="client">Clients</SelectItem>
            </SelectContent>
          </Select>
        )}

        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as typeof statusFilter); setPage(1); }}>
          <SelectTrigger className="w-[150px]" data-testid="select-status-filter">
            <SelectValue placeholder="All status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="site_required">Site Required</SelectItem>
            <SelectItem value="invite_required">Invite Required</SelectItem>
            <SelectItem value="invited">Invited</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>

        <Select value={companyFilter} onValueChange={(v) => { setCompanyFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[180px]" data-testid="select-company-filter">
            <SelectValue placeholder="All companies" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Companies</SelectItem>
            {companies.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Sites Assigned</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  {search || roleFilter !== "all" || statusFilter !== "all" || companyFilter !== "all"
                    ? "No users match your filters." 
                    : "No users found."}
                </TableCell>
              </TableRow>
            ) : (
              paginatedUsers.map((u) => (
                <TableRow key={u.id} data-testid={`row-user-${u.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-medium">
                        {u.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium">{u.fullName}</p>
                          {u.referenceNumber && (
                            <Badge variant="outline" className="font-mono text-xs">
                              {u.referenceNumber}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {u.companyId ? (
                      <div className="flex flex-col gap-1">
                        <span className="text-sm">
                          {companies.find(c => c.id === u.companyId)?.name || "-"}
                        </span>
                        {isPrimaryContact(u) && (
                          <Badge variant="outline" className="w-fit text-xs bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700">
                            Primary Contact
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={roleColors[u.role]}>
                      {roleLabels[u.role]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {renderSiteAssignments(u)}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={u.status === "active" ? "default" : u.status === "invited" || u.status === "invite_required" ? "outline" : u.status === "site_required" ? "outline" : "secondary"}
                      className={
                        u.status === "invited" ? "border-amber-500 text-amber-600 dark:text-amber-400" :
                        u.status === "invite_required" ? "border-blue-500 text-blue-600 dark:text-blue-400" :
                        u.status === "site_required" ? "border-orange-500 text-orange-600 dark:text-orange-400 cursor-pointer" : ""
                      }
                      onClick={u.status === "site_required" ? () => openEditDialog(u) : undefined}
                      data-testid={u.status === "site_required" ? `badge-status-clickable-${u.id}` : `badge-status-${u.id}`}
                    >
                      {u.status === "active" ? (
                        <><UserCheck className="h-3 w-3 mr-1" />Active</>
                      ) : u.status === "invited" ? (
                        <><Clock className="h-3 w-3 mr-1" />Invited</>
                      ) : u.status === "invite_required" ? (
                        <><Mail className="h-3 w-3 mr-1" />Invite Required</>
                      ) : u.status === "site_required" ? (
                        <><MapPin className="h-3 w-3 mr-1" />Site Required</>
                      ) : (
                        <><UserX className="h-3 w-3 mr-1" />Inactive</>
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid={`button-actions-${u.id}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setViewingUser(u)} data-testid={`button-view-profile-${u.id}`}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Profile
                        </DropdownMenuItem>
                        {isAdmin && (
                          <>
                            <DropdownMenuItem onClick={() => openEditDialog(u)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit User
                            </DropdownMenuItem>
                            {u.status === "invite_required" && (
                              <DropdownMenuItem 
                                onClick={() => resendInviteMutation.mutate(u.id)}
                                disabled={resendInviteMutation.isPending}
                                data-testid={`button-send-invite-${u.id}`}
                              >
                                <Mail className={`h-4 w-4 mr-2 ${resendInviteMutation.isPending ? 'animate-spin' : ''}`} />
                                Send Invitation
                              </DropdownMenuItem>
                            )}
                            {u.status === "invited" && (
                              <DropdownMenuItem 
                                onClick={() => resendInviteMutation.mutate(u.id)}
                                disabled={resendInviteMutation.isPending}
                                data-testid={`button-resend-invite-${u.id}`}
                              >
                                <RefreshCw className={`h-4 w-4 mr-2 ${resendInviteMutation.isPending ? 'animate-spin' : ''}`} />
                                Resend Invitation
                              </DropdownMenuItem>
                            )}
                            {u.status !== "invited" && u.status !== "site_required" && u.status !== "invite_required" && (
                              <DropdownMenuItem onClick={() => handleToggleStatus(u)}>
                                {u.status === "active" ? (
                                  <><UserX className="h-4 w-4 mr-2" />Deactivate</>
                                ) : (
                                  <><UserCheck className="h-4 w-4 mr-2" />Activate</>
                                )}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                          </>
                        )}
                        <DropdownMenuItem>
                          <Mail className="h-4 w-4 mr-2" />
                          Send Email
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * ITEMS_PER_PAGE + 1} to {Math.min(page * ITEMS_PER_PAGE, filteredUsers.length)} of {filteredUsers.length} users
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              data-testid="button-prev-page"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              data-testid="button-next-page"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={!!editingUser} onOpenChange={(open) => { if (!open) { setEditingUser(null); setEditFormData(null); } }}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user details and permissions
            </DialogDescription>
          </DialogHeader>
          {editingUser && editFormData && (
            <div className="grid gap-4 py-4">
              <div className="border-b pb-4">
                <h4 className="text-sm font-medium mb-3">Account Details</h4>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="edit-username">Username</Label>
                      <Input
                        id="edit-username"
                        value={editingUser.username}
                        disabled
                        className="bg-muted"
                        data-testid="input-edit-username"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit-email">Email</Label>
                      <Input
                        id="edit-email"
                        type="email"
                        value={editFormData.email}
                        onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                        data-testid="input-edit-email"
                      />
                    </div>
                  </div>
                  {editingUser.referenceNumber && (
                    <div className="flex items-center gap-2">
                      <Label>Reference:</Label>
                      <Badge variant="outline" className="font-mono">{editingUser.referenceNumber}</Badge>
                    </div>
                  )}
                </div>
              </div>

              <div className="border-b pb-4">
                <h4 className="text-sm font-medium mb-3">Personal Details</h4>
                <div className="space-y-3">
                  <div className="grid grid-cols-4 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="edit-title">Title</Label>
                      <Select value={editFormData.title} onValueChange={(v) => setEditFormData({ ...editFormData, title: v })}>
                        <SelectTrigger id="edit-title" data-testid="select-edit-title">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Mr">Mr</SelectItem>
                          <SelectItem value="Mrs">Mrs</SelectItem>
                          <SelectItem value="Ms">Ms</SelectItem>
                          <SelectItem value="Miss">Miss</SelectItem>
                          <SelectItem value="Dr">Dr</SelectItem>
                          <SelectItem value="Prof">Prof</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-3 grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="edit-firstname">First Name</Label>
                        <Input
                          id="edit-firstname"
                          value={editFormData.firstName}
                          onChange={(e) => setEditFormData({ ...editFormData, firstName: e.target.value })}
                          data-testid="input-edit-firstname"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="edit-lastname">Surname</Label>
                        <Input
                          id="edit-lastname"
                          value={editFormData.lastName}
                          onChange={(e) => setEditFormData({ ...editFormData, lastName: e.target.value })}
                          data-testid="input-edit-lastname"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="edit-jobtitle">Job Title</Label>
                      <Input
                        id="edit-jobtitle"
                        value={editFormData.jobTitle}
                        onChange={(e) => setEditFormData({ ...editFormData, jobTitle: e.target.value })}
                        data-testid="input-edit-jobtitle"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit-department">Department</Label>
                      <Input
                        id="edit-department"
                        value={editFormData.department}
                        onChange={(e) => setEditFormData({ ...editFormData, department: e.target.value })}
                        data-testid="input-edit-department"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-b pb-4">
                <h4 className="text-sm font-medium mb-3">Contact Details</h4>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="edit-phone">Phone</Label>
                      <Input
                        id="edit-phone"
                        value={editFormData.phone}
                        onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                        data-testid="input-edit-phone"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit-mobile">Mobile</Label>
                      <Input
                        id="edit-mobile"
                        value={editFormData.mobile}
                        onChange={(e) => setEditFormData({ ...editFormData, mobile: e.target.value })}
                        data-testid="input-edit-mobile"
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-preferred">Preferred Contact Method</Label>
                    <Select value={editFormData.preferredContactMethod} onValueChange={(v: "email" | "phone" | "mobile") => setEditFormData({ ...editFormData, preferredContactMethod: v })}>
                      <SelectTrigger id="edit-preferred" data-testid="select-edit-preferred">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="phone">Phone</SelectItem>
                        <SelectItem value="mobile">Mobile</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="border-b pb-4">
                <h4 className="text-sm font-medium mb-3">Role & Access</h4>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="edit-role">Role</Label>
                      <Select value={editFormData.role} onValueChange={(v: "admin" | "consultant" | "client") => setEditFormData({ ...editFormData, role: v })}>
                        <SelectTrigger id="edit-role" data-testid="select-edit-role">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Administrator</SelectItem>
                          <SelectItem value="consultant">Consultant</SelectItem>
                          <SelectItem value="client">Client</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {editFormData.role === "client" && (
                      <div className="grid gap-2">
                        <Label htmlFor="edit-company">Company</Label>
                        <Select value={editFormData.companyId} onValueChange={(v) => setEditFormData({ ...editFormData, companyId: v })}>
                          <SelectTrigger id="edit-company" data-testid="select-edit-company">
                            <SelectValue placeholder="Select company" />
                          </SelectTrigger>
                          <SelectContent>
                            {companies.map((company) => (
                              <SelectItem key={company.id} value={company.id}>
                                {company.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Site Assignments section - only for consultants and clients */}
              {editFormData.role !== "admin" && isAdmin && (
                <div className="border-b pb-4">
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Site Assignments
                  </h4>
                  
                  {editFormData.role === "client" && !editFormData.companyId && (
                    <p className="text-sm text-muted-foreground">
                      Please assign a company first before adding site assignments.
                    </p>
                  )}
                  
                  {(editFormData.role === "consultant" || (editFormData.role === "client" && editFormData.companyId)) && (
                    <div className="space-y-3">
                      {/* Current assignments */}
                      {userSiteAssignments.length > 0 ? (
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Currently assigned sites</Label>
                          <div className="flex flex-wrap gap-2">
                            {userSiteAssignments.map((assignment) => (
                              <Badge
                                key={assignment.siteId}
                                variant="secondary"
                                className="flex items-center gap-1 pr-1"
                              >
                                <span>{assignment.siteName}</span>
                                <span className="text-xs text-muted-foreground">({assignment.companyName})</span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-4 w-4 ml-1 hover:bg-destructive/20"
                                  onClick={() => handleRemoveSiteClick(assignment.siteId, assignment.siteName)}
                                  data-testid={`button-remove-site-${assignment.siteId}`}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No sites assigned yet.</p>
                      )}
                      
                      {/* Add new assignment */}
                      {getAvailableSitesForUser().length > 0 && (
                        <div className="flex items-end gap-2">
                          <div className="flex-1 grid gap-2">
                            <Label htmlFor="add-site" className="text-xs text-muted-foreground">Add site</Label>
                            <Select value={selectedSiteToAdd} onValueChange={setSelectedSiteToAdd}>
                              <SelectTrigger id="add-site" data-testid="select-add-site">
                                <SelectValue placeholder="Select a site to add" />
                              </SelectTrigger>
                              <SelectContent>
                                {getAvailableSitesForUser().map((site) => {
                                  const company = companies.find(c => c.id === site.companyId);
                                  return (
                                    <SelectItem key={site.id} value={site.id}>
                                      {site.name} {company ? `(${company.name})` : ""}
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleAddSiteConfirm}
                            disabled={!selectedSiteToAdd}
                            data-testid="button-add-site"
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add
                          </Button>
                        </div>
                      )}
                      
                      {getAvailableSitesForUser().length === 0 && userSiteAssignments.length > 0 && (
                        <p className="text-xs text-muted-foreground">All available sites have been assigned.</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div>
                <h4 className="text-sm font-medium mb-3">Additional Notes</h4>
                <div className="grid gap-2">
                  <Textarea
                    value={editFormData.notes}
                    onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                    placeholder="Any additional notes about this user..."
                    className="min-h-[80px]"
                    data-testid="textarea-edit-notes"
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditingUser(null); setEditFormData(null); }} data-testid="button-cancel-edit">
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateUserMutation.isPending} data-testid="button-save-edit">
              {updateUserMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Profile Dialog */}
      <Dialog open={!!viewingUser} onOpenChange={(open) => { if (!open) setViewingUser(null); }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>User Profile</DialogTitle>
            <DialogDescription>
              Full profile information
            </DialogDescription>
          </DialogHeader>
          {viewingUser && (
            <div className="space-y-6">
              {/* User Header */}
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-xl font-medium">
                  {viewingUser.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{viewingUser.fullName}</h3>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={roleColors[viewingUser.role]}>
                      {roleLabels[viewingUser.role]}
                    </Badge>
                    {viewingUser.referenceNumber && (
                      <Badge variant="outline" className="font-mono text-xs">
                        {viewingUser.referenceNumber}
                      </Badge>
                    )}
                    <Badge 
                      variant={viewingUser.status === "active" ? "default" : viewingUser.status === "invited" || viewingUser.status === "invite_required" || viewingUser.status === "site_required" ? "outline" : "secondary"}
                      className={
                        viewingUser.status === "invited" ? "border-amber-500 text-amber-600 dark:text-amber-400" :
                        viewingUser.status === "invite_required" ? "border-blue-500 text-blue-600 dark:text-blue-400" :
                        viewingUser.status === "site_required" ? "border-orange-500 text-orange-600 dark:text-orange-400" : ""
                      }
                    >
                      {viewingUser.status === "site_required" ? "Site Required" : 
                       viewingUser.status === "invite_required" ? "Invite Required" : 
                       viewingUser.status.charAt(0).toUpperCase() + viewingUser.status.slice(1)}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground">Contact Information</h4>
                <div className="grid gap-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{viewingUser.email}</span>
                  </div>
                  {viewingUser.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{viewingUser.phone}</span>
                    </div>
                  )}
                  {viewingUser.mobile && (
                    <div className="flex items-center gap-2 text-sm">
                      <Smartphone className="h-4 w-4 text-muted-foreground" />
                      <span>{viewingUser.mobile}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Work Information */}
              {(viewingUser.jobTitle || viewingUser.department) && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Work Information</h4>
                  <div className="grid gap-2">
                    {viewingUser.jobTitle && (
                      <div className="flex items-center gap-2 text-sm">
                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                        <span>{viewingUser.jobTitle}</span>
                      </div>
                    )}
                    {viewingUser.department && (
                      <div className="flex items-center gap-2 text-sm">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span>{viewingUser.department}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Company */}
              {viewingUser.companyId && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Company</h4>
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>{companies.find(c => c.id === viewingUser.companyId)?.name || "-"}</span>
                  </div>
                </div>
              )}

              {/* Site Assignments */}
              {viewingUser.siteAssignments && viewingUser.siteAssignments.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Assigned Sites</h4>
                  <div className="flex flex-wrap gap-2">
                    {viewingUser.siteAssignments.map((a) => (
                      <Badge key={a.siteId} variant="outline">
                        <MapPin className="h-3 w-3 mr-1" />
                        {a.siteName}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {viewingUser.notes && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Notes</h4>
                  <p className="text-sm bg-muted p-3 rounded-md">{viewingUser.notes}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingUser(null)}>
              Close
            </Button>
            {isAdmin && viewingUser && (
              <Button onClick={() => { setViewingUser(null); openEditDialog(viewingUser); }}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit User
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              Create a new user account with full profile details
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="border-b pb-4">
              <h4 className="text-sm font-medium mb-3">Personal Details</h4>
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="new-title">Title</Label>
                    <Select
                      value={newUser.title}
                      onValueChange={(value) => setNewUser({ ...newUser, title: value })}
                    >
                      <SelectTrigger id="new-title" data-testid="select-new-title">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Mr">Mr</SelectItem>
                        <SelectItem value="Mrs">Mrs</SelectItem>
                        <SelectItem value="Ms">Ms</SelectItem>
                        <SelectItem value="Miss">Miss</SelectItem>
                        <SelectItem value="Dr">Dr</SelectItem>
                        <SelectItem value="Prof">Prof</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-3 grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="new-firstname">First Name *</Label>
                      <Input
                        id="new-firstname"
                        value={newUser.firstName}
                        onChange={(e) => {
                          const firstName = e.target.value;
                          setNewUser({ 
                            ...newUser, 
                            firstName,
                            username: generateUsername(firstName, newUser.lastName)
                          });
                        }}
                        placeholder="First name"
                        data-testid="input-new-firstname"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="new-lastname">Surname *</Label>
                      <Input
                        id="new-lastname"
                        value={newUser.lastName}
                        onChange={(e) => {
                          const lastName = e.target.value;
                          setNewUser({ 
                            ...newUser, 
                            lastName,
                            username: generateUsername(newUser.firstName, lastName)
                          });
                        }}
                        placeholder="Surname"
                        data-testid="input-new-lastname"
                      />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="new-username" className="text-muted-foreground">
                      Username <span className="text-xs">(auto-generated)</span>
                    </Label>
                    <Input
                      id="new-username"
                      value={newUser.username}
                      onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                      placeholder="firstname.surname"
                      className="bg-muted/30"
                      data-testid="input-new-username"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="new-email">Email *</Label>
                    <Input
                      id="new-email"
                      type="email"
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      placeholder="email@company.com"
                      data-testid="input-new-email"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="new-jobtitle">Job Title</Label>
                    <Input
                      id="new-jobtitle"
                      value={newUser.jobTitle}
                      onChange={(e) => setNewUser({ ...newUser, jobTitle: e.target.value })}
                      placeholder="e.g., Safety Manager"
                      data-testid="input-new-jobtitle"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="new-department">Department</Label>
                    <Input
                      id="new-department"
                      value={newUser.department}
                      onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}
                      placeholder="e.g., Operations"
                      data-testid="input-new-department"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-b pb-4">
              <h4 className="text-sm font-medium mb-3">Contact Details</h4>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="new-phone">Phone</Label>
                    <Input
                      id="new-phone"
                      value={newUser.phone}
                      onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                      placeholder="+44 123 456 7890"
                      data-testid="input-new-phone"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="new-mobile">Mobile</Label>
                    <Input
                      id="new-mobile"
                      value={newUser.mobile}
                      onChange={(e) => setNewUser({ ...newUser, mobile: e.target.value })}
                      placeholder="+44 7xx xxx xxxx"
                      data-testid="input-new-mobile"
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="new-preferred-contact">Preferred Contact Method</Label>
                  <Select
                    value={newUser.preferredContactMethod}
                    onValueChange={(value: "email" | "phone" | "mobile") => setNewUser({ ...newUser, preferredContactMethod: value })}
                  >
                    <SelectTrigger id="new-preferred-contact" data-testid="select-new-preferred-contact">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="phone">Phone</SelectItem>
                      <SelectItem value="mobile">Mobile</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="border-b pb-4">
              <h4 className="text-sm font-medium mb-3">Role & Access</h4>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="new-role">Role *</Label>
                    <Select
                      value={newUser.role}
                      onValueChange={(value: "admin" | "consultant" | "client") => setNewUser({ ...newUser, role: value })}
                    >
                      <SelectTrigger id="new-role" data-testid="select-new-role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Administrator</SelectItem>
                        <SelectItem value="consultant">Consultant</SelectItem>
                        <SelectItem value="client">Client</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {newUser.role === "client" && (
                    <div className="grid gap-2">
                      <Label htmlFor="new-company">Company <span className="text-destructive">*</span></Label>
                      <Select
                        value={newUser.companyId}
                        onValueChange={(value) => setNewUser({ ...newUser, companyId: value })}
                      >
                        <SelectTrigger id="new-company" data-testid="select-new-company">
                          <SelectValue placeholder="Select company (required)" />
                        </SelectTrigger>
                        <SelectContent>
                          {companies.map((company) => (
                            <SelectItem key={company.id} value={company.id}>
                              {company.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-3">Additional Notes</h4>
              <div className="grid gap-2">
                <Textarea
                  value={newUser.notes}
                  onChange={(e) => setNewUser({ ...newUser, notes: e.target.value })}
                  placeholder="Any additional notes about this user..."
                  className="min-h-[80px]"
                  data-testid="textarea-new-notes"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddUserOpen(false)} data-testid="button-cancel-add">
              Cancel
            </Button>
            <Button onClick={handleAddUser} disabled={createUserMutation.isPending} data-testid="button-create-user">
              {createUserMutation.isPending ? "Creating..." : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link className="h-5 w-5" />
              Invitation Link
            </DialogTitle>
            <DialogDescription>
              Share this link with the user so they can set up their password and activate their account. 
              The link expires in 48 hours.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center gap-2">
              <Input
                value={inviteUrl || ""}
                readOnly
                className="flex-1 font-mono text-sm"
                data-testid="input-invite-url"
              />
              <Button 
                variant="outline" 
                size="icon"
                onClick={handleCopyInviteLink}
                data-testid="button-copy-invite"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-3">
              Copy this link and share it securely with the new user. They will be prompted to create a password when they click the link.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowInviteDialog(false)} data-testid="button-close-invite-dialog">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Client Site Assignment Required Message Dialog */}
      <Dialog open={showSiteAssignmentMessage} onOpenChange={setShowSiteAssignmentMessage}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Site Assignment Required
            </DialogTitle>
            <DialogDescription>
              The client user has been created successfully, but an invitation cannot be sent yet.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Before an invitation link can be sent, the client must be either:
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <span>Assigned to at least one site</span>
              </li>
              <li className="flex items-start gap-2">
                <Building2 className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <span>Added as the primary contact for a company</span>
              </li>
            </ul>
            <p className="text-sm text-muted-foreground mt-4">
              Once assigned, you can send the invitation from the Users page using the resend invite option.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowSiteAssignmentMessage(false)} data-testid="button-close-site-assignment-message">
              Understood
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Site Assignment Confirmation Dialog */}
      <Dialog open={!!siteAssignmentConfirm} onOpenChange={(open) => { if (!open) setSiteAssignmentConfirm(null); }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {siteAssignmentConfirm?.type === "add" ? "Confirm Site Assignment" : "Confirm Site Removal"}
            </DialogTitle>
            <DialogDescription>
              {siteAssignmentConfirm?.type === "add" ? (
                <>
                  Are you sure you want to assign <strong>{editingUser?.fullName}</strong> to <strong>{siteAssignmentConfirm?.siteName}</strong>?
                </>
              ) : (
                <>
                  Are you sure you want to remove <strong>{editingUser?.fullName}</strong> from <strong>{siteAssignmentConfirm?.siteName}</strong>?
                  <br /><br />
                  This will revoke their access to this site's documents and compliance data.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => setSiteAssignmentConfirm(null)}
              data-testid="button-cancel-site-assignment"
            >
              Cancel
            </Button>
            <Button 
              variant={siteAssignmentConfirm?.type === "remove" ? "destructive" : "default"}
              onClick={handleConfirmSiteAssignment}
              disabled={addSiteAssignmentMutation.isPending || removeSiteAssignmentMutation.isPending}
              data-testid="button-confirm-site-assignment"
            >
              {addSiteAssignmentMutation.isPending || removeSiteAssignmentMutation.isPending 
                ? "Processing..." 
                : siteAssignmentConfirm?.type === "add" ? "Yes, Assign Site" : "Yes, Remove Site"
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Status Confirmation Dialog */}
      <AlertDialog open={!!statusConfirm} onOpenChange={(open) => !open && setStatusConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {statusConfirm?.newStatus === "inactive" ? "Deactivate User" : "Activate User"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {statusConfirm?.newStatus === "inactive" ? (
                <>
                  Are you sure you want to deactivate <strong>{statusConfirm?.user.fullName}</strong>?
                  <span className="block mt-2 text-foreground">
                    This will prevent them from logging in and accessing the portal.
                  </span>
                </>
              ) : (
                <>
                  Are you sure you want to activate <strong>{statusConfirm?.user.fullName}</strong>?
                  <span className="block mt-2 text-foreground">
                    This will restore their access to the portal.
                  </span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-status-change">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmStatusChange}
              disabled={updateStatusMutation.isPending}
              className={statusConfirm?.newStatus === "inactive" ? "bg-destructive text-destructive-foreground" : ""}
              data-testid="button-confirm-status-change"
            >
              {updateStatusMutation.isPending 
                ? "Processing..." 
                : statusConfirm?.newStatus === "inactive" ? "Yes, Deactivate" : "Yes, Activate"
              }
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
