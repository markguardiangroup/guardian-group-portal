import { ReactNode } from "react";
import {
  Shield,
  Users,
  Scale,
  GraduationCap,
  FileCheck,
  BarChart3,
  CheckCircle2,
  LayoutDashboard,
  CalendarDays,
  BellRing,
  ExternalLink,
} from "lucide-react";
import logoIcon from "@assets/IFRA_and_Guardian_Group_A4_1767695098725.jpg";

const FEATURES = [
  {
    icon: Shield,
    label: "Health & Safety",
    description: "Risk assessments, incident reporting & compliance tracking",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
  },
  {
    icon: Users,
    label: "Human Resources",
    description: "Contracts, policies, disciplinary & grievance management",
    color: "text-sky-400",
    bg: "bg-sky-500/10 border-sky-500/20",
  },
  {
    icon: Scale,
    label: "Employment Law",
    description: "Legal guidance, case management & template library",
    color: "text-rose-400",
    bg: "bg-rose-500/10 border-rose-500/20",
  },
  {
    icon: GraduationCap,
    label: "Training",
    description: "Course booking, certification tracking & skills matrix",
    color: "text-violet-400",
    bg: "bg-violet-500/10 border-violet-500/20",
  },
  {
    icon: FileCheck,
    label: "Document Toolkit",
    description: "Policy builder, approval workflows & version control",
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
  },
  {
    icon: BarChart3,
    label: "Reports & Insights",
    description: "Live compliance scores, gap analysis & expiry alerts",
    color: "text-teal-400",
    bg: "bg-teal-500/10 border-teal-500/20",
  },
];

