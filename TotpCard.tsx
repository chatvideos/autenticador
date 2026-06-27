import { useState, useEffect, useCallback } from "react";
import * as OTPAuth from "otpauth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Copy, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TotpAccount {
  id: number;
  name: string;
  issuer?: string | null;
  icon?: string | null;
  secret: string;
  sortOrder?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface TotpCardProps {
  account: TotpAccount;
  onRemove: (id: number) => void;
}

// Map of service names to gradient colors
const SERVICE_COLORS: Record<string, string> = {
  google: "135deg, #4285F4, #34A853",
  github: "135deg, #24292e, #586069",
  microsoft: "135deg, #00A4EF, #7FBA00",
  amazon: "135deg, #FF9900, #FF6600",
  aws: "135deg, #FF9900, #FF6600",
  facebook: "135deg, #1877F2, #0C5EBF",
  twitter: "135deg, #1DA1F2, #0D8ECF",
  instagram: "135deg, #E1306C, #833AB4",
  discord: "135deg, #5865F2, #4752C4",
  slack: "135deg, #4A154B, #36C5F0",
  dropbox: "135deg, #0061FF, #0040AA",
  gitlab: "135deg, #FC6D26, #E24329",
  bitbucket: "135deg, #0052CC, #0747A6",
  cloudflare: "135deg, #F48120, #FBAD41",
  digitalocean: "135deg, #0080FF, #0057B8",
  stripe: "135deg, #635BFF, #4F46E5",
  paypal: "135deg, #003087, #009CDE",
  apple: "135deg, #555555, #333333",
  netflix: "135deg, #E50914, #B20710",
  steam: "135deg, #1B2838, #2A475E",
  twitch: "135deg, #9146FF, #6441A4",
  default: "135deg, oklch(0.60 0.22 270), oklch(0.55 0.22 300)",
};

function getServiceColor(name: string, issuer?: string | null): string {
  const searchStr = (issuer || name).toLowerCase();
  for (const [key, gradient] of Object.entries(SERVICE_COLORS)) {
    if (searchStr.includes(key)) return gradient;
  }
  return SERVICE_COLORS.default;
}

function getServiceInitials(name: string, issuer?: string | null): string {
  const label = issuer || name;
  const words = label.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return label.slice(0, 2).toUpperCase();
}

function formatCode(code: string): string {
  if (code.length === 6) {
    return code.slice(0, 3) + " " + code.slice(3);
  }
  return code;
}

// Generate TOTP code locally using device clock
function generateLocalTotp(secret: string): { code: string; remaining: number } {
  try {
    const totp = new OTPAuth.TOTP({
      secret: OTPAuth.Secret.fromBase32(secret.toUpperCase().replace(/\s+/g, "")),
      digits: 6,
      period: 30,
      algorithm: "SHA1",
    });
    const code = totp.generate();
    const epoch = Math.floor(Date.now() / 1000);
    const remaining = 30 - (epoch % 30);
    return { code, remaining };
  } catch {
    return { code: "------", remaining: 30 };
  }
}

export default function TotpCard({ account, onRemove }: TotpCardProps) {
  const [copied, setCopied] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Generate code locally using device clock (same as Google Authenticator)
  const getLocalCode = useCallback(() => generateLocalTotp(account.secret), [account.secret]);

  const [{ code: currentCode, remaining }, setCodeState] = useState(() => getLocalCode());

  // Update code every second using device clock
  useEffect(() => {
    const update = () => setCodeState(getLocalCode());
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [getLocalCode]);

  const utils = trpc.useUtils();

  const removeMutation = trpc.totp.remove.useMutation({
    onSuccess: () => {
      onRemove(account.id);
      toast.success(`"${account.name}" removida.`);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(currentCode.replace(/\s/g, "")).then(() => {
      setCopied(true);
      toast.success("Código copiado!");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleRemove = () => {
    if (!showConfirm) {
      setShowConfirm(true);
      setTimeout(() => setShowConfirm(false), 3000);
      return;
    }
    removeMutation.mutate({ id: account.id });
  };

  const progress = (remaining / 30) * 100;
  const isExpiring = remaining <= 7;
  const gradient = getServiceColor(account.name, account.issuer);
  const initials = getServiceInitials(account.name, account.issuer);

  return (
    <div className="group relative glass-card rounded-2xl p-5 transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
      <div className="flex items-center gap-4">
        {/* Service icon */}
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md text-white font-semibold text-sm"
          style={{ background: `linear-gradient(${gradient})` }}
        >
          {initials}
        </div>

        {/* Account info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-sm font-medium text-foreground truncate">{account.name}</p>
            {account.issuer && (
              <span className="text-xs text-muted-foreground/60 truncate hidden sm:block">
                · {account.issuer}
              </span>
            )}
          </div>

          {/* TOTP Code */}
          <div className="flex items-baseline gap-3">
            <span
              className={`totp-code text-2xl font-semibold tracking-widest transition-all duration-300 ${
                isExpiring ? "text-orange-400" : "text-primary"
              }`}
              style={{
                fontFamily: "'JetBrains Mono', 'Courier New', monospace",
              }}
            >
              {formatCode(currentCode)}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopy}
            className="w-8 h-8 rounded-lg hover:bg-primary/10 hover:text-primary"
            title="Copiar código"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-green-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRemove}
            disabled={removeMutation.isPending}
            className={`w-8 h-8 rounded-lg transition-colors ${
              showConfirm
                ? "bg-destructive/20 text-destructive hover:bg-destructive/30"
                : "hover:bg-destructive/10 hover:text-destructive"
            }`}
            title={showConfirm ? "Clique novamente para confirmar" : "Remover conta"}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Timer circle */}
        <div className="relative w-9 h-9 flex-shrink-0 ml-1">
          <svg className="w-9 h-9 -rotate-90" viewBox="0 0 36 36">
            <circle
              cx="18"
              cy="18"
              r="15"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className="text-border/40"
            />
            <circle
              cx="18"
              cy="18"
              r="15"
              fill="none"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 15}`}
              strokeDashoffset={`${2 * Math.PI * 15 * (1 - progress / 100)}`}
              className="transition-all duration-1000"
              style={{
                stroke: isExpiring ? "oklch(0.75 0.18 50)" : "oklch(0.65 0.22 270)",
              }}
            />
          </svg>
          <span
            className={`absolute inset-0 flex items-center justify-center text-[10px] font-semibold ${
              isExpiring ? "text-orange-400" : "text-muted-foreground"
            }`}
          >
            {remaining}
          </span>
        </div>
      </div>

      {/* Progress bar at bottom */}
      <div className="mt-4 h-0.5 rounded-full bg-border/30 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{
            width: `${progress}%`,
            background: isExpiring
              ? "linear-gradient(90deg, oklch(0.75 0.18 50), oklch(0.70 0.20 30))"
              : "linear-gradient(90deg, oklch(0.65 0.22 270), oklch(0.60 0.22 300))",
          }}
        />
      </div>

      {showConfirm && (
        <div className="absolute inset-x-0 -bottom-1 flex justify-center">
          <span className="text-xs text-destructive/80 bg-background px-2 py-0.5 rounded-full border border-destructive/20">
            Clique novamente para confirmar remoção
          </span>
        </div>
      )}
    </div>
  );
}
