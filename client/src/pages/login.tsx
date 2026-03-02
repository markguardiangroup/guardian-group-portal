import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Eye, EyeOff, Loader2, ArrowRight } from "lucide-react";
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
  const [, setIsLoggingIn] = useState(false);
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetUrl, setResetUrl] = useState<string | null>(null);

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
    mutationFn: async (data: LoginForm) => apiRequest("POST", "/api/auth/login", data),
    onSuccess: async () => {
      queryClient.clear();
      const currentPath = window.location.pathname + window.location.search;
      const redirectTo = currentPath && currentPath !== "/" && currentPath !== "/login" ? currentPath : "/";
      window.location.href = redirectTo;
    },
    onError: (error: Error) => {
      toast({ title: "Login Failed", description: error.message || "Invalid username or password", variant: "destructive" });
    },
  });

  const devLogin = async (username: string) => {
    try {
      setIsLoggingIn(true);
      queryClient.clear();
      await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password: "admin123" }),
        credentials: "include",
      });
      window.location.href = "/";
    } catch (e) {
      console.error("Login failed", e);
    }
  };

  return (
    <div className="min-h-screen flex">
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
              <div className="h-0.5 w-10 rounded-full" style={{ background: "linear-gradient(90deg, #38bdf8, #10b981, #eab308, #f472b6)" }} />
              <span className="text-white/60 text-xs font-semibold tracking-[0.2em] uppercase">Compliance That Counts</span>
            </div>

            <h1 className="text-5xl font-bold leading-[1.1] text-white mb-2">
              Safer people.
            </h1>
            <h1 className="text-5xl font-bold leading-[1.1] mb-8"
              style={{ background: "linear-gradient(90deg, #38bdf8 0%, #10b981 35%, #eab308 70%, #f472b6 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              Stronger futures.
            </h1>
            <p className="text-white/60 text-base max-w-sm leading-relaxed">
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

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900">Portal sign in</h2>
            <p className="text-slate-500 text-sm mt-1">H&S and HR Compliance Portal</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(d => loginMutation.mutate(d))} className="space-y-5">
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

          {/* Dev accounts */}
          <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Quick access – demo accounts</p>
            <div className="space-y-2">
              {[
                { label: "Admin", username: "admin", color: "bg-slate-800 hover:bg-slate-900", testId: "button-dev-login-admin" },
                { label: "Consultant (Jane)", username: "jane.smith", color: "bg-emerald-600 hover:bg-emerald-700", testId: "button-dev-login-consultant-jane" },
                { label: "Pro Consultant (John)", username: "john.doe", color: "bg-emerald-600 hover:bg-emerald-700", testId: "button-dev-login-consultant" },
                { label: "Client (Sarah)", username: "sarah.johnson", color: "bg-sky-600 hover:bg-sky-700", testId: "button-dev-login-client" },
                { label: "Client (Mike)", username: "mike.brown", color: "bg-sky-600 hover:bg-sky-700", testId: "button-dev-login-client-mike" },
              ].map(({ label, username, color, testId }) => (
                <div key={username} className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-600 truncate">{label}</span>
                  <button
                    type="button"
                    onClick={() => devLogin(username)}
                    data-testid={testId}
                    className={`shrink-0 rounded-md px-3 py-1 text-xs font-medium text-white transition-colors ${color}`}
                  >
                    Login
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
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