const KEY_FEATURES = [
  {
    icon: LayoutDashboard,
    label: "Live Dashboard",
    color: "text-sky-400",
    bg: "bg-sky-500/10",
  },
  {
    icon: CalendarDays,
    label: "Smart Calendar",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  {
    icon: BellRing,
    label: "Live Alerts",
    color: "text-violet-400",
    bg: "bg-violet-500/10",
  },
];

interface AuthShellProps {
  children: ReactNode;
}

export function AuthShell({ children }: AuthShellProps) {
  return (
    <div className="min-h-screen flex">
      {/* ── Left panel – branded hero ── */}
      <div
        className="hidden lg:flex lg:w-[58%] flex-col relative overflow-hidden"
        style={{
          background:
            "linear-gradient(160deg, #1a2f55 0%, #172240 55%, #111827 100%)",
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className="absolute top-[-15%] left-[-10%] w-[600px] h-[600px] rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(56,189,248,0.08) 0%, transparent 65%)",
            }}
          />
          <div
            className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(74,222,128,0.07) 0%, transparent 65%)",
            }}
          />
          <div
            className="absolute top-[40%] right-[5%] w-[300px] h-[300px] rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(167,139,250,0.06) 0%, transparent 65%)",
            }}
          />
        </div>

        <div className="relative z-10 flex flex-col h-full px-12 py-10">
          <a
            href="https://www.guardiangroup.co.uk"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-3 w-fit transition-opacity duration-200 hover:opacity-80"
          >
            <img
              src={logoIcon}
              alt="Guardian Group"
              className="h-10 w-10 rounded-full object-cover ring-2 ring-white/10 transition-transform duration-200 group-hover:scale-105"
            />
            <div className="leading-tight">
              <span className="block text-white font-bold text-lg tracking-tight group-hover:underline underline-offset-2">
                Guardian
              </span>
              <span className="block text-white/50 text-xs font-semibold tracking-[0.2em] uppercase">
                Group
              </span>
            </div>
            <ExternalLink className="h-3.5 w-3.5 text-white/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 self-start mt-1" />
          </a>

          <div className="mt-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 mb-6">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-white/70 text-xs font-semibold tracking-[0.15em] uppercase">
                Compliance That Counts
              </span>
            </div>

            <h1 className="text-4xl xl:text-5xl font-bold leading-[1.1] text-white mb-3">
              Your people,{" "}
              <span
                style={{
                  background:
                    "linear-gradient(90deg, #38bdf8 0%, #818cf8 50%, #e879f9 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                protected.
              </span>
            </h1>
            <h1 className="text-4xl xl:text-5xl font-bold leading-[1.1] text-white mb-5">
              Your business,{" "}
              <span
                style={{
                  background:
                    "linear-gradient(90deg, #4ade80 0%, #38bdf8 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                compliant.
              </span>
            </h1>
            <p className="text-white/55 text-sm leading-relaxed max-w-md mb-8">
              Guardian Group turns HR, employment law, and health &amp; safety
              from a burden into a competitive advantage — all in one
              intelligent compliance portal.
            </p>

            <div className="flex items-stretch gap-3 mb-10">
              {KEY_FEATURES.map((f) => (
                <div
                  key={f.label}
                  className={`flex-1 flex flex-col items-center text-center gap-2.5 rounded-2xl border border-white/8 py-4 px-3 ${f.bg}`}
                >
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${f.bg} border border-white/10`}
                  >
                    <f.icon className={`h-5 w-5 ${f.color}`} />
                  </div>
                  <p className={`text-sm font-semibold ${f.color}`}>
                    {f.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div
            className="grid grid-cols-2 gap-3 mt-auto"
            style={{ gridAutoRows: "1fr" }}
          >
            {FEATURES.map((f) => (
              <div
                key={f.label}
                className={`flex items-center gap-3.5 rounded-xl border px-4 py-4 backdrop-blur-sm ${f.bg}`}
              >
                <div className={`shrink-0 ${f.color}`}>
                  <f.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-white text-sm font-semibold leading-tight">
                    {f.label}
                  </p>
                  <p className="text-white/45 text-xs leading-snug mt-0.5 line-clamp-1">
                    {f.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-5 border-t border-white/8 flex items-center gap-3">
            <div className="flex -space-x-1.5">
              {["bg-sky-400", "bg-emerald-400", "bg-violet-400", "bg-amber-400"].map(
                (c, i) => (
                  <div
                    key={i}
                    className={`h-6 w-6 rounded-full border-2 border-[#172240] ${c} opacity-80`}
                  />
                ),
              )}
            </div>
            <p className="text-white/40 text-xs">
              Trusted by{" "}
              <span className="text-white/65 font-semibold">
                10,000+ organisations
              </span>{" "}
              across the UK
            </p>
            <div className="ml-auto flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <CheckCircle2
                  key={i}
                  className="h-3 w-3 text-emerald-400/60"
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Right panel – form ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 relative overflow-hidden bg-slate-50">
        <div
          className="absolute top-0 right-0 w-[350px] h-[350px] rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, rgba(14,165,233,0.05) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute bottom-0 left-0 w-[250px] h-[250px] rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, rgba(129,140,248,0.04) 0%, transparent 70%)",
          }}
        />

        <a
          href="https://www.guardiangroup.co.uk"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex lg:hidden items-center gap-3 mb-8 relative z-10 w-fit transition-opacity duration-200 hover:opacity-80"
        >
          <img
            src={logoIcon}
            alt="Guardian Group"
            className="h-10 w-10 rounded-full object-cover transition-transform duration-200 group-hover:scale-105"
          />
          <div className="leading-tight">
            <span className="block text-slate-800 font-bold text-lg tracking-tight group-hover:underline underline-offset-2">
              Guardian
            </span>
            <span className="block text-slate-400 text-xs font-semibold tracking-[0.2em] uppercase">
              Group
            </span>
          </div>
          <ExternalLink className="h-3.5 w-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200 self-start mt-1" />
        </a>

        <div className="relative z-10 w-full max-w-md">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/80 p-8">
            <div className="flex items-center gap-2.5 mb-6">
              <img
                src={logoIcon}
                alt="Guardian Group"
                className="h-8 w-8 rounded-full object-cover ring-1 ring-slate-200"
              />
              <div className="leading-tight">
                <span className="block text-slate-800 font-semibold text-sm tracking-tight">
                  Guardian Group
                </span>
                <span className="block text-slate-400 text-[10px] font-medium tracking-[0.15em] uppercase">
                  Compliance Portal
                </span>
              </div>
            </div>
            <div className="h-px bg-slate-100 mb-6" />
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
