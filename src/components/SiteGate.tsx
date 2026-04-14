import { useState, useEffect, type ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, Loader2, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "siteGateUnlocked";

export function SiteGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(STORAGE_KEY) === "true") {
      setUnlocked(true);
      return;
    }

    (async () => {
      const { data, error: rpcError } = await (supabase.rpc as any)("verify_site_password", {
        p_password: "",
      });

      if (rpcError || data === true) {
        sessionStorage.setItem(STORAGE_KEY, "true");
        setUnlocked(true);
      } else {
        setUnlocked(false);
      }
    })();
  }, []);

  const handleSubmit = async () => {
    if (!password.trim()) return;
    setChecking(true);
    setError("");

    const { data, error: rpcError } = await (supabase.rpc as any)("verify_site_password", {
      p_password: password,
    });

    if (rpcError) {
      setError("Something went wrong. Please try again.");
      setChecking(false);
      return;
    }

    if (data) {
      sessionStorage.setItem(STORAGE_KEY, "true");
      setUnlocked(true);
    } else {
      setError("Incorrect password.");
    }
    setChecking(false);
  };

  if (unlocked === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (unlocked) return <>{children}</>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-subtle px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Lock className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-2xl">Site Access</CardTitle>
          <CardDescription>Enter the password to continue.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              autoFocus
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Eye className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            className="w-full"
            variant="hero"
            onClick={handleSubmit}
            disabled={checking}
          >
            {checking ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Continue
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
