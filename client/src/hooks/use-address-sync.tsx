import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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

type AddressFields = {
  addressLine1: string;
  addressLine2: string;
  city: string;
  county: string;
  postalCode: string;
  country: string;
};

const ADDR_FIELDS = ["addressLine1", "addressLine2", "city", "county", "postalCode", "country"] as const;

export function useAddressSync() {
  const { toast } = useToast();

  const snapshotRef = useRef<AddressFields>({
    addressLine1: "", addressLine2: "", city: "", county: "", postalCode: "", country: "",
  });

  const [syncSites, setSyncSites] = useState<Array<{ id: string; name: string }> | null>(null);
  const [syncNewData, setSyncNewData] = useState<AddressFields | null>(null);

  const syncSitesMutation = useMutation({
    mutationFn: async ({ sites, address }: { sites: Array<{ id: string }>; address: AddressFields }) => {
      await Promise.all(sites.map((site) => apiRequest("PATCH", `/api/sites/${site.id}`, address)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
      toast({ title: `${syncSites?.length === 1 ? "Site" : "Sites"} address updated` });
      setSyncSites(null);
      setSyncNewData(null);
    },
    onError: () => {
      toast({ title: "Failed to update site address", variant: "destructive" });
    },
  });

  function captureSnapshot(company: Partial<AddressFields>) {
    snapshotRef.current = {
      addressLine1: company.addressLine1 || "",
      addressLine2: company.addressLine2 || "",
      city: company.city || "",
      county: company.county || "",
      postalCode: company.postalCode || "",
      country: company.country || "",
    };
  }

  async function onCompanyUpdated(companyId: string, newAddr: AddressFields) {
    const oldAddr = snapshotRef.current;
    const addrChanged = ADDR_FIELDS.some(
      (f) => (newAddr[f] || "").trim().toLowerCase() !== (oldAddr[f] || "").trim().toLowerCase()
    );
    if (!addrChanged) return;

    try {
      const res = await fetch(`/api/companies/${companyId}`, { credentials: "include" });
      if (!res.ok) return;
      const company = await res.json();
      const sites: Array<{ id: string; name: string } & Partial<AddressFields>> = company.sites || [];
      const matchingSites = sites.length === 1
        ? sites
        : sites.filter((site) =>
            ADDR_FIELDS.every(
              (f) => (site[f] || "").trim().toLowerCase() === (oldAddr[f] || "").trim().toLowerCase()
            )
          );
      if (matchingSites.length > 0) {
        setSyncSites(matchingSites.map((s) => ({ id: s.id, name: s.name })));
        setSyncNewData(newAddr);
      }
    } catch {
      // silently ignore
    }
  }

  function dismiss() {
    setSyncSites(null);
    setSyncNewData(null);
  }

  const AddressSyncDialog = (
    <AlertDialog
      open={!!syncSites}
      onOpenChange={(open) => { if (!open) dismiss(); }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Update {syncSites?.length === 1 ? "site" : "sites"} address?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>
              <p>The following {syncSites?.length === 1 ? "site has" : "sites have"} the same address as this company had before the update:</p>
              <ul className="mt-2 list-disc list-inside font-medium text-foreground">
                {syncSites?.map((s) => <li key={s.id}>{s.name}</li>)}
              </ul>
              <p className="mt-2">Would you like to copy the new address to {syncSites?.length === 1 ? "it" : "them"} too?</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={dismiss}
            data-testid="button-skip-sites-sync"
          >
            No, keep as is
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => syncSites && syncNewData && syncSitesMutation.mutate({ sites: syncSites, address: syncNewData })}
            disabled={syncSitesMutation.isPending}
            data-testid="button-confirm-sites-sync"
          >
            {syncSitesMutation.isPending ? "Updating..." : `Yes, update ${syncSites?.length === 1 ? "site" : "sites"}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { captureSnapshot, onCompanyUpdated, AddressSyncDialog };
}
