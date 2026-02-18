import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Shield, CheckCircle, AlertCircle, Loader2, Eye, EyeOff, ShieldCheck, X, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

const BrandingHeader = () => (
  <div className="text-center mb-6">
    <div className="flex items-center justify-center gap-2 mb-2">
      <ShieldCheck className="h-8 w-8 text-primary" />
      <span className="text-xl font-bold text-primary">Guardian Group</span>
    </div>
    <p className="text-sm text-muted-foreground">H&S Compliance Portal</p>
  </div>
);

export default function SetPassword() {
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);

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
    enabled: !!token,
    retry: false,
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
      ...(isInvite && { acceptedTerms, acceptedPrivacy }),
    });
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md">
          <BrandingHeader />
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle>Invalid Link</CardTitle>
              <CardDescription>
                This link is missing required information. Please use the link from your invitation email.
              </CardDescription>
            </CardHeader>
            <CardFooter className="justify-center">
              <Button onClick={() => window.location.href = "/login"} data-testid="button-go-to-login">
                Go to Login
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md">
          <BrandingHeader />
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground">Validating your invitation...</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (validationError || !validation?.valid) {
    const errorMessage = (validationError as Error)?.message || "This invitation link is invalid or has expired.";
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md">
          <BrandingHeader />
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle>Invalid or Expired Link</CardTitle>
              <CardDescription>{errorMessage}</CardDescription>
            </CardHeader>
            <CardFooter className="flex-col gap-3">
            <p className="text-sm text-muted-foreground text-center">
              Please contact your administrator to request a new invitation.
            </p>
            <Button onClick={() => window.location.href = "/login"} data-testid="button-go-to-login">
              Go to Login
            </Button>
          </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md">
          <BrandingHeader />
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle>
                {validation.purpose === "invite" ? "Account Activated" : "Password Reset Complete"}
              </CardTitle>
              <CardDescription>
                {validation.purpose === "invite" 
                  ? "Your account is now active. You can log in with your new password."
                  : "Your password has been reset. You can now log in."}
              </CardDescription>
            </CardHeader>
            <CardFooter className="justify-center">
              <Button onClick={() => window.location.href = "/login"} data-testid="button-login-now">
                Log In Now
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <BrandingHeader />
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>
              {validation.purpose === "invite" ? "Set Up Your Password" : "Reset Your Password"}
            </CardTitle>
            <CardDescription>
              {validation.purpose === "invite" 
                ? `Welcome, ${validation.fullName}! Create a secure password to activate your account.`
                : `Enter a new password for your account (${validation.email}).`}
            </CardDescription>
          </CardHeader>
          <CardContent>
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
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-1/2 -translate-y-1/2"
                    onClick={() => setShowPassword(!showPassword)}
                    data-testid="button-toggle-password"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
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
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-1/2 -translate-y-1/2"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    data-testid="button-toggle-confirm-password"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
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
                  {termsAvailable && (
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="accept-terms"
                        checked={acceptedTerms}
                        onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                        data-testid="checkbox-accept-terms"
                      />
                      <label htmlFor="accept-terms" className="text-sm leading-relaxed cursor-pointer">
                        I have read and agree to the{" "}
                        <button
                          type="button"
                          className="text-primary underline underline-offset-2 font-medium"
                          onClick={() => window.open("/api/legal-documents/terms/view", "_blank")}
                          data-testid="link-terms"
                        >
                          Terms & Conditions
                        </button>
                      </label>
                    </div>
                  )}
                  {privacyAvailable && (
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="accept-privacy"
                        checked={acceptedPrivacy}
                        onCheckedChange={(checked) => setAcceptedPrivacy(checked === true)}
                        data-testid="checkbox-accept-privacy"
                      />
                      <label htmlFor="accept-privacy" className="text-sm leading-relaxed cursor-pointer">
                        I have read and acknowledge the{" "}
                        <button
                          type="button"
                          className="text-primary underline underline-offset-2 font-medium"
                          onClick={() => window.open("/api/legal-documents/privacy/view", "_blank")}
                          data-testid="link-privacy"
                        >
                          Privacy Policy
                        </button>
                      </label>
                    </div>
                  )}
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
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Setting Password...
                  </>
                ) : (
                  validation.purpose === "invite" ? "Activate Account" : "Reset Password"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
