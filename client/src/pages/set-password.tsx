import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Shield, CheckCircle, AlertCircle, Eye, EyeOff, X, FileText } from "lucide-react";
import logoIcon from "@assets/IFRA_and_Guardian_Group_A4_1767695098725.jpg";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { PdfViewer } from "@/components/pdf-viewer";
import { AuthShell } from "@/components/auth-shell";

const PasswordRequirement = ({ met, text }: { met: boolean; text: string }) => (
  <div className="flex items-center gap-2 text-xs">
    {met ? (
      <CheckCircle className="h-3 w-3 text-green-500" />
    ) : (
      <X className="h-3 w-3 text-muted-foreground" />
    )}
    <span className={met ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}>{text}</span>
  </div>
);

const SectionHeader = ({
  icon,
  iconBg,
  title,
  description,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  description?: React.ReactNode;
}) => (
  <div className="text-center mb-6">
    <div className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full ${iconBg}`}>
      {icon}
    </div>
    <h2 className="text-xl font-bold text-slate-900">{title}</h2>
    {description && (
      <p className="text-sm text-slate-500 mt-1.5">{description}</p>
    )}
  </div>
);

export default function SetPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const goToLogin = () => {
    // Pre-seed the auth cache so AuthenticatedApp knows immediately
    // the user is not signed in, skipping the loading spinner entirely.
    queryClient.setQueryData(["/api/auth/me"], null);
    setLocation("/");
  };
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<"terms" | "privacy" | null>(null);

  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get("token");

  const { data: validation, isLoading: validating, error: validationError } = useQuery({
    queryKey: ["/api/invitations/validate", token],
    queryFn: async () => {
      if (!token) throw new Error("No token provided");
      const response = await fetch(`/api/invitations/validate?token=${encodeURIComponent(token)}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Invalid invitation");
      }
      return response.json();
    },
    enabled: !!token && !isSuccess,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });

  const { data: termsInfo } = useQuery<{ exists: boolean }>({
    queryKey: ["/api/legal-documents/terms/info"],
    enabled: !!validation?.valid && validation?.purpose === "invite",
  });

  const { data: privacyInfo } = useQuery<{ exists: boolean }>({
    queryKey: ["/api/legal-documents/privacy/info"],
    enabled: !!validation?.valid && validation?.purpose === "invite",
  });

  const isInvite = validation?.purpose === "invite";
  const termsAvailable = termsInfo?.exists === true;
  const privacyAvailable = privacyInfo?.exists === true;
  const legalAcceptanceRequired = isInvite && (termsAvailable || privacyAvailable);
  const legalAccepted = (!termsAvailable || acceptedTerms) && (!privacyAvailable || acceptedPrivacy);

  const acceptMutation = useMutation({
    mutationFn: async (data: { token: string; password: string; acceptedTerms?: boolean; acceptedPrivacy?: boolean }) => {
      const response = await apiRequest("POST", "/api/invitations/accept", data);
      return response.json();
    },
    onSuccess: () => {
      setIsSuccess(true);
      toast({
        title: "Password Set Successfully",
        description: "Your account is now active. You can log in with your new password.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to set password",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const passwordRequirements = {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSymbol: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  };

  const allRequirementsMet = Object.values(passwordRequirements).every(Boolean);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!allRequirementsMet) {
      toast({
        title: "Password requirements not met",
        description: "Please ensure your password meets all the requirements listed below.",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure your passwords match.",
        variant: "destructive",
      });
      return;
    }

    if (legalAcceptanceRequired && !legalAccepted) {
      toast({
        title: "Legal documents required",
        description: "Please accept the Terms & Conditions and Privacy Policy to continue.",
        variant: "destructive",
      });
      return;
    }

    if (!token) return;
    acceptMutation.mutate({ 
      token, 
      password,
      ...(legalAcceptanceRequired && { acceptedTerms, acceptedPrivacy }),
    });
  };

  if (!token) {
    return (
      <AuthShell>
        <SectionHeader
          icon={<AlertCircle className="h-6 w-6 text-destructive" />}
          iconBg="bg-destructive/10"
          title="Invalid Link"
          description="This link is missing required information. Please use the link from your invitation email."
        />
        <div className="flex justify-center">
          <Button onClick={goToLogin} data-testid="button-go-to-login">
            Go to Login
          </Button>
        </div>
      </AuthShell>
    );
  }

  if (isSuccess && validation?.valid) {
    return (
      <AuthShell>
        <SectionHeader
          icon={<CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />}
          iconBg="bg-green-100 dark:bg-green-900/30"
          title={validation.purpose === "invite" ? "Account Activated" : "Password Reset Complete"}
          description={
            validation.purpose === "invite"
              ? "Your account is now active. You can log in with either of the following:"
              : "Your password has been reset. You can log in with either of the following:"
          }
        />
        <div className="mb-4">
          <table className="w-full text-sm border rounded-md overflow-hidden">
            <tbody>
              <tr className="border-b">
                <th className="text-left font-medium px-3 py-2 bg-muted/50 w-1/3">
                  Email
                </th>
                <td className="px-3 py-2 font-bold break-all" data-testid="text-login-email">
                  {validation.email}
                </td>
              </tr>
              <tr>
                <th className="text-left font-medium px-3 py-2 bg-muted/50">
                  Username
                </th>
                <td className="px-3 py-2 font-bold break-all" data-testid="text-login-username">
                  {validation.username}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="flex justify-center">
          <Button onClick={goToLogin} data-testid="button-login-now">
            Log In Now
          </Button>
        </div>
      </AuthShell>
    );
  }

  if (validating) {
    return (
      <AuthShell>
        <div className="flex flex-col items-center gap-4 py-4">
          <img src={logoIcon} alt="" className="h-8 w-8 rounded-full object-cover animate-spin shadow" style={{ animationDuration: "1.5s" }} />
          <p className="text-slate-500 text-sm">Validating your invitation...</p>
        </div>
      </AuthShell>
    );
  }

  if (validationError || !validation?.valid) {
    const errorMessage = (validationError as Error)?.message || "This invitation link is invalid or has expired.";
    return (
      <AuthShell>
        <SectionHeader
          icon={<AlertCircle className="h-6 w-6 text-destructive" />}
          iconBg="bg-destructive/10"
          title="Link No Longer Valid"
          description={errorMessage}
        />
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm text-slate-500 text-center">
            Please contact your administrator to request a new invitation.
          </p>
          <Button onClick={goToLogin} data-testid="button-go-to-login">
            Go to Login
          </Button>
        </div>
      </AuthShell>
    );
  }

  if (isSuccess) {
    return (
      <AuthShell>
        <SectionHeader
          icon={<CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />}
          iconBg="bg-green-100 dark:bg-green-900/30"
          title={validation.purpose === "invite" ? "Account Activated" : "Password Reset Complete"}
          description={
            validation.purpose === "invite"
              ? "Your account is now active. You can log in with either of the following:"
              : "Your password has been reset. You can log in with either of the following:"
          }
        />
        <div className="mb-4">
          <table className="w-full text-sm border rounded-md overflow-hidden">
            <tbody>
              <tr className="border-b">
                <th className="text-left font-medium px-3 py-2 bg-muted/50 w-1/3">
                  Email
                </th>
                <td className="px-3 py-2 font-bold break-all" data-testid="text-login-email">
                  {validation.email}
                </td>
              </tr>
              <tr>
                <th className="text-left font-medium px-3 py-2 bg-muted/50">
                  Username
                </th>
                <td className="px-3 py-2 font-bold break-all" data-testid="text-login-username">
                  {validation.username}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="flex justify-center">
          <Button onClick={goToLogin} data-testid="button-login-now">
            Log In Now
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <>
      <AuthShell>
        <SectionHeader
          icon={<Shield className="h-6 w-6 text-primary" />}
          iconBg="bg-primary/10"
          title={validation.purpose === "invite" ? "Set Up Your Password" : "Reset Your Password"}
          description={
            validation.purpose === "invite"
              ? `Welcome, ${validation.fullName}! Create a secure password to activate your account.`
              : `Enter a new password for your account (${validation.email}).`
          }
        />
        <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="password">New Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="pr-10"
                    required
                    data-testid="input-password"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                    data-testid="button-toggle-password"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <div className="space-y-1 mt-2 p-3 bg-muted/30 rounded-md">
                  <p className="text-xs font-medium mb-2">Password must contain:</p>
                  <PasswordRequirement met={passwordRequirements.minLength} text="At least 8 characters" />
                  <PasswordRequirement met={passwordRequirements.hasUppercase} text="One uppercase letter (A-Z)" />
                  <PasswordRequirement met={passwordRequirements.hasLowercase} text="One lowercase letter (a-z)" />
                  <PasswordRequirement met={passwordRequirements.hasNumber} text="One number (0-9)" />
                  <PasswordRequirement met={passwordRequirements.hasSymbol} text="One symbol (!@#$%...)" />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                    className="pr-10"
                    required
                    data-testid="input-confirm-password"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    data-testid="button-toggle-confirm-password"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {confirmPassword && password !== confirmPassword && (
                  <p className="text-xs text-destructive">Passwords do not match</p>
                )}
              </div>

              {legalAcceptanceRequired && (
                <div className="space-y-3 rounded-md border p-4">
                  <p className="text-sm font-medium">Legal Agreements</p>
                  <p className="text-xs text-muted-foreground">
                    Please review and accept the following documents to continue.
                  </p>
                  <div className="space-y-3">
                    {termsAvailable && (
                      <div className="space-y-2">
                        <div
                          className="flex items-center gap-3 rounded-lg border border-muted bg-muted/30 p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => setPreviewDoc("terms")}
                          data-testid="card-preview-terms"
                        >
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">Terms & Conditions</p>
                            <p className="text-xs text-muted-foreground">Click to preview document</p>
                          </div>
                          <Eye className="h-4 w-4 text-muted-foreground shrink-0" />
                        </div>
                        <div className="flex items-center gap-3 px-1">
                          <Checkbox
                            id="accept-terms"
                            checked={acceptedTerms}
                            onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                            data-testid="checkbox-accept-terms"
                          />
                          <label htmlFor="accept-terms" className="text-sm leading-relaxed cursor-pointer">
                            I have read and agree to the Terms & Conditions
                          </label>
                        </div>
                      </div>
                    )}
                    {privacyAvailable && (
                      <div className="space-y-2">
                        <div
                          className="flex items-center gap-3 rounded-lg border border-muted bg-muted/30 p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => setPreviewDoc("privacy")}
                          data-testid="card-preview-privacy"
                        >
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">Privacy Policy</p>
                            <p className="text-xs text-muted-foreground">Click to preview document</p>
                          </div>
                          <Eye className="h-4 w-4 text-muted-foreground shrink-0" />
                        </div>
                        <div className="flex items-center gap-3 px-1">
                          <Checkbox
                            id="accept-privacy"
                            checked={acceptedPrivacy}
                            onCheckedChange={(checked) => setAcceptedPrivacy(checked === true)}
                            data-testid="checkbox-accept-privacy"
                          />
                          <label htmlFor="accept-privacy" className="text-sm leading-relaxed cursor-pointer">
                            I have read and acknowledge the Privacy Policy
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={acceptMutation.isPending || !allRequirementsMet || password !== confirmPassword || (legalAcceptanceRequired && !legalAccepted)}
                data-testid="button-set-password"
              >
                {acceptMutation.isPending ? (
                  <>
                    <img src={logoIcon} alt="" className="mr-2 h-4 w-4 rounded-full object-cover animate-spin" style={{ animationDuration: "1.5s" }} />
                    Setting Password...
                  </>
                ) : (
                  validation.purpose === "invite" ? "Activate Account" : "Reset Password"
                )}
              </Button>
        </form>
      </AuthShell>

      {/* Legal document preview dialog */}
      <Dialog open={previewDoc !== null} onOpenChange={(open) => !open && setPreviewDoc(null)}>
        <DialogContent className="h-[80vh] flex flex-col p-0 overflow-hidden" style={{ maxWidth: "860px" }}>
          <DialogHeader className="p-6 pb-2">
            <DialogTitle>
              {previewDoc === "terms" ? "Terms & Conditions" : "Privacy Policy"}
            </DialogTitle>
            <DialogDescription>
              Preview of the legal document.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 w-full bg-white min-h-0 relative">
            {previewDoc && (
              <PdfViewer url={`/api/legal-documents/${previewDoc}/view`} />
            )}
          </div>
          <DialogFooter className="p-4 border-t">
            <Button onClick={() => setPreviewDoc(null)}>Close Preview</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
