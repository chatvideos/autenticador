import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ShieldCheck, Eye, EyeOff, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface LoginProps {
  onAuthenticated: () => void;
}

export default function Login({ onAuthenticated }: LoginProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [shake, setShake] = useState(false);

  const loginMutation = trpc.appAuth.login.useMutation({
    onSuccess: () => {
      onAuthenticated();
    },
    onError: (err) => {
      setIsLoading(false);
      setShake(true);
      setTimeout(() => setShake(false), 600);
      toast.error(err.message || "Senha incorreta.");
      setPassword("");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setIsLoading(true);
    loginMutation.mutate({ password });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden px-4">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-40 -right-40 w-96 h-96 rounded-full opacity-10"
          style={{
            background: "radial-gradient(circle, oklch(0.65 0.22 270), transparent 70%)",
          }}
        />
        <div
          className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full opacity-8"
          style={{
            background: "radial-gradient(circle, oklch(0.65 0.20 310), transparent 70%)",
          }}
        />
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(oklch(0.95 0.005 260) 1px, transparent 1px),
              linear-gradient(90deg, oklch(0.95 0.005 260) 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      {/* Login card */}
      <div
        className={`relative w-full max-w-md mx-4 transition-all duration-300 ${shake ? "animate-shake" : ""}`}
        style={{
          animation: shake ? "shake 0.5s cubic-bezier(.36,.07,.19,.97) both" : undefined,
        }}
      >
        <div className="glass-card rounded-2xl p-8 sm:p-10 shadow-2xl">
          {/* Logo / Icon */}
          <div className="flex flex-col items-center mb-8">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-lg"
              style={{
                background: "linear-gradient(135deg, oklch(0.60 0.22 270), oklch(0.55 0.22 300))",
              }}
            >
              <ShieldCheck className="w-8 h-8 text-white" strokeWidth={1.5} />
            </div>
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">
              Autenticador 2FA
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Acesso protegido por senha
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                <Lock className="w-4 h-4" />
              </div>
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Digite sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 pr-10 h-12 bg-secondary/50 border-border/60 text-foreground placeholder:text-muted-foreground/60 focus:border-primary/60 focus:ring-primary/20 rounded-xl text-base"
                autoFocus
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>

            <Button
              type="submit"
              disabled={isLoading || !password.trim()}
              className="w-full h-12 rounded-xl text-base font-medium transition-all duration-200"
              style={{
                background: "linear-gradient(135deg, oklch(0.60 0.22 270), oklch(0.55 0.22 300))",
                boxShadow: "0 4px 20px oklch(0.60 0.22 270 / 0.3)",
              }}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Verificando...
                </span>
              ) : (
                "Entrar"
              )}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground/50 mt-6">
            Seus códigos 2FA protegidos e sempre disponíveis
          </p>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          10%, 90% { transform: translateX(-2px); }
          20%, 80% { transform: translateX(4px); }
          30%, 50%, 70% { transform: translateX(-6px); }
          40%, 60% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}
