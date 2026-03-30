import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Eye, EyeOff, Loader2, ArrowRight, LockKeyhole, AlertTriangle } from "lucide-react";
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

const SERVICE_CARDS = [
  {
    label: "Human Resources",
    description: "Contracts, policies & support",
    color: "bg-sky-500/20 border-sky-400/30",
    dot: "bg-sky-400",
  },
  {
    label: "Employment Law",
    description: "Legal protection & guidance",
    color: "bg-rose-500/20 border-rose-400/30",
    dot: "bg-rose-400",
  },
  {
    label: "Health & Safety",
    description: "Risk management & training",
    color: "bg-emerald-500/20 border-emerald-400/30",
    dot: "bg-emerald-400",
  },
];

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [isAccountLocked, setIsAccountLocked] = useState(false);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const loginMutation = useMutation({
    mutationFn: async (data: LoginForm) => {
      const res = await apiRequest("POST", "/api/auth/login", data);
      return res.json();
    },
    onSuccess: async (userData) => {
      setIsAccountLocked(false);
      setAttemptsRemaining(null);

      // Prefetch all critical dashboard data while the loading screen is visible,
      // so the dashboard renders fully populated on first paint with no skeleton flash.
      const f = async (url: string) => {
        const res = await fetch(url, { credentials: "include" });
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json();
      };
      const p = (key: unknown[], url: string) =>
        queryClient.prefetchQuery({ queryKey: key, queryFn: () => f(url), staleTime: Infinity, gcTime: Infinity });

      const isClientUser = userData.role === "client";
      await Promise.all([
        p(["/api/sites"], "/api/sites"),
        p(["/api/companies"], "/api/companies"),
        p(["/api/user/module-access"], "/api/user/module-access"),
        p(["/api/modules/summary", null, null, isClientUser], "/api/modules/summary"),
        p(["/api/documents", null, null], "/api/documents"),
        p(["/api/missing-required-templates", null, null], "/api/missing-required-templates"),
        p(["/api/support-requests", null], "/api/support-requests"),
        p(["/api/support-requests/counts"], "/api/support-requests/counts"),
        p(["/api/training-bookings"], "/api/training-bookings"),
        p(["/api/incidents"], "/api/incidents"),
        p(["/api/cases"], "/api/cases"),
      ]);

      // All data is now in cache — set auth state and dashboard renders immediately
      queryClient.setQueryData(["/api/auth/me"], userData);
      const currentPath = window.location.pathname;
      if (!currentPath || currentPath === "/login") {
        setLocation("/");
      }
    },
    onError: async (error: Error) => {
      setIsSubmitting(false);
      setIsAccountLocked(false);
      setAttemptsRemaining(null);
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
        }
      } catch {
        // not JSON — show generic toast
      }
      if (statusCode !== 423) {
        toast({ title: "Login Failed", description: "Invalid username or password", variant: "destructive" });
      }
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
      {/* ── Left panel – brand ── */}
      <div
        className="hidden lg:flex lg:w-[58%] flex-col relative overflow-hidden"
        style={{ background: "linear-gradient(160deg, #1d3057 0%, #1a2a4a 50%, #172240 100%)" }}
      >
        {/* Subtle radial glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full opacity-[0.07]"
            style={{ background: "radial-gradient(circle, #22d3ee 0%, transparent 70%)" }} />
          <div className="absolute bottom-[10%] right-[-5%] w-[350px] h-[350px] rounded-full opacity-[0.07]"
            style={{ background: "radial-gradient(circle, #4ade80 0%, transparent 70%)" }} />
        </div>

        <div className="relative z-10 flex flex-col h-full px-12 py-10">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <img src={logoIcon} alt="Guardian Group" className="h-10 w-10 rounded-full object-cover" />
            <div className="leading-tight">
              <span className="block text-white font-bold text-lg tracking-tight">Guardian</span>
              <span className="block text-white/60 text-xs font-semibold tracking-[0.2em] uppercase">Group</span>
            </div>
          </div>

          {/* Hero text */}
          <div className="mt-auto mb-auto pt-16">
            {/* Accent bar + label */}
            <div className="flex items-center gap-3 mb-6">
              <div className="h-0.5 w-10 rounded-full" style={{ background: "linear-gradient(90deg, #38bdf8, #818cf8, #e879f9, #f97316, #a3e635)" }} />
              <span className="text-white/60 text-xs font-semibold tracking-[0.2em] uppercase">Compliance That Counts</span>
            </div>

            <h1 className="text-5xl font-bold leading-[1.1] text-white mb-2">
              Safer people.
            </h1>
            <div className="mb-8">
              <h1 className="text-5xl font-bold leading-[1.1]"
                style={{ background: "linear-gradient(90deg, #38bdf8 0%, #818cf8 22%, #e879f9 45%, #f97316 70%, #a3e635 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                Stronger futures.
              </h1>
              <div className="mt-2 h-[3px] w-full rounded-full" style={{ background: "linear-gradient(90deg, #38bdf8 0%, #818cf8 22%, #e879f9 45%, #f97316 70%, #a3e635 100%)" }} />
            </div>
            <p className="text-white/60 text-base max-w-sm leading-relaxed mb-8">
              Your organisation deserves more than tick-box compliance. We turn HR, employment law, and health and safety into foundations for growth.
            </p>
          </div>

          {/* Service cards */}
          <div className="mt-auto space-y-3 pb-4">
            {SERVICE_CARDS.map(card => (
              <div key={card.label}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 backdrop-blur-sm ${card.color}`}>
                <div className={`h-2 w-2 rounded-full shrink-0 ${card.dot}`} />
                <div>
                  <p className="text-white text-sm font-semibold">{card.label}</p>
                  <p className="text-white/50 text-xs">{card.description}</p>
                </div>
                <ArrowRight className="ml-auto h-4 w-4 text-white/30" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel – form ── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-white px-6 py-10">
        {/* Mobile logo */}
        <div className="flex lg:hidden items-center gap-3 mb-8">
          <img src={logoIcon} alt="Guardian Group" className="h-10 w-10 rounded-full object-cover" />
          <div className="leading-tight">
            <span className="block text-slate-900 font-bold text-lg tracking-tight">Guardian</span>
            <span className="block text-slate-400 text-xs font-semibold tracking-[0.2em] uppercase">Group</span>
          </div>
        </div>

        {isLoading ? (
          <div className="w-full max-w-sm flex flex-col items-center gap-5 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{ background: "linear-gradient(135deg, #0ea5e9, #818cf8)" }}>
              <Loader2 className="h-8 w-8 text-white animate-spin" />
            </div>
            <div>
              <p className="text-lg font-semibold text-slate-800">Signing you in</p>
              <p className="text-sm text-slate-500 mt-1">Loading your portal, please wait…</p>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full login-progress-bar-inner" style={{ width: "60%" }} />
            </div>
          </div>
        ) : (

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900">Portal sign in</h2>
            <p className="text-slate-500 text-sm mt-1">H&S and HR Compliance Portal</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(d => { setIsSubmitting(true); setIsAccountLocked(false); setAttemptsRemaining(null); loginMutation.mutate(d); })} className="space-y-5">

              {isAccountLocked && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4" data-testid="alert-account-locked">
                  <div className="flex items-start gap-3">
                    <LockKeyhole className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-red-800">Account locked</p>
                      <p className="text-sm text-red-700 mt-0.5">
                        Your account has been locked due to too many failed login attempts.
                      </p>
                      <button
                        type="button"
                        className="mt-2 text-sm font-medium text-red-700 underline underline-offset-2 hover:text-red-900"
                        onClick={() => { setIsAccountLocked(false); setShowForgotPassword(true); }}
                        data-testid="button-locked-reset-password"
                      >
                        Reset your password to unlock your account
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {attemptsRemaining !== null && attemptsRemaining > 0 && !isAccountLocked && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-center gap-2.5" data-testid="alert-attempts-remaining">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                  <p className="text-sm text-amber-800">
                    Incorrect password.{" "}
                    <span className="font-semibold">
                      {attemptsRemaining} attempt{attemptsRemaining !== 1 ? "s" : ""} remaining
                    </span>{" "}
                    before your account is locked.
                  </p>
                </div>
              )}

              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-700 font-medium">Username or Email</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter your username or email"
                        className="h-11 border-slate-200 bg-slate-50 focus:bg-white text-slate-900 placeholder:text-slate-400"
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
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-slate-700 font-medium">Password</FormLabel>
                      <button
                        type="button"
                        className="text-xs text-sky-600 hover:text-sky-700 font-medium"
                        onClick={() => setShowForgotPassword(true)}
                        data-testid="button-forgot-password"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="Enter your password"
                          className="h-11 pr-10 border-slate-200 bg-slate-50 focus:bg-white text-slate-900 placeholder:text-slate-400"
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
              <Button
                type="submit"
                className="w-full h-11 font-semibold"
                style={{ background: "linear-gradient(90deg, #0ea5e9, #0891b2)" }}
                disabled={loginMutation.isPending}
                data-testid="button-login"
              >
                {loginMutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in...</>
                ) : (
                  <>Sign In <ArrowRight className="ml-2 h-4 w-4" /></>
                )}
              </Button>
            </form>
          </Form>
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
