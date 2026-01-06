import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { LogIn, Eye, EyeOff } from "lucide-react";
import logoFull from "@assets/IFRA_and_Guardian_Group_A3_1767695020984.jpg";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginForm) => {
      return apiRequest("POST", "/api/auth/login", data);
    },
    onSuccess: async () => {
      toast({
        title: "Welcome",
        description: "You have successfully logged in",
      });
      // Force a full page reload to ensure session cookie is properly loaded
      window.location.href = "/";
    },
    onError: (error: Error) => {
      toast({
        title: "Login Failed",
        description: error.message || "Invalid username or password",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: LoginForm) => {
    loginMutation.mutate(data);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <Card className="w-full max-w-md border shadow-lg bg-white text-slate-900">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <img 
              src={logoFull} 
              alt="Guardian Group" 
              className="h-16 w-auto mx-auto"
            />
          </div>
          <CardDescription className="text-slate-600">
            H&S and HR Compliance Portal
          </CardDescription>
        </CardHeader>
        <CardContent className="[&_label]:text-slate-700 [&_input]:bg-white [&_input]:border-slate-300 [&_input]:text-slate-900 [&_input::placeholder]:text-slate-400">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter your username" 
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
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input 
                          type={showPassword ? "text" : "password"}
                          placeholder="Enter your password" 
                          data-testid="input-password"
                          {...field} 
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0"
                          onClick={() => setShowPassword(!showPassword)}
                          data-testid="button-toggle-password"
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button 
                type="submit" 
                className="w-full" 
                disabled={loginMutation.isPending}
                data-testid="button-login"
              >
                {loginMutation.isPending ? (
                  "Signing in..."
                ) : (
                  <>
                    <LogIn className="mr-2 h-4 w-4" />
                    Sign In
                  </>
                )}
              </Button>
            </form>
          </Form>

          <div className="mt-6 border-t border-slate-200 pt-4">
            <p className="text-sm text-slate-500 text-center mb-3">
              Demo Accounts
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between p-2 rounded bg-slate-100 text-slate-700">
                <div>
                  <span className="font-medium">Admin:</span> admin / admin123
                </div>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-slate-100 text-slate-700">
                <div>
                  <span className="font-medium">Consultant:</span> john.doe / consultant123
                </div>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-slate-100 text-slate-700">
                <div>
                  <span className="font-medium">Client:</span> sarah.acme / client123
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
