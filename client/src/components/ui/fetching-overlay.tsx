import logoIcon from "@assets/IFRA_and_Guardian_Group_A4_1767695098725.jpg";

interface FetchingOverlayProps {
  compact?: boolean;
}

export function FetchingOverlay({ compact = false }: FetchingOverlayProps) {
  if (compact) {
    return (
      <div className="flex items-center justify-center py-2">
        <img
          src={logoIcon}
          alt="Loading"
          className="h-5 w-5 rounded-full object-cover shadow animate-spin"
          style={{ animationDuration: "1.5s" }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
      <img
        src={logoIcon}
        alt="Guardian Group"
        className="h-12 w-12 rounded-full object-cover shadow animate-spin"
        style={{ animationDuration: "1.5s" }}
      />
      <p className="text-sm font-medium">Fetching data…</p>
    </div>
  );
}
