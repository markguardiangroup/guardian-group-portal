import { useRef, useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import {
  Eye, EyeOff, Loader2, ArrowRight, LockKeyhole, AlertTriangle,
  Shield, Users, Scale, GraduationCap, FileCheck, BarChart3, CheckCircle2,
  LayoutDashboard, CalendarDays, BellRing, ExternalLink,
} from "lucide-react";
import logoIcon from "@assets/IFRA_and_Guardian_Group_A4_1767695098725.jpg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

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
    sub: "Real-time compliance overview",
    glow: "rgba(56,189,248,0.15)",
    color: "text-sky-400",
    bg: "bg-sky-500/10",
  },
  {
    icon: CalendarDays,
    label: "Smart Calendar",
    sub: "Renewals & deadlines tracked",
    glow: "rgba(74,222,128,0.15)",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  {
    icon: BellRing,
    label: "Live Alerts",
    sub: "Instant compliance notifications",
    glow: "rgba(167,139,250,0.15)",
    color: "text-violet-400",
    bg: "bg-violet-500/10",
  },
];

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  // Capture the URL the user was trying to reach BEFORE login replaced the
  // page (e.g. a deep link from an approval email). We restore it after a
  // successful login so users land on the document/page they clicked.
  const intendedPathRef = useRef<string>(
    typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}${window.location.hash}`
      : "/"
  );
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [isAccountLocked, setIsAccountLocked] = useState(false);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string>("");
  const turnstileRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetId = useRef<string | null>(null);
  const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

  useEffect(() => {
    if (!SITE_KEY || !turnstileRef.current) return;
    const initWidget = () => {
      const ts = (window as any).turnstile;
      if (ts && turnstileRef.current && !turnstileWidgetId.current) {
        turnstileWidgetId.current = ts.render(turnstileRef.current, {
          sitekey: SITE_KEY,
          callback: (token: string) => setTurnstileToken(token),
          "expired-callback": () => setTurnstileToken(""),
          "error-callback": () => setTurnstileToken(""),
          theme: "light",
        });
      }
    };
    if ((window as any).turnstile) {
      initWidget();
    } else {
      const existing = document.querySelector('script[src*="turnstile"]') as HTMLScriptElement | null;
      const script = existing ?? document.createElement("script");
      if (!existing) {
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", initWidget);
      return () => script.removeEventListener("load", initWidget);
    }
    return () => {
      if (turnstileWidgetId.current && (window as any).turnstile) {
        (window as any).turnstile.remove(turnstileWidgetId.current);
        turnstileWidgetId.current = null;
      }
    };
  }, [SITE_KEY]);

  const forgotPasswordMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await apiRequest("POST", "/api/auth/forgot-password", { email });
      return response.json();
    },
    onSuccess: (data) => {
      setResetSuccess(true);
      if (data.resetUrl) setResetUrl(data.resetUrl);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to process request", variant: "destructive" });
    },
  });

  const handleForgotPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      toast({ title: "Email Required", description: "Please enter your email address", variant: "destructive" });
      return;
    }
    forgotPasswordMutation.mutate(forgotEmail);
  };

  const closeForgotPasswordDialog = () => {
    setShowForgotPassword(false);
    setForgotEmail("");
    setResetSuccess(false);
    setResetUrl(null);
  };

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  const resetTurnstile = () => {
    const ts = (window as any).turnstile;
    if (ts && turnstileWidgetId.current) {
      ts.reset(turnstileWidgetId.current);
    }
    setTurnstileToken("");
  };

  const loginMutation = useMutation({
    mutationFn: async (data: LoginForm) => {
      const res = await apiRequest("POST", "/api/auth/login", {
        ...data,
        ...(SITE_KEY && turnstileToken ? { turnstileToken } : {}),
      });
      return res.json();
    },
    onSuccess: (userData) => {
      setIsAccountLocked(false);
      setAttemptsRemaining(null);

      // Seed the auth cache immediately so AuthProvider sees the user without
      // needing to re-fetch, which eliminates the race window that caused the
      // "10-second hang then back to login" issue.
      queryClient.setQueryData(["/api/auth/me"], userData);

      // Also trigger a background refetch of /api/auth/me so any computed fields
      // not returned by the login endpoint (e.g. companyName, legalAcceptanceRequired)
      // are populated without requiring a manual page refresh.
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });

      // Navigate straight away — the DataPrefetcher in AuthenticatedApp handles
      // background loading of all other data once the user lands on the dashboard.
      setIsSubmitting(false);
      // Restore the originally-requested URL (from an email deep link, etc.)
      // unless the user actually started on /login or root.
      const intended = intendedPathRef.current || "/";
      const target =
        intended === "/" || intended.startsWith("/login") ? "/" : intended;
      setLocation(target);
    },
    onError: async (error: Error) => {
      console.log("[login onError] fired, error:", error.message);
      setIsSubmitting(false);
      setIsAccountLocked(false);
      setAttemptsRemaining(null);
      setLoginError(null);
      resetTurnstile();
      const msg = error.message || "";
      const statusCode = parseInt(msg.split(":")[0], 10);
      try {
        const jsonStr = msg.substring(msg.indexOf(":") + 1).trim();
        const body = JSON.parse(jsonStr);
        if (statusCode === 423 || body.code === "account_locked") {
          setIsAccountLocked(true);
          return;
        }
        if (typeof body.attemptsRemaining === "number") {
          setAttemptsRemaining(body.attemptsRemaining);
          setLoginError("Incorrect username or password.");
          console.log("[login onError] set loginError (attemptsRemaining path)");
          return;
        }
        // Surface any explicit error message from the server (e.g. account inactive)
        if (body.error) {
          setLoginError(body.error);
          console.log("[login onError] set loginError (body.error path):", body.error);
          return;
        }
      } catch {
        console.log("[login onError] JSON parse failed");
      }
      setLoginError("Incorrect username or password. Please try again.");
      console.log("[login onError] set loginError (fallback path)");
    },
  });

  const isLoading = isSubmitting || loginMutation.isPending;

  return (
    <div className="min-h-screen flex">
      {isLoading && (
        <div className="login-progress-bar">
          <div className="login-progress-bar-inner" />
        </div>
      )}

      {/* ── Left panel – landing hero ── */}
      <div
        className="hidden lg:flex lg:w-[58%] flex-col relative overflow-hidden"
        style={{ background: "linear-gradient(160deg, #1a2f55 0%, #172240 55%, #111827 100%)" }}
      >
        {/* Background texture — subtle dot grid */}
        <div className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        {/* Ambient glows */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-15%] left-[-10%] w-[600px] h-[600px] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(56,189,248,0.08) 0%, transparent 65%)" }} />
          <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(74,222,128,0.07) 0%, transparent 65%)" }} />
          <div className="absolute top-[40%] right-[5%] w-[300px] h-[300px] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(167,139,250,0.06) 0%, transparent 65%)" }} />
        </div>

        <div className="relative z-10 flex flex-col h-full px-12 py-10">

          {/* ── Logo ── */}
          <a href="https://www.guardiangroup.co.uk" target="_blank" rel="noopener noreferrer" className="group flex items-center gap-3 w-fit transition-opacity duration-200 hover:opacity-80">
            <img src={logoIcon} alt="Guardian Group" className="h-10 w-10 rounded-full object-cover ring-2 ring-white/10 transition-transform duration-200 group-hover:scale-105" />
            <div className="leading-tight">
              <span className="block text-white font-bold text-lg tracking-tight group-hover:underline underline-offset-2">Guardian</span>
              <span className="block text-white/50 text-xs font-semibold tracking-[0.2em] uppercase">Group</span>
            </div>
            <ExternalLink className="h-3.5 w-3.5 text-white/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 self-start mt-1" />
          </a>

          {/* ── Hero ── */}
          <div className="mt-10">
            {/* Pill badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 mb-6">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-white/70 text-xs font-semibold tracking-[0.15em] uppercase">Compliance That Counts</span>
            </div>

            <h1 className="text-4xl xl:text-5xl font-bold leading-[1.1] text-white mb-3">
              Your people,{" "}
              <span
                style={{
                  background: "linear-gradient(90deg, #38bdf8 0%, #818cf8 50%, #e879f9 100%)",
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
                  background: "linear-gradient(90deg, #4ade80 0%, #38bdf8 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                compliant.
              </span>
            </h1>
            <p className="text-white/55 text-sm leading-relaxed max-w-md mb-8">
              Guardian Group turns HR, employment law, and health &amp; safety from a burden into a competitive advantage — all in one intelligent compliance portal.
            </p>

            {/* Key feature highlights */}
            <div className="flex items-stretch gap-3 mb-10">
              {KEY_FEATURES.map((f) => (
                <div
                  key={f.label}
                  className={`flex-1 flex flex-col items-center text-center gap-2.5 rounded-2xl border border-white/8 py-4 px-3 ${f.bg}`}
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${f.bg} border border-white/10`}>
                    <f.icon className={`h-5 w-5 ${f.color}`} />
                  </div>
                  <p className={`text-sm font-semibold ${f.color}`}>{f.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Feature grid ── */}
          <div className="grid grid-cols-2 gap-3 mt-auto" style={{ gridAutoRows: "1fr" }}>
            {FEATURES.map((f) => (
              <div
                key={f.label}
                className={`flex items-center gap-3.5 rounded-xl border px-4 py-4 backdrop-blur-sm ${f.bg}`}
              >
                <div className={`shrink-0 ${f.color}`}>
                  <f.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-white text-sm font-semibold leading-tight">{f.label}</p>
                  <p className="text-white/45 text-xs leading-snug mt-0.5 line-clamp-1">{f.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Trust strip ── */}
          <div className="mt-6 pt-5 border-t border-white/8 flex items-center gap-3">
            <div className="flex -space-x-1.5">
              {["bg-sky-400", "bg-emerald-400", "bg-violet-400", "bg-amber-400"].map((c, i) => (
                <div key={i} className={`h-6 w-6 rounded-full border-2 border-[#172240] ${c} opacity-80`} />
              ))}
            </div>
            <p className="text-white/40 text-xs">
              Trusted by <span className="text-white/65 font-semibold">10,000+ organisations</span> across the UK
            </p>
            <div className="ml-auto flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <CheckCircle2 key={i} className="h-3 w-3 text-emerald-400/60" />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Right panel – form ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 relative overflow-hidden bg-slate-50">
        {/* Subtle warm tint top-right */}
        <div className="absolute top-0 right-0 w-[350px] h-[350px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(14,165,233,0.05) 0%, transparent 70%)" }} />
        <div className="absolute bottom-0 left-0 w-[250px] h-[250px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(129,140,248,0.04) 0%, transparent 70%)" }} />

        {/* Mobile logo */}
        <a href="https://www.guardiangroup.co.uk" target="_blank" rel="noopener noreferrer" className="group flex lg:hidden items-center gap-3 mb-8 relative z-10 w-fit transition-opacity duration-200 hover:opacity-80">
          <img src={logoIcon} alt="Guardian Group" className="h-10 w-10 rounded-full object-cover transition-transform duration-200 group-hover:scale-105" />
          <div className="leading-tight">
            <span className="block text-slate-800 font-bold text-lg tracking-tight group-hover:underline underline-offset-2">Guardian</span>
            <span className="block text-slate-400 text-xs font-semibold tracking-[0.2em] uppercase">Group</span>
          </div>
          <ExternalLink className="h-3.5 w-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200 self-start mt-1" />
        </a>

        {isLoading ? (
          <div className="relative z-10 w-full max-w-sm flex flex-col items-center gap-5 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{ background: "linear-gradient(135deg, #0ea5e9, #818cf8)" }}>
              <Loader2 className="h-8 w-8 text-white animate-spin" />
            </div>
            <div>
              <p className="text-lg font-semibold text-slate-800">Signing you in</p>
              <p className="text-sm text-slate-500 mt-1">Loading your portal, please wait…</p>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
              <div className="h-full rounded-full login-progress-bar-inner" style={{ width: "60%" }} />
            </div>
          </div>
        ) : (

        <div className="relative z-10 w-full max-w-sm">
          {/* Form card */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/80 p-8">
            {/* Logo mark */}
            <div className="flex items-center gap-2.5 mb-7">
              <img src={logoIcon} alt="Guardian Group" className="h-8 w-8 rounded-full object-cover ring-1 ring-slate-200" />
              <div className="leading-tight">
                <span className="block text-slate-800 font-semibold text-sm tracking-tight">Guardian Group</span>
                <span className="block text-slate-400 text-[10px] font-medium tracking-[0.15em] uppercase">Compliance Portal</span>
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-slate-100 mb-7" />

            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-900">Welcome back</h2>
              <p className="text-slate-400 text-sm mt-1">Sign in to your compliance portal</p>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(d => { setIsSubmitting(true); setIsAccountLocked(false); setAttemptsRemaining(null); setLoginError(null); loginMutation.mutate(d); })} className="space-y-4">

                {isAccountLocked && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4" data-testid="alert-account-locked">
                    <div className="flex items-start gap-3">
                      <LockKeyhole className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-red-800">Account locked</p>
                        <p className="text-sm text-red-700 mt-0.5">Too many failed login attempts.</p>
                        <button
                          type="button"
                          className="mt-2 text-sm font-medium text-red-700 underline underline-offset-2 hover:text-red-900"
                          onClick={() => { setIsAccountLocked(false); setShowForgotPassword(true); }}
                          data-testid="button-locked-reset-password"
                        >
                          Reset your password to unlock
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {loginError && !isAccountLocked && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 flex items-center gap-2.5" data-testid="alert-login-error">
                    <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                    <p className="text-sm text-red-800">
                      {loginError}
                      {attemptsRemaining !== null && attemptsRemaining > 0 && (
                        <>{" "}<span className="font-semibold">{attemptsRemaining} attempt{attemptsRemaining !== 1 ? "s" : ""} remaining.</span></>
                      )}
                    </p>
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-600 text-sm font-medium">Username or Email</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter your username or email"
                          className="h-11 border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:bg-white"
                          data-testid="input-username"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-600 text-sm font-medium">Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter your password"
                            className="h-11 pr-10 border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:bg-white"
                            data-testid="input-password"
                            onKeyDown={(e) => setCapsLockOn(e.getModifierState("CapsLock"))}
                            onKeyUp={(e) => setCapsLockOn(e.getModifierState("CapsLock"))}
                            {...field}
                          />
                          <button
                            type="button"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            onClick={() => setShowPassword(!showPassword)}
                            data-testid="button-toggle-password"
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </FormControl>
                      {capsLockOn && !showPassword && (
                        <div className="flex items-center gap-1.5 mt-1 text-amber-600" data-testid="alert-caps-lock">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          <span className="text-xs font-medium">Caps Lock is on</span>
                        </div>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {SITE_KEY && (
                  <div className="flex justify-center" data-testid="turnstile-widget">
                    <div ref={turnstileRef} />
                  </div>
                )}

                <div className="pt-1">
                  <Button
                    type="submit"
                    className="w-full h-11 font-semibold text-white border-0"
                    style={{ background: "linear-gradient(90deg, #0ea5e9, #0891b2)" }}
                    disabled={loginMutation.isPending || (!!SITE_KEY && !turnstileToken)}
                    data-testid="button-login"
                  >
                    {loginMutation.isPending ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in...</>
                    ) : (
                      <>Sign In <ArrowRight className="ml-2 h-4 w-4" /></>
                    )}
                  </Button>
                </div>

                <button
                  type="button"
                  className="w-full text-xs text-slate-400 hover:text-slate-600 font-medium py-1 transition-colors"
                  onClick={() => setShowForgotPassword(true)}
                  data-testid="button-forgot-password"
                >
                  Forgot password?
                </button>
              </form>
            </Form>
          </div>

          {/* Footer */}
          <p className="text-center text-slate-400 text-xs mt-6">
            Protected by SSL encryption · GDPR compliant
          </p>
        </div>
        )}
      </div>

      {/* Forgot password dialog */}
      <Dialog open={showForgotPassword} onOpenChange={closeForgotPasswordDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              {resetSuccess
                ? "Password reset instructions have been sent."
                : "Enter your email address and we'll send you a link to reset your password."}
            </DialogDescription>
          </DialogHeader>
          {!resetSuccess ? (
            <form onSubmit={handleForgotPassword}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="forgot-email">Email</Label>
                  <Input
                    id="forgot-email"
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="Enter your email address"
                    data-testid="input-forgot-email"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeForgotPasswordDialog}>Cancel</Button>
                <Button type="submit" disabled={forgotPasswordMutation.isPending} data-testid="button-send-reset">
                  {forgotPasswordMutation.isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</>
                  ) : "Send Reset Link"}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <div className="py-4">
              <p className="text-sm text-muted-foreground mb-4">
                If an account exists with this email address, you will receive a password reset link shortly.
              </p>
              {resetUrl && import.meta.env.DEV && (
                <div className="p-3 bg-muted rounded-md mb-4">
                  <p className="text-xs text-muted-foreground mb-2">(Development mode – reset link for testing:)</p>
                  <code className="text-xs break-all">{resetUrl}</code>
                </div>
              )}
              <DialogFooter>
                <Button onClick={closeForgotPasswordDialog} data-testid="button-close-reset">Close</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
