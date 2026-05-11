import { Loader2 } from "lucide-react";
import logoIcon from "@assets/IFRA_and_Guardian_Group_A4_1767695098725.jpg";

export function FetchingOverlay() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
      <img
        src={logoIcon}
        alt="Guardian Group"
        className="h-12 w-12 rounded-full object-cover shadow"
      />
      <Loader2 className="h-5 w-5 animate-spin" />
      <p className="text-sm font-medium">Fetching data…</p>
    </div>
  );
}
