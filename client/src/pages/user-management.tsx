import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  ChevronDown,
  RefreshCw,
  Trash2,
  Clock,
  MapPin,
  X,
  AlertTriangle,
  Eye,
  Phone,
  Smartphone,
  Briefcase,
  LockKeyhole,
  Activity,
  FileText,
  CheckCircle,
  XCircle,
  LogIn,
  Send,
  RotateCcw,
  MessageSquare,
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
  status: "active" | "inactive" | "invited" | "site_required" | "invite_required" | "locked";
  lastLogin: string | null;
  lastLoginAt?: string | null;
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

const toTitleCase = (str: string): string => {
  return str
    .trim()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

export default function UserManagement() {
  const { user } = useAuth();
  const isPro = user?.role === "consultant" && user?.consultantTier === "pro";
  const isAdmin = user?.role === "admin";
  const canAddUser = isAdmin || isPro;
  const isConsultant = user?.role === "consultant";
  const { toast } = useToast();
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const companyFilter = selectedCompany || "all";
  const setCompanyFilter = (val: string) => setSelectedCompany(val === "all" ? null : val);
  const handleCompanyChange = (val: string | null) => setSelectedCompany(val);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "invited" | "site_required" | "invite_required" | "locked" | "all">("all");
  const [page, setPage] = useState(1);
  const [editingUser, setEditingUser] = useState<UserWithAssignments | null>(null);
  const [viewingUser, setViewingUser] = useState<UserWithAssignments | null>(null);
  const { data: userActivityLogs = [], isLoading: isActivityLoading } = useQuery<any[]>({
    queryKey: ["/api/users", viewingUser?.id, "activity"],
    queryFn: async () => {
      if (!viewingUser?.id) return [];
      const res = await fetch(`/api/users/${viewingUser.id}/activity`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!viewingUser?.id,
    staleTime: 0,
  });
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
    preferredContactMethod: "email" | "phone" | "mobile" | "any";
    notes: string;
    role: "admin" | "consultant" | "client";
    companyId: string;
    consultantTier: string;
    clientPermissionRole: string;
  } | null>(null);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [mobileError, setMobileError] = useState<string | null>(null);
  const [companySearchQuery, setCompanySearchQuery] = useState("");
  const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false);
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
    preferredContactMethod: "email" as "email" | "phone" | "mobile" | "any",
    notes: "",
    role: "client" as "admin" | "consultant" | "client",
    companyId: "",
    consultantTier: "pro" as "" | "standard" | "pro" | "principal",
    clientPermissionRole: "owner" as "viewer" | "contributor" | "manager" | "owner",
  });
  
  const [showSiteAssignmentMessage, setShowSiteAssignmentMessage] = useState(false);
  const [userNeedingSiteAssignment, setUserNeedingSiteAssignment] = useState<UserWithAssignments | null>(null);
  
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
  const [manageSitesUser, setManageSitesUser] = useState<UserWithAssignments | null>(null);
  const [pendingAddSiteIds, setPendingAddSiteIds] = useState<string[]>([]);
  const [pendingRemoveSiteIds, setPendingRemoveSiteIds] = useState<string[]>([]);
  const [showManageSitesSaveConfirm, setShowManageSitesSaveConfirm] = useState(false);
  const [showManageSitesCancelConfirm, setShowManageSitesCancelConfirm] = useState(false);
  const [isSavingManageSites, setIsSavingManageSites] = useState(false);
  const [setPrimaryContact, setSetPrimaryContact] = useState(false);
  const [inviteConfirmUser, setInviteConfirmUser] = useState<UserWithAssignments | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [primaryContactConflictInUM, setPrimaryContactConflictInUM] = useState<{
    oldUserId: string;
    oldUserName: string;
    companyId: string;
    newUserId: string;
  } | null>(null);

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

  const { data: companiesResponse } = useQuery<{ companies: { id: string; name: string; contactEmail?: string | null; contactName?: string | null; contactUserId?: string | null }[] }>({
    queryKey: ["/api/companies"],
    enabled: isAdmin || isConsultant,
  });
  const companies = companiesResponse?.companies || [];
  const filteredCompanies = companySearchQuery.trim() === "" 
    ? companies 
    : companies.filter(c => c.name.toLowerCase().includes(companySearchQuery.toLowerCase()));

  // Helper to check if a user is a primary contact for their company
  const isPrimaryContact = (u: UserWithAssignments) => {
    if (u.role !== "client" || !u.companyId) return false;
    const company = companies.find(c => c.id === u.companyId);
    if (!company) return false;
    if (company.contactUserId && company.contactUserId === u.id) return true;
    if (company.contactEmail && u.email && company.contactEmail.toLowerCase() === u.email.toLowerCase()) return true;
    return false;
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
    if (isPro) return usersWithSiteInfo.filter((u) => u.role === "consultant" || u.role === "client");
    if (isConsultant) return usersWithSiteInfo.filter((u) => u.role === "client");
    return [];
  };

  const roleOrder: Record<string, number> = { admin: 0, consultant: 1, client: 2 };

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
  }).sort((a, b) => {
    const roleA = roleOrder[a.role] ?? 3;
    const roleB = roleOrder[b.role] ?? 3;
    if (roleA !== roleB) return roleA - roleB;
    if (a.role === "client" && b.role === "client") {
      const compA = (a.companyName || "").toLowerCase();
      const compB = (b.companyName || "").toLowerCase();
      if (compA !== compB) return compA.localeCompare(compB);
    }
    return a.fullName.toLowerCase().localeCompare(b.fullName.toLowerCase());
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
      consultantTier: u.consultantTier || "standard",
      clientPermissionRole: "owner",
    });
    setUserSiteAssignments([]);
    setSelectedSiteToAdd("");
  };

  const openManageSitesDialog = (u: UserWithAssignments) => {
    setManageSitesUser(u);
    setPendingAddSiteIds([]);
    setPendingRemoveSiteIds([]);
    setShowManageSitesSaveConfirm(false);
    setShowManageSitesCancelConfirm(false);
    fetchUserSiteAssignments(u.id);
  };

  const closeManageSites = () => {
    setManageSitesUser(null);
    setUserSiteAssignments([]);
    setPendingAddSiteIds([]);
    setPendingRemoveSiteIds([]);
    setShowManageSitesSaveConfirm(false);
    setShowManageSitesCancelConfirm(false);
  };

  const handleManageSitesCloseRequest = () => {
    if (pendingAddSiteIds.length > 0 || pendingRemoveSiteIds.length > 0) {
      setShowManageSitesCancelConfirm(true);
    } else {
      closeManageSites();
    }
  };

  // Effective assigned = (current assignments minus pending removes) plus pending adds
  const getEffectiveAssigned = () => {
    const fromCurrent = userSiteAssignments
      .filter(a => !pendingRemoveSiteIds.includes(a.siteId))
      .map(a => ({ siteId: a.siteId, siteName: a.siteName, companyName: a.companyName, companyId: a.companyId, isPrimary: a.isPrimary }));
    const fromPending = pendingAddSiteIds.map(siteId => {
      const site = sites.find(s => s.id === siteId);
      const company = companies.find(c => c.id === site?.companyId);
      return { siteId, siteName: site?.name || siteId, companyName: company?.name || "", companyId: site?.companyId || "", isPrimary: false };
    });
    return [...fromCurrent, ...fromPending];
  };

  // Sites not in effective assigned, grouped by company
  const getAvailableSitesByCompanyForManage = () => {
    const effectiveIds = getEffectiveAssigned().map(a => a.siteId);
    const available = sites.filter(s => !effectiveIds.includes(s.id));
    const grouped: Record<string, { company: typeof companies[0]; sites: typeof sites }> = {};
    for (const site of available) {
      if (!grouped[site.companyId]) {
        const company = companies.find(c => c.id === site.companyId);
        if (company) grouped[site.companyId] = { company, sites: [] };
      }
      if (grouped[site.companyId]) grouped[site.companyId].sites.push(site);
    }
    return Object.values(grouped);
  };

  const manageSitesAddSite = (siteId: string) => {
    if (pendingRemoveSiteIds.includes(siteId)) {
      setPendingRemoveSiteIds(prev => prev.filter(id => id !== siteId));
    } else {
      setPendingAddSiteIds(prev => [...prev, siteId]);
    }
  };

  const manageSitesRemoveSite = (siteId: string) => {
    if (pendingAddSiteIds.includes(siteId)) {
      setPendingAddSiteIds(prev => prev.filter(id => id !== siteId));
    } else {
      setPendingRemoveSiteIds(prev => [...prev, siteId]);
    }
  };

  const manageSitesAddAllFromCompany = (companyId: string) => {
    const availableGroups = getAvailableSitesByCompanyForManage();
    const group = availableGroups.find(g => g.company.id === companyId);
    if (!group) return;
    const toAdd = group.sites.map(s => s.id);
    const notAlreadyPending = toAdd.filter(id => !pendingAddSiteIds.includes(id));
    setPendingAddSiteIds(prev => [...prev, ...notAlreadyPending]);
    const stillRemoved = pendingRemoveSiteIds.filter(id => !toAdd.includes(id));
    setPendingRemoveSiteIds(stillRemoved);
  };

  const saveManageSitesChanges = async () => {
    if (!manageSitesUser) return;
    setIsSavingManageSites(true);
    try {
      for (const siteId of pendingAddSiteIds) {
        await apiRequest("POST", `/api/users/${manageSitesUser.id}/site-assignments/${siteId}`, {});
      }
      for (const siteId of pendingRemoveSiteIds) {
        await apiRequest("DELETE", `/api/users/${manageSitesUser.id}/site-assignments/${siteId}`);
      }
      queryClient.refetchQueries({ queryKey: ["/api/users"] });
      queryClient.refetchQueries({ queryKey: ["/api/consultants"] });
      const addCount = pendingAddSiteIds.length;
      const removeCount = pendingRemoveSiteIds.length;
      const parts = [];
      if (addCount > 0) parts.push(`${addCount} site${addCount !== 1 ? "s" : ""} added`);
      if (removeCount > 0) parts.push(`${removeCount} site${removeCount !== 1 ? "s" : ""} removed`);
      toast({ title: "Site assignments saved", description: parts.join(", ") });
      closeManageSites();
    } catch {
      toast({ title: "Failed to save site assignments", variant: "destructive" });
    } finally {
      setIsSavingManageSites(false);
      setShowManageSitesSaveConfirm(false);
    }
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
      queryClient.refetchQueries({ queryKey: ["/api/users"] });
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
      queryClient.refetchQueries({ queryKey: ["/api/users"] });
      queryClient.refetchQueries({ queryKey: ["/api/consultants"] });
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
      queryClient.refetchQueries({ queryKey: ["/api/users"] });
      queryClient.refetchQueries({ queryKey: ["/api/consultants"] });
      toast({
        title: "Site Removed",
        description: "Site has been removed from the user successfully.",
      });
      setSiteAssignmentConfirm(null);
    },
    onError: (error: Error) => {
      const description = error.message.includes("Cannot remove the last site")
        ? "Cannot remove the last site assignment from a client user. Assign another site first."
        : error.message;
      toast({ 
        title: "Failed to remove site", 
        description,
        variant: "destructive" 
      });
      setSiteAssignmentConfirm(null);
    },
  });

  const setPrimaryContactMutation = useMutation({
    mutationFn: async ({ companyId, userId }: { companyId: string; userId: string }) => {
      const response = await apiRequest("PATCH", `/api/companies/${companyId}`, { contactUserId: userId });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to set primary contact");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["/api/users"] });
      queryClient.refetchQueries({ queryKey: ["/api/companies"] });
      setShowSiteAssignmentMessage(false);
      setUserNeedingSiteAssignment(null);
      setSetPrimaryContact(false);
      toast({ title: "Primary contact set", description: "User is now the primary contact and has been assigned to all company sites." });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to set primary contact", description: error.message, variant: "destructive" });
    },
  });

  const clearOldContactSitesMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest("DELETE", `/api/users/${userId}/site-assignments`);
    },
  });

  const handleSetPrimaryContactClick = () => {
    if (!userNeedingSiteAssignment?.companyId) return;
    const targetCompany = companies.find(c => c.id === userNeedingSiteAssignment.companyId);
    const existingContactId = targetCompany?.contactUserId;
    if (existingContactId && existingContactId !== userNeedingSiteAssignment.id) {
      const oldUser = allUsers.find(u => u.id === existingContactId);
      const oldName = oldUser?.fullName || targetCompany?.contactName || "the current contact";
      setPrimaryContactConflictInUM({
        oldUserId: existingContactId,
        oldUserName: oldName,
        companyId: userNeedingSiteAssignment.companyId!,
        newUserId: userNeedingSiteAssignment.id,
      });
    } else {
      setPrimaryContactMutation.mutate({ companyId: userNeedingSiteAssignment.companyId!, userId: userNeedingSiteAssignment.id });
    }
  };

  const handleConflictResolveInUM = async (removeAccess: boolean) => {
    if (!primaryContactConflictInUM) return;
    if (removeAccess) {
      await clearOldContactSitesMutation.mutateAsync(primaryContactConflictInUM.oldUserId);
    }
    setPrimaryContactMutation.mutate({ companyId: primaryContactConflictInUM.companyId, userId: primaryContactConflictInUM.newUserId });
    setPrimaryContactConflictInUM(null);
  };

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
    const activeUser = manageSitesUser || editingUser;
    if (!activeUser || !siteAssignmentConfirm) return;
    
    if (siteAssignmentConfirm.type === "add") {
      addSiteAssignmentMutation.mutate({
        userId: activeUser.id,
        siteId: siteAssignmentConfirm.siteId,
      });
    } else {
      removeSiteAssignmentMutation.mutate({
        userId: activeUser.id,
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
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create user");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.refetchQueries({ queryKey: ["/api/users"] });
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
        consultantTier: "pro",
        clientPermissionRole: "owner",
      });
      if (data.requiresSiteAssignment) {
        setUserNeedingSiteAssignment(data);
        setShowSiteAssignmentMessage(true);
      } else {
        toast({
          title: "User Created",
          description: data.emailSent 
            ? "User created and invitation email sent successfully."
            : "New user has been created successfully.",
        });
      }
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to create user", 
        description: error.message,
        variant: "destructive" 
      });
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
      queryClient.refetchQueries({ queryKey: ["/api/users"] });
      if (data.emailSent) {
        toast({
          title: "Invitation Email Sent",
          description: "An invitation email has been sent to the user.",
        });
      } else {
        toast({
          title: "Email Failed",
          description: data.error || "The invitation email could not be sent. Please try again later.",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      const description = error.message.includes(":")
        ? error.message.split(":").slice(1).join(":").trim()
        : error.message;
      let parsed = description;
      try { parsed = JSON.parse(description).error || description; } catch {}
      toast({ title: "Failed to send invitation", description: parsed, variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "inactive" }) => {
      return apiRequest("PATCH", `/api/users/${id}`, { status });
    },
    onSuccess: (_, variables) => {
      queryClient.refetchQueries({ queryKey: ["/api/users"] });
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

  const unlockUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("PATCH", `/api/users/${userId}`, { status: "active" });
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["/api/users"] });
      toast({ title: "Account Unlocked", description: "The user account has been unlocked and set to active." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to unlock account. Please try again.", variant: "destructive" });
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

  const [deleteConfirm, setDeleteConfirm] = useState<UserWithAssignments | null>(null);

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest("DELETE", `/api/users/${userId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["/api/users"] });
      toast({
        title: "User Deleted",
        description: "The user has been permanently deleted. All audit logs have been preserved.",
      });
      setDeleteConfirm(null);
    },
    onError: (error: Error) => {
      const description = error.message.includes(":")
        ? error.message.split(":").slice(1).join(":").trim()
        : error.message;
      let parsed = description;
      try { parsed = JSON.parse(description).error || description; } catch {}
      toast({ title: "Failed to delete user", description: parsed, variant: "destructive" });
      setDeleteConfirm(null);
    },
  });

  const renderSiteAssignments = (u: UserWithAssignments) => {
    if (u.role === "admin") {
      return <span className="text-xs text-muted-foreground leading-[22px] pl-2.5">All Sites</span>;
    }

    if (!u.siteAssignments || u.siteAssignments.length === 0) {
      return <span className="text-xs text-muted-foreground leading-[22px] pl-2.5">No assignments</span>;
    }

    const count = u.siteAssignments.length;

    if (u.role === "consultant") {
      const grouped: Record<string, SiteAssignment[]> = {};
      u.siteAssignments.forEach((a) => {
        const company = a.companyName || "Unassigned";
        if (!grouped[company]) grouped[company] = [];
        grouped[company].push(a);
      });
      const sortedCompanies = Object.keys(grouped).sort((a, b) => a.localeCompare(b));

      return (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold cursor-pointer hover-elevate"
              data-testid={`badge-sites-count-${u.id}`}
            >
              <MapPin className="h-3 w-3 mr-1" />
              {count} {count === 1 ? "site" : "sites"}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 max-h-72 overflow-y-auto p-3" align="start">
            <p className="text-sm font-medium mb-2">Assigned Sites</p>
            <div className="space-y-3">
              {sortedCompanies.map((company) => (
                <div key={company}>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">{company}</p>
                  <div className="space-y-0.5 pl-2">
                    {grouped[company].sort((a, b) => a.siteName.localeCompare(b.siteName)).map((a) => (
                      <div key={a.siteId} className="flex items-center gap-1 text-xs">
                        {a.isPrimary && <Shield className="h-3 w-3 text-amber-500 shrink-0" />}
                        <span>{a.siteName}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      );
    }

    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold cursor-pointer hover-elevate"
            data-testid={`badge-sites-count-${u.id}`}
          >
            <MapPin className="h-3 w-3 mr-1" />
            {count} {count === 1 ? "site" : "sites"}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 max-h-72 overflow-y-auto p-3" align="start">
          <p className="text-sm font-medium mb-2">Assigned Sites</p>
          <div className="space-y-0.5">
            {u.siteAssignments.sort((a, b) => a.siteName.localeCompare(b.siteName)).map((a) => (
              <div key={a.siteId} className="text-xs">{a.siteName}</div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    );
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
                <TableHead className="min-w-[160px]">Company</TableHead>
                <TableHead className="w-24">Role</TableHead>
                <TableHead>Sites Assigned</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-32">Last Login</TableHead>
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
                  <TableCell><Skeleton className="h-6 w-24" /></TableCell>
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
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-4 shrink-0 px-8 py-6 bg-background border-b">
        <div>
          <h1 className="text-3xl font-semibold">Users</h1>
          <p className="mt-1 text-muted-foreground">
            {canAddUser ? "Manage users across the platform" : "View client users"}
          </p>
        </div>
        {canAddUser && (
          <Button onClick={() => setIsAddUserOpen(true)} data-testid="button-add-user">
            <Plus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        )}
      </div>

      <div id="page-content" className="flex-1 overflow-auto px-8 pb-8 pt-6 space-y-6 dash-animate">

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

        {canAddUser && (
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
            <SelectItem value="locked">Locked</SelectItem>
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
              <TableHead className="w-24">Role</TableHead>
              <TableHead className="min-w-[160px]">Company</TableHead>
              <TableHead>Sites Assigned</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-32">Last Login</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  {search || roleFilter !== "all" || statusFilter !== "all" || companyFilter !== "all"
                    ? "No users match your filters." 
                    : "No users found."}
                </TableCell>
              </TableRow>
            ) : (
              paginatedUsers.flatMap((u) => {
                const isExpanded = expandedUserId === u.id;
                const hasSites = u.siteAssignments && u.siteAssignments.length > 0;
                return [
                <TableRow 
                  key={u.id} 
                  data-testid={`row-user-${u.id}`}
                  className={u.role !== "admin" && (!u.siteAssignments || u.siteAssignments.length === 0) ? "bg-red-50 dark:bg-red-950/30" : ""}
                >
                  <TableCell>
                    <button
                      className="flex items-center gap-3 text-left hover:opacity-75 transition-opacity"
                      onClick={() => setViewingUser(u)}
                      data-testid={`button-view-name-${u.id}`}
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-medium shrink-0">
                        {u.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </div>
                      <div>
                        <p className="font-medium underline-offset-2 hover:underline">{u.fullName}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                        <p className="text-xs text-muted-foreground">{u.username}</p>
                      </div>
                    </button>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge variant="outline" className={roleColors[u.role]}>
                        {roleLabels[u.role]}
                      </Badge>
                      {u.role === "consultant" && u.consultantTier && (
                        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground ml-1">
                          {u.consultantTier}
                        </span>
                      )}
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
                    {u.role === "admin" ? (
                      <button
                        onClick={() => setExpandedUserId(isExpanded ? null : u.id)}
                        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                        data-testid={`button-expand-sites-${u.id}`}
                      >
                        <span className="font-medium">All Sites</span>
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                      </button>
                    ) : u.siteAssignments && u.siteAssignments.length > 0 ? (
                      <button
                        onClick={() => setExpandedUserId(isExpanded ? null : u.id)}
                        className="flex items-center gap-1.5 text-sm hover:text-foreground transition-colors"
                        data-testid={`button-expand-sites-${u.id}`}
                      >
                        <span className="font-medium">{u.siteAssignments.length} {u.siteAssignments.length === 1 ? "site" : "sites"}</span>
                        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                      </button>
                    ) : (
                      <span className="text-sm text-muted-foreground">None</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={u.status === "active" ? "default" : u.status === "invited" || u.status === "invite_required" || u.status === "site_required" || u.status === "locked" ? "outline" : "secondary"}
                      className={
                        u.status === "invited" ? "border-amber-500 text-amber-600 dark:text-amber-400 cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors" :
                        u.status === "invite_required" ? "border-blue-500 text-blue-600 dark:text-blue-400 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors" :
                        u.status === "site_required" ? "border-orange-500 text-orange-600 dark:text-orange-400 cursor-pointer" :
                        u.status === "locked" ? "border-red-500 text-red-600 dark:text-red-400" : ""
                      }
                      onClick={u.status === "site_required" ? () => {
                        setUserNeedingSiteAssignment(u);
                        setShowSiteAssignmentMessage(true);
                      } : u.status === "invite_required" || u.status === "invited" ? () => setInviteConfirmUser(u) : undefined}
                      data-testid={u.status === "site_required" ? `badge-status-clickable-${u.id}` : u.status === "invite_required" ? `badge-invite-required-${u.id}` : u.status === "invited" ? `badge-invited-${u.id}` : `badge-status-${u.id}`}
                    >
                      {u.status === "active" ? (
                        <><UserCheck className="h-3 w-3 mr-1" />Active</>
                      ) : u.status === "invited" ? (
                        <><Clock className="h-3 w-3 mr-1" />Invited</>
                      ) : u.status === "invite_required" ? (
                        <><Mail className="h-3 w-3 mr-1" />Invite Required</>
                      ) : u.status === "site_required" ? (
                        <><MapPin className="h-3 w-3 mr-1" />Site Required</>
                      ) : u.status === "locked" ? (
                        <><LockKeyhole className="h-3 w-3 mr-1" />Locked</>
                      ) : (
                        <><UserX className="h-3 w-3 mr-1" />Inactive</>
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const loginAt = u.lastLoginAt || u.lastLogin;
                      if (!loginAt) return <span className="text-sm text-muted-foreground">Never</span>;
                      const d = new Date(loginAt);
                      const diffMs = Date.now() - d.getTime();
                      const diffMins = Math.floor(diffMs / 60000);
                      const diffHours = Math.floor(diffMs / 3600000);
                      const diffDays = Math.floor(diffMs / 86400000);
                      let relative: string;
                      if (diffMins < 1) relative = "Just now";
                      else if (diffMins < 60) relative = `${diffMins}m ago`;
                      else if (diffHours < 24) relative = `${diffHours}h ago`;
                      else if (diffDays === 1) relative = "Yesterday";
                      else if (diffDays < 7) relative = `${diffDays}d ago`;
                      else relative = d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
                      return (
                        <span className="text-sm text-muted-foreground" title={d.toLocaleString()}>
                          {relative}
                        </span>
                      );
                    })()}
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
                        {(isAdmin || (isPro && u.role === "consultant")) && (
                          <>
                            <DropdownMenuItem onClick={() => openEditDialog(u)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit User
                            </DropdownMenuItem>
                          </>
                        )}
                        {(isAdmin || isPro) && u.role !== "admin" && (
                          <DropdownMenuItem onClick={() => openManageSitesDialog(u)} data-testid={`button-manage-sites-${u.id}`}>
                            <MapPin className="h-4 w-4 mr-2" />
                            Manage Sites
                          </DropdownMenuItem>
                        )}
                        {(isAdmin || isConsultant) && (
                          <>
                            {u.status === "invite_required" && (
                              <DropdownMenuItem 
                                onClick={() => setInviteConfirmUser(u)}
                                data-testid={`button-send-invite-${u.id}`}
                              >
                                <Mail className="h-4 w-4 mr-2" />
                                Send Invitation
                              </DropdownMenuItem>
                            )}
                            {u.status === "invited" && (
                              <DropdownMenuItem 
                                onClick={() => setInviteConfirmUser(u)}
                                data-testid={`button-resend-invite-${u.id}`}
                              >
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Resend Invitation
                              </DropdownMenuItem>
                            )}
                          </>
                        )}
                        {isAdmin && (
                          <>
                            {u.status === "locked" && (
                              <DropdownMenuItem 
                                onClick={() => unlockUserMutation.mutate(u.id)}
                                data-testid={`button-unlock-${u.id}`}
                                className="text-red-600 focus:text-red-600"
                              >
                                <LockKeyhole className="h-4 w-4 mr-2" />
                                Unlock Account
                              </DropdownMenuItem>
                            )}
                            {u.status !== "invited" && u.status !== "site_required" && u.status !== "invite_required" && u.status !== "locked" && (
                              <DropdownMenuItem onClick={() => handleToggleStatus(u)}>
                                {u.status === "active" ? (
                                  <><UserX className="h-4 w-4 mr-2" />Deactivate</>
                                ) : (
                                  <><UserCheck className="h-4 w-4 mr-2" />Activate</>
                                )}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {u.role !== "admin" && (
                              <DropdownMenuItem 
                                onClick={() => setDeleteConfirm(u)}
                                className="text-destructive focus:text-destructive"
                                data-testid={`button-delete-user-${u.id}`}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete User
                              </DropdownMenuItem>
                            )}
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>,
                isExpanded && (hasSites || u.role === "admin") && (
                  <TableRow key={`expand-${u.id}`} className="bg-muted/30">
                    <TableCell colSpan={7} className="py-3 px-6">
                      <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                        {u.role === "admin" ? "Access" : "Site Access"}
                      </p>
                      {u.role === "admin" ? (
                        <p className="text-sm text-muted-foreground">Full access to all sites</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {u.role === "consultant" ? (
                            u.siteAssignments!.map(a => (
                              <div key={a.siteId} className="flex items-center gap-1.5 text-xs bg-background border rounded-md px-2.5 py-1.5">
                                {a.isPrimary && <Shield className="h-3 w-3 text-amber-500 shrink-0" />}
                                <span className="font-medium">{a.siteName}</span>
                                <span className="text-muted-foreground">· {a.companyName}</span>
                              </div>
                            ))
                          ) : (
                            u.siteAssignments!.map(a => (
                              <div key={a.siteId} className="flex items-center gap-1.5 text-xs bg-background border rounded-md px-2.5 py-1.5">
                                <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                                <span className="font-medium">{a.siteName}</span>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ),
                ].filter(Boolean)
              })
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
                      <div className="relative flex items-center">
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
                        {editFormData.title && (
                          <button
                            type="button"
                            onClick={() => setEditFormData({ ...editFormData, title: "" })}
                            className="absolute right-3 text-muted-foreground hover:text-foreground transition-colors"
                            data-testid="button-clear-edit-title"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="col-span-3 grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="edit-firstname">First Name</Label>
                        <Input
                          id="edit-firstname"
                          value={editFormData.firstName}
                          onChange={(e) => setEditFormData({ ...editFormData, firstName: e.target.value })}
                          onBlur={(e) => {
                            const value = e.target.value.trim();
                            if (value) {
                              const capitalized = value.charAt(0).toUpperCase() + value.slice(1);
                              setEditFormData({ ...editFormData, firstName: capitalized });
                            }
                          }}
                          data-testid="input-edit-firstname"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="edit-lastname">Surname</Label>
                        <Input
                          id="edit-lastname"
                          value={editFormData.lastName}
                          onChange={(e) => setEditFormData({ ...editFormData, lastName: e.target.value })}
                          onBlur={(e) => {
                            const value = e.target.value.trim();
                            if (value) {
                              const capitalized = value.charAt(0).toUpperCase() + value.slice(1);
                              setEditFormData({ ...editFormData, lastName: capitalized });
                            }
                          }}
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
                        onBlur={(e) => {
                          const value = e.target.value.trim();
                          if (value) {
                            setEditFormData({ ...editFormData, jobTitle: toTitleCase(value) });
                          }
                        }}
                        data-testid="input-edit-jobtitle"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit-department">Department</Label>
                      <Input
                        id="edit-department"
                        value={editFormData.department}
                        onChange={(e) => setEditFormData({ ...editFormData, department: e.target.value })}
                        onBlur={(e) => {
                          const value = e.target.value.trim();
                          if (value) {
                            setEditFormData({ ...editFormData, department: toTitleCase(value) });
                          }
                        }}
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
                    <Select value={editFormData.preferredContactMethod} onValueChange={(v: "email" | "phone" | "mobile" | "any") => setEditFormData({ ...editFormData, preferredContactMethod: v })}>
                      <SelectTrigger id="edit-preferred" data-testid="select-edit-preferred">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any</SelectItem>
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
                      <Select value={editFormData.role} onValueChange={(v: "admin" | "consultant" | "client") => setEditFormData({ ...editFormData, role: v })} disabled={editingUser.role === "admin" || (editingUser.id === user?.id && isPro)}>
                        <SelectTrigger id="edit-role" data-testid="select-edit-role" disabled={editingUser.role === "admin" || (editingUser.id === user?.id && isPro)}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {isAdmin && <SelectItem value="admin">Administrator</SelectItem>}
                          <SelectItem value="consultant">Consultant</SelectItem>
                          <SelectItem value="client">Client</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {editFormData.role === "consultant" && (
                      <div className="grid gap-2">
                        <Label htmlFor="edit-tier">Consultant Tier</Label>
                        <Select value={editFormData.consultantTier} onValueChange={(v) => setEditFormData({ ...editFormData, consultantTier: v })} disabled={editingUser.id === user?.id && isPro}>
                          <SelectTrigger id="edit-tier" data-testid="select-edit-tier" disabled={editingUser.id === user?.id && isPro}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pro">Pro</SelectItem>
                            <SelectItem value="standard">Standard</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {editFormData.role === "client" && (
                      <div className="grid gap-2">
                        <Label htmlFor="edit-company">Company</Label>
                        <Select value={editFormData.companyId} onValueChange={(v) => setEditFormData({ ...editFormData, companyId: v })} disabled={userSiteAssignments.length > 0}>
                          <SelectTrigger id="edit-company" data-testid="select-edit-company" disabled={userSiteAssignments.length > 0}>
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
        <DialogContent className="sm:max-w-[620px] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>User Profile</DialogTitle>
            <DialogDescription>
              Full profile information and activity history
            </DialogDescription>
          </DialogHeader>
          {viewingUser && (
            <div className="space-y-6 overflow-y-auto flex-1 pr-1">
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

              {/* Activity Log */}
              {(() => {
                const EXCLUDED = ["login", "logout", "login_failed"];
                const filteredLogs = userActivityLogs.filter((l: any) => !EXCLUDED.includes(l.action));
                function getIconProps(action: string) {
                  switch (action) {
                    case "email_sent": return { icon: <Send className="h-3.5 w-3.5" />, bg: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" };
                    case "document_uploaded": return { icon: <FileText className="h-3.5 w-3.5" />, bg: "bg-muted text-muted-foreground" };
                    case "document_approved": case "document_signed_off": return { icon: <CheckCircle className="h-3.5 w-3.5" />, bg: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" };
                    case "document_rejected": return { icon: <XCircle className="h-3.5 w-3.5" />, bg: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" };
                    case "changes_requested": return { icon: <RotateCcw className="h-3.5 w-3.5" />, bg: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" };
                    case "user_activated": return { icon: <UserCheck className="h-3.5 w-3.5" />, bg: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" };
                    case "comment_added": return { icon: <MessageSquare className="h-3.5 w-3.5" />, bg: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" };
                    case "password_change": case "password_changed": case "password_reset": return { icon: <LockKeyhole className="h-3.5 w-3.5" />, bg: "bg-muted text-muted-foreground" };
                    case "document_viewed": case "document_downloaded": return { icon: <Eye className="h-3.5 w-3.5" />, bg: "bg-muted text-muted-foreground" };
                    default: return { icon: <Activity className="h-3.5 w-3.5" />, bg: "bg-muted text-muted-foreground" };
                  }
                }
                function getTimeLabel(createdAt: Date) {
                  const diffMs = Date.now() - createdAt.getTime();
                  const diffMins = Math.floor(diffMs / 60000);
                  const diffHours = Math.floor(diffMs / 3600000);
                  const diffDays = Math.floor(diffMs / 86400000);
                  if (diffMins < 1) return "Just now";
                  if (diffMins < 60) return `${diffMins}m ago`;
                  if (diffHours < 24) return `${diffHours}h ago`;
                  if (diffDays === 1) return "Yesterday";
                  if (diffDays < 7) return `${diffDays}d ago`;
                  return createdAt.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
                }
                return (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      Activity Log
                    </h4>
                    {isActivityLoading ? (
                      <div className="space-y-2">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="flex gap-3 items-start">
                            <div className="h-7 w-7 rounded-full bg-muted animate-pulse flex-shrink-0" />
                            <div className="flex-1 space-y-1.5 py-0.5">
                              <div className="h-3.5 bg-muted animate-pulse rounded w-3/4" />
                              <div className="h-3 bg-muted animate-pulse rounded w-1/3" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : filteredLogs.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic py-2">No activity recorded yet.</p>
                    ) : (
                      <div className="overflow-y-auto max-h-56 space-y-1 border rounded-md p-2 bg-muted/20">
                        {filteredLogs.slice(0, 50).map((log: any) => {
                          const { icon, bg } = getIconProps(log.action);
                          const isActor = log.userId === viewingUser.id;
                          const createdAt = new Date(log.createdAt);
                          return (
                            <div key={log.id} className="flex gap-2.5 items-start py-1.5 border-b border-border/50 last:border-0">
                              <div className={`flex h-7 w-7 items-center justify-center rounded-full flex-shrink-0 ${bg}`}>
                                {icon}
                              </div>
                              <div className="flex-1 min-w-0 pt-0.5">
                                <p className="text-sm leading-snug">
                                  {log.details || log.action}
                                  {!isActor && log.userName && (
                                    <span className="text-muted-foreground"> — by {log.userName}</span>
                                  )}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5" title={createdAt.toLocaleString()}>
                                  {getTimeLabel(createdAt)}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                        {filteredLogs.length > 50 && (
                          <p className="text-xs text-muted-foreground px-2 py-1">
                            + {filteredLogs.length - 50} more events not shown
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
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

      <Dialog open={isAddUserOpen} onOpenChange={(open) => {
        setIsAddUserOpen(open);
        if (!open) {
          setCompanySearchQuery("");
          setIsCompanyDropdownOpen(false);
        }
      }}>
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
                    <div className="relative flex items-center">
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
                      {newUser.title && (
                        <button
                          type="button"
                          onClick={() => setNewUser({ ...newUser, title: "" })}
                          className="absolute right-3 text-muted-foreground hover:text-foreground transition-colors"
                          data-testid="button-clear-title"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="col-span-3 grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="new-firstname">First Name <span className="text-destructive">*</span></Label>
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
                        onBlur={(e) => {
                          const value = e.target.value.trim();
                          if (value) {
                            const capitalized = value.charAt(0).toUpperCase() + value.slice(1);
                            setNewUser({ 
                              ...newUser, 
                              firstName: capitalized,
                              username: generateUsername(capitalized, newUser.lastName)
                            });
                          }
                        }}
                        placeholder="First name"
                        data-testid="input-new-firstname"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="new-lastname">Surname <span className="text-destructive">*</span></Label>
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
                        onBlur={(e) => {
                          const value = e.target.value.trim();
                          if (value) {
                            const capitalized = value.charAt(0).toUpperCase() + value.slice(1);
                            setNewUser({ 
                              ...newUser, 
                              lastName: capitalized,
                              username: generateUsername(newUser.firstName, capitalized)
                            });
                          }
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
                      readOnly
                      placeholder="firstname.surname"
                      className="bg-muted"
                      data-testid="input-new-username"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="new-email">Email <span className="text-destructive">*</span></Label>
                    <div className="flex flex-col gap-1">
                      <Input
                        id="new-email"
                        type="email"
                        value={newUser.email}
                        className={emailError ? "border-destructive focus-visible:ring-destructive" : ""}
                        onChange={(e) => {
                          setNewUser({ ...newUser, email: e.target.value });
                          if (emailError) setEmailError(null);
                        }}
                        onBlur={async (e) => {
                          const email = e.target.value.trim();
                          if (!email) {
                            setEmailError(null);
                            return;
                          }
                          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                          if (!emailRegex.test(email)) {
                            setEmailError("Please enter a valid email address");
                            return;
                          }
                          try {
                            const response = await fetch(`/api/users/check-email?email=${encodeURIComponent(email)}`);
                            if (!response.ok) {
                              const data = await response.json();
                              setEmailError(data.error || "This email address is already in use.");
                            } else {
                              setEmailError(null);
                            }
                          } catch (error) {
                            console.error("Email check failed:", error);
                          }
                        }}
                        placeholder="email@company.com"
                        data-testid="input-new-email"
                      />
                      {emailError && (
                        <p className="text-xs font-medium text-destructive">
                          {emailError}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="new-jobtitle">Job Title</Label>
                    <Input
                      id="new-jobtitle"
                      value={newUser.jobTitle}
                      onChange={(e) => setNewUser({ ...newUser, jobTitle: e.target.value })}
                      onBlur={(e) => {
                        const value = e.target.value.trim();
                        if (value) {
                          setNewUser({ ...newUser, jobTitle: toTitleCase(value) });
                        }
                      }}
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
                      onBlur={(e) => {
                        const value = e.target.value.trim();
                        if (value) {
                          setNewUser({ ...newUser, department: toTitleCase(value) });
                        }
                      }}
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
                    <div className="flex flex-col gap-1">
                      <Input
                        id="new-phone"
                        value={newUser.phone}
                        className={phoneError ? "border-destructive focus-visible:ring-destructive" : ""}
                        onChange={(e) => {
                          setNewUser({ ...newUser, phone: e.target.value });
                          if (phoneError) setPhoneError(null);
                        }}
                        onBlur={(e) => {
                          const phone = e.target.value.trim();
                          if (!phone) { setPhoneError(null); return; }
                          const phoneRegex = /^[\d\s\-\+\(\)]{10,}$/;
                          if (!phoneRegex.test(phone)) {
                            setPhoneError("Please enter a valid phone number (at least 10 digits)");
                          } else {
                            setPhoneError(null);
                          }
                        }}
                        placeholder="+44 123 456 7890"
                        data-testid="input-new-phone"
                      />
                      {phoneError && (
                        <p className="text-xs font-medium text-destructive">{phoneError}</p>
                      )}
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="new-mobile">Mobile</Label>
                    <div className="flex flex-col gap-1">
                      <Input
                        id="new-mobile"
                        value={newUser.mobile}
                        className={mobileError ? "border-destructive focus-visible:ring-destructive" : ""}
                        onChange={(e) => {
                          setNewUser({ ...newUser, mobile: e.target.value });
                          if (mobileError) setMobileError(null);
                        }}
                        onBlur={(e) => {
                          const mobile = e.target.value.trim();
                          if (!mobile) { setMobileError(null); return; }
                          const phoneRegex = /^[\d\s\-\+\(\)]{10,}$/;
                          if (!phoneRegex.test(mobile)) {
                            setMobileError("Please enter a valid mobile number (at least 10 digits)");
                          } else {
                            setMobileError(null);
                          }
                        }}
                        placeholder="+44 7xx xxx xxxx"
                        data-testid="input-new-mobile"
                      />
                      {mobileError && (
                        <p className="text-xs font-medium text-destructive">{mobileError}</p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="new-preferred-contact">Preferred Contact Method</Label>
                  <Select
                    value={newUser.preferredContactMethod}
                    onValueChange={(value: "email" | "phone" | "mobile" | "any") => setNewUser({ ...newUser, preferredContactMethod: value })}
                  >
                    <SelectTrigger id="new-preferred-contact" data-testid="select-new-preferred-contact">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
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
                    <Label htmlFor="new-role">Role <span className="text-destructive">*</span></Label>
                    <Select
                      value={newUser.role}
                      onValueChange={(value: "admin" | "consultant" | "client") => setNewUser({ ...newUser, role: value })}
                    >
                      <SelectTrigger id="new-role" data-testid="select-new-role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {isAdmin && <SelectItem value="admin">Administrator</SelectItem>}
                        <SelectItem value="consultant">Consultant</SelectItem>
                        <SelectItem value="client">Client</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {newUser.role === "consultant" && (
                    <div className="grid gap-2">
                      <Label htmlFor="new-tier">Consultant Tier *</Label>
                      <Select
                        value={newUser.consultantTier}
                        onValueChange={(value) => setNewUser({ ...newUser, consultantTier: value })}
                      >
                        <SelectTrigger id="new-tier" data-testid="select-new-tier">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pro">Pro</SelectItem>
                          <SelectItem value="standard">Standard</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {newUser.role === "client" && (
                    <div className="grid gap-2">
                      <Label htmlFor="new-company">Company <span className="text-destructive">*</span></Label>
                      <Popover open={isCompanyDropdownOpen} onOpenChange={setIsCompanyDropdownOpen}>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm text-left hover:bg-accent focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                            data-testid="button-company-dropdown"
                          >
                            {newUser.companyId ? companies.find(c => c.id === newUser.companyId)?.name : "Select company..."}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                          <div className="p-2 border-b">
                            <input
                              type="text"
                              placeholder="Search company..."
                              className="w-full px-2 py-1 border border-input rounded text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring"
                              onChange={(e) => setCompanySearchQuery(e.target.value)}
                              value={companySearchQuery}
                              autoFocus
                              data-testid="input-company-search"
                            />
                          </div>
                          <div className="max-h-48 overflow-y-auto">
                            {filteredCompanies.length === 0 ? (
                              <div className="px-3 py-2 text-sm text-muted-foreground">No companies found</div>
                            ) : (
                              filteredCompanies.map((company) => (
                                <button
                                  key={company.id}
                                  type="button"
                                  onClick={() => {
                                    setNewUser({ ...newUser, companyId: company.id });
                                    setCompanySearchQuery("");
                                    setIsCompanyDropdownOpen(false);
                                  }}
                                  className="w-full text-left px-3 py-2 hover:bg-muted transition-colors flex justify-between items-center text-sm"
                                  data-testid={`button-select-company-${company.id}`}
                                >
                                  <span>{company.name}</span>
                                  {newUser.companyId === company.id && (
                                    <span className="text-primary">✓</span>
                                  )}
                                </button>
                              ))
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
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


      {/* Send Invite Confirmation Dialog */}
      <Dialog open={!!inviteConfirmUser} onOpenChange={(open) => { if (!open) setInviteConfirmUser(null); }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Send Invitation
            </DialogTitle>
            <DialogDescription>
              This will send an invitation email to the user so they can set up their account and log in.
            </DialogDescription>
          </DialogHeader>
          {inviteConfirmUser && (
            <div className="py-2 space-y-3">
              <div className="rounded-lg bg-muted/60 p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name</span>
                  <span className="font-medium">{inviteConfirmUser.fullName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span className="font-medium">{inviteConfirmUser.email}</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Are you sure you want to send an invitation to this user?
              </p>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setInviteConfirmUser(null)} data-testid="button-cancel-invite">
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (inviteConfirmUser) {
                  resendInviteMutation.mutate(inviteConfirmUser.id, {
                    onSuccess: () => setInviteConfirmUser(null),
                    onError: () => setInviteConfirmUser(null),
                  });
                }
              }}
              disabled={resendInviteMutation.isPending}
              data-testid="button-confirm-send-invite"
            >
              {resendInviteMutation.isPending ? (
                <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Sending...</>
              ) : (
                <><Mail className="h-4 w-4 mr-2" />Send Invitation</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Client Site Assignment Dialog */}
      <Dialog open={showSiteAssignmentMessage} onOpenChange={(open) => {
        setShowSiteAssignmentMessage(open);
        if (!open) { setUserNeedingSiteAssignment(null); setSetPrimaryContact(false); setSelectedSiteToAdd(""); }
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Assign Sites to {userNeedingSiteAssignment?.fullName}
            </DialogTitle>
            <DialogDescription>
              Please assign at least one site, or set this user as the primary contact for their company.
            </DialogDescription>
          </DialogHeader>
          {userNeedingSiteAssignment && (() => {
            const userCompany = companies.find(c => c.id === userNeedingSiteAssignment.companyId);
            const companySites = sites ? sites.filter(s => s.companyId === userNeedingSiteAssignment.companyId) : [];
            const unassignedSites = companySites.filter(s => !userNeedingSiteAssignment.siteAssignments?.some(a => a.siteId === s.id));
            return (
              <div className="space-y-4">
                {/* Primary Contact toggle */}
                <div className={`rounded-lg border p-4 space-y-3 transition-colors ${setPrimaryContact ? "border-primary/50 bg-primary/5" : ""}`}>
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="primary-contact-check"
                      checked={setPrimaryContact}
                      onChange={e => { setSetPrimaryContact(e.target.checked); if (e.target.checked) setSelectedSiteToAdd(""); }}
                      className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
                      data-testid="checkbox-primary-contact"
                    />
                    <Label htmlFor="primary-contact-check" className="cursor-pointer font-medium">
                      Set as primary contact
                    </Label>
                  </div>
                  {setPrimaryContact && userCompany && (
                    <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/60 rounded-md p-3">
                      <Shield className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                      <span>
                        This will make <strong>{userNeedingSiteAssignment.fullName}</strong> a primary contact for{" "}
                        <strong>{userCompany.name}</strong> and automatically grant access to all current and future sites within this company.
                      </span>
                    </div>
                  )}
                </div>

                {/* Site selection — only shown when not primary contact */}
                {!setPrimaryContact && (
                  <div className="space-y-3">
                    {/* Currently assigned */}
                    {userNeedingSiteAssignment.siteAssignments && userNeedingSiteAssignment.siteAssignments.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Currently assigned sites</Label>
                        <div className="flex flex-wrap gap-2">
                          {userNeedingSiteAssignment.siteAssignments.map((assignment) => (
                            <Badge key={assignment.siteId} variant="secondary" className="flex items-center gap-1">
                              <MapPin className="h-3 w-3 shrink-0" />
                              <span>{assignment.siteName}</span>
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Add from company's sites */}
                    {unassignedSites.length > 0 ? (
                      <div className="flex items-end gap-2">
                        <div className="flex-1 grid gap-1.5">
                          <Label htmlFor="assign-site" className="text-xs text-muted-foreground">
                            Add site {userCompany ? `(${userCompany.name})` : ""}
                          </Label>
                          <Select value={selectedSiteToAdd} onValueChange={setSelectedSiteToAdd}>
                            <SelectTrigger id="assign-site" data-testid="select-assign-site">
                              <SelectValue placeholder="Select a site to add" />
                            </SelectTrigger>
                            <SelectContent>
                              {unassignedSites.map((site) => (
                                <SelectItem key={site.id} value={site.id}>
                                  {site.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (selectedSiteToAdd && userNeedingSiteAssignment) {
                              setSiteAssignmentConfirm({
                                type: "add",
                                siteId: selectedSiteToAdd,
                                siteName: sites?.find(s => s.id === selectedSiteToAdd)?.name || "",
                              });
                            }
                          }}
                          disabled={!selectedSiteToAdd}
                          data-testid="button-assign-site"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add
                        </Button>
                      </div>
                    ) : companySites.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No sites exist for this company yet. Add a site first or set this user as primary contact.</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">All company sites have been assigned.</p>
                    )}

                    {(!userNeedingSiteAssignment.siteAssignments || userNeedingSiteAssignment.siteAssignments.length === 0) && companySites.length > 0 && !selectedSiteToAdd && (
                      <p className="text-sm text-muted-foreground">No sites assigned yet. Select a site above.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowSiteAssignmentMessage(false); setSetPrimaryContact(false); setSelectedSiteToAdd(""); }} data-testid="button-cancel-site-assignment">
              Cancel
            </Button>
            {setPrimaryContact && userNeedingSiteAssignment?.companyId && (
              <Button
                onClick={handleSetPrimaryContactClick}
                disabled={setPrimaryContactMutation.isPending}
                data-testid="button-confirm-primary-contact"
              >
                {setPrimaryContactMutation.isPending ? "Saving..." : "Set as Primary Contact"}
              </Button>
            )}
            {!setPrimaryContact && (
              <Button onClick={() => { setShowSiteAssignmentMessage(false); setUserNeedingSiteAssignment(null); setSelectedSiteToAdd(""); }} data-testid="button-done-site-assignment">
                Done
              </Button>
            )}
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
                  Are you sure you want to assign <strong>{(manageSitesUser || editingUser)?.fullName}</strong> to <strong>{siteAssignmentConfirm?.siteName}</strong>?
                </>
              ) : (
                <>
                  Are you sure you want to remove <strong>{(manageSitesUser || editingUser)?.fullName}</strong> from <strong>{siteAssignmentConfirm?.siteName}</strong>?
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

      {/* Manage Sites Dialog */}
      <Dialog open={!!manageSitesUser} onOpenChange={(open) => { if (!open) handleManageSitesCloseRequest(); }}>
        <DialogContent
          className="sm:max-w-[560px]"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Manage Sites — {manageSitesUser?.fullName}
            </DialogTitle>
            <DialogDescription>
              Changes are staged locally. Click Save to apply them.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* Assigned Sites */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Assigned Sites</Label>
              {getEffectiveAssigned().length > 0 ? (
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-1">
                  {getEffectiveAssigned().map((a) => {
                    const isPendingAdd = pendingAddSiteIds.includes(a.siteId);
                    return (
                      <Badge
                        key={a.siteId}
                        variant={isPendingAdd ? "default" : "secondary"}
                        className="flex items-center gap-1 pr-1"
                        data-testid={`badge-assigned-site-${a.siteId}`}
                      >
                        <span>{a.siteName}</span>
                        <span className="text-xs opacity-70">({a.companyName})</span>
                        {isPendingAdd && <span className="text-xs opacity-70 ml-0.5">+new</span>}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4 ml-1 hover:bg-destructive/20"
                          onClick={() => manageSitesRemoveSite(a.siteId)}
                          data-testid={`button-manage-remove-site-${a.siteId}`}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No sites assigned.</p>
              )}
            </div>

            {/* Available Sites grouped by company */}
            <div className="border-t pt-4">
              <Label className="text-sm font-medium mb-2 block">Available Sites</Label>
              {getAvailableSitesByCompanyForManage().length > 0 ? (
                <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                  {getAvailableSitesByCompanyForManage().map(({ company, sites: companySites }) => (
                    <div key={company.id}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{company.name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs px-2"
                          onClick={() => manageSitesAddAllFromCompany(company.id)}
                          data-testid={`button-manage-add-all-company-${company.id}`}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add All
                        </Button>
                      </div>
                      <div className="space-y-1">
                        {companySites.map((site) => (
                          <div key={site.id} className="flex items-center justify-between rounded-md px-2 py-1 hover:bg-muted/50">
                            <span className="text-sm">{site.name}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs px-2"
                              onClick={() => manageSitesAddSite(site.id)}
                              data-testid={`button-manage-add-site-${site.id}`}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Add
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">All available sites have been assigned.</p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={handleManageSitesCloseRequest}
              data-testid="button-manage-sites-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={() => setShowManageSitesSaveConfirm(true)}
              disabled={pendingAddSiteIds.length === 0 && pendingRemoveSiteIds.length === 0}
              data-testid="button-manage-sites-save"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Sites — Save Confirmation */}
      <AlertDialog open={showManageSitesSaveConfirm} onOpenChange={setShowManageSitesSaveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save Site Assignments</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>The following changes will be applied to <strong>{manageSitesUser?.fullName}</strong>:</p>
                {pendingAddSiteIds.length > 0 && (
                  <div>
                    <p className="font-medium text-foreground mb-1">Sites being added ({pendingAddSiteIds.length}):</p>
                    <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                      {pendingAddSiteIds.map(id => {
                        const site = sites.find(s => s.id === id);
                        const company = companies.find(c => c.id === site?.companyId);
                        return <li key={id}>{site?.name}{company ? ` (${company.name})` : ""}</li>;
                      })}
                    </ul>
                  </div>
                )}
                {pendingRemoveSiteIds.length > 0 && (
                  <div>
                    <p className="font-medium text-foreground mb-1">Sites being removed ({pendingRemoveSiteIds.length}):</p>
                    <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                      {pendingRemoveSiteIds.map(id => {
                        const assignment = userSiteAssignments.find(a => a.siteId === id);
                        return <li key={id}>{assignment?.siteName}{assignment?.companyName ? ` (${assignment.companyName})` : ""}</li>;
                      })}
                    </ul>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSavingManageSites}>Go Back</AlertDialogCancel>
            <AlertDialogAction
              onClick={saveManageSitesChanges}
              disabled={isSavingManageSites}
              data-testid="button-confirm-save-manage-sites"
            >
              {isSavingManageSites ? "Saving..." : "Confirm Save"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Manage Sites — Cancel Confirmation */}
      <AlertDialog open={showManageSitesCancelConfirm} onOpenChange={setShowManageSitesCancelConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard Changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved site changes. If you close now, your changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowManageSitesCancelConfirm(false)}>Keep Editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={closeManageSites}
              data-testid="button-confirm-discard-manage-sites"
            >
              Discard Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      {/* Delete User Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete <strong>{deleteConfirm?.fullName}</strong> ({deleteConfirm?.username})?
              <span className="block mt-2 text-foreground">
                This action cannot be undone. The user will be removed from all site assignments and will no longer be able to access the portal. All audit logs will be preserved.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-user">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteConfirm && deleteUserMutation.mutate(deleteConfirm.id)}
              disabled={deleteUserMutation.isPending}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete-user"
            >
              {deleteUserMutation.isPending ? "Deleting..." : "Yes, Delete User"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Primary Contact Conflict Dialog (User Management) */}
      <AlertDialog open={!!primaryContactConflictInUM} onOpenChange={v => { if (!v) setPrimaryContactConflictInUM(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Existing Primary Contact</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p><strong className="text-foreground">{primaryContactConflictInUM?.oldUserName}</strong> is currently the primary contact for this company and has access to all company sites.</p>
                <p>What should happen to their site access?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={() => setPrimaryContactConflictInUM(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="outline"
              onClick={() => handleConflictResolveInUM(false)}
              data-testid="button-conflict-keep-access"
            >
              Keep Site Access
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => handleConflictResolveInUM(true)}
              data-testid="button-conflict-remove-access"
            >
              Remove All Site Access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </div>
  );
}
