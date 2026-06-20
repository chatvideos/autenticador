import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { X, Camera, Keyboard, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AddAccountModalProps {
  onClose: () => void;
  onAdded: () => void;
}

type Tab = "qr" | "manual";

// Parse otpauth:// URI from QR code
function parseOtpAuthUri(uri: string): { name: string; secret: string; issuer?: string } | null {
  try {
    const url = new URL(uri);
    if (url.protocol !== "otpauth:") return null;
    const label = decodeURIComponent(url.pathname.slice(2)); // remove leading //
    const secret = url.searchParams.get("secret") || "";
    const issuer = url.searchParams.get("issuer") || undefined;

    // label format: "issuer:account" or just "account"
    const colonIdx = label.indexOf(":");
    const name = colonIdx >= 0 ? label.slice(colonIdx + 1).trim() : label.trim();
    const parsedIssuer = colonIdx >= 0 ? label.slice(0, colonIdx).trim() : issuer;

    return { name: name || label, secret, issuer: parsedIssuer };
  } catch {
    return null;
  }
}

export default function AddAccountModal({ onClose, onAdded }: AddAccountModalProps) {
  const [tab, setTab] = useState<Tab>("qr");

  // Manual form
  const [manualName, setManualName] = useState("");
  const [manualSecret, setManualSecret] = useState("");
  const [manualIssuer, setManualIssuer] = useState("");

  // QR scanner state
  const [scannerReady, setScannerReady] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [scannedData, setScannedData] = useState<{ name: string; secret: string; issuer?: string } | null>(null);
  const scannerRef = useRef<any>(null);
  const scannerDivId = "qr-reader-container";

  const addMutation = trpc.totp.add.useMutation({
    onSuccess: () => onAdded(),
    onError: (err) => toast.error(err.message),
  });

  // Initialize QR scanner when on QR tab
  useEffect(() => {
    if (tab !== "qr") return;

    let scanner: any = null;
    let mounted = true;

    const initScanner = async () => {
      try {
        // Dynamically import html5-qrcode to avoid SSR issues
        const { Html5Qrcode } = await import("html5-qrcode");
        if (!mounted) return;

        scanner = new Html5Qrcode(scannerDivId);
        scannerRef.current = scanner;

        const cameras = await Html5Qrcode.getCameras();
        if (!mounted) return;

        if (!cameras || cameras.length === 0) {
          setScannerError("Nenhuma câmera encontrada neste dispositivo.");
          return;
        }

        // Prefer back camera on mobile
        const camera = cameras.find(c =>
          c.label.toLowerCase().includes("back") ||
          c.label.toLowerCase().includes("traseira") ||
          c.label.toLowerCase().includes("rear")
        ) || cameras[cameras.length - 1];

        await scanner.start(
          camera.id,
          {
            fps: 10,
            qrbox: { width: 240, height: 240 },
            aspectRatio: 1.0,
          },
          (decodedText: string) => {
            const parsed = parseOtpAuthUri(decodedText);
            if (parsed) {
              setScannedData(parsed);
              scanner.stop().catch(() => {});
            } else {
              toast.error("QR code inválido. Use um QR code do Google Authenticator.");
            }
          },
          () => {} // ignore frame errors
        );

        if (mounted) setScannerReady(true);
      } catch (err: any) {
        if (!mounted) return;
        if (err?.message?.includes("Permission") || err?.name === "NotAllowedError") {
          setScannerError("Permissão de câmera negada. Permita o acesso à câmera e tente novamente.");
        } else {
          setScannerError("Não foi possível iniciar a câmera. Tente adicionar manualmente.");
        }
      }
    };

    initScanner();

    return () => {
      mounted = false;
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [tab]);

  // Stop scanner when switching tabs
  useEffect(() => {
    if (tab !== "qr" && scannerRef.current) {
      scannerRef.current.stop().catch(() => {});
      scannerRef.current = null;
      setScannerReady(false);
      setScannerError(null);
      setScannedData(null);
    }
  }, [tab]);

  const handleAddScanned = () => {
    if (!scannedData) return;
    addMutation.mutate({
      name: scannedData.name,
      secret: scannedData.secret,
      issuer: scannedData.issuer,
    });
  };

  const handleAddManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim() || !manualSecret.trim()) return;
    addMutation.mutate({
      name: manualName.trim(),
      secret: manualSecret.trim(),
      issuer: manualIssuer.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full sm:max-w-md mx-0 sm:mx-4 bg-card rounded-t-3xl sm:rounded-2xl border border-border/60 shadow-2xl overflow-hidden">
        {/* Handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-border/60" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/40">
          <h2 className="text-base font-semibold text-foreground">Adicionar conta 2FA</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex p-4 gap-2">
          <button
            onClick={() => setTab("qr")}
            className={`flex-1 flex items-center justify-center gap-2 h-10 rounded-xl text-sm font-medium transition-all duration-200 ${
              tab === "qr"
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            <Camera className="w-4 h-4" />
            Escanear QR
          </button>
          <button
            onClick={() => setTab("manual")}
            className={`flex-1 flex items-center justify-center gap-2 h-10 rounded-xl text-sm font-medium transition-all duration-200 ${
              tab === "manual"
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            <Keyboard className="w-4 h-4" />
            Manual
          </button>
        </div>

        {/* Content */}
        <div className="px-6 pb-6">
          {/* QR Scanner Tab */}
          {tab === "qr" && (
            <div className="space-y-4">
              {scannedData ? (
                // Scanned successfully
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                    <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">QR code lido com sucesso!</p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {scannedData.issuer ? `${scannedData.issuer} — ` : ""}{scannedData.name}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setScannedData(null)}
                      className="h-11 rounded-xl border-border/60"
                    >
                      Escanear outro
                    </Button>
                    <Button
                      onClick={handleAddScanned}
                      disabled={addMutation.isPending}
                      className="h-11 rounded-xl"
                      style={{
                        background: "linear-gradient(135deg, oklch(0.60 0.22 270), oklch(0.55 0.22 300))",
                      }}
                    >
                      {addMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Adicionar conta"
                      )}
                    </Button>
                  </div>
                </div>
              ) : scannerError ? (
                // Error state
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20">
                    <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-muted-foreground">{scannerError}</p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setTab("manual")}
                    className="w-full h-11 rounded-xl border-border/60"
                  >
                    Adicionar manualmente
                  </Button>
                </div>
              ) : (
                // Scanner view
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground text-center">
                    Aponte a câmera para o QR code do Google Authenticator
                  </p>
                  <div
                    className="relative rounded-2xl overflow-hidden bg-black"
                    style={{ minHeight: "280px" }}
                  >
                    <div id={scannerDivId} className="w-full" />
                    {!scannerReady && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80">
                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                        <p className="text-sm text-muted-foreground">Iniciando câmera...</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Manual Tab */}
          {tab === "manual" && (
            <form onSubmit={handleAddManual} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="manual-name" className="text-sm text-muted-foreground">
                  Nome da conta *
                </Label>
                <Input
                  id="manual-name"
                  placeholder="Ex: meu@email.com"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  className="h-11 bg-secondary/40 border-border/50 rounded-xl focus:border-primary/50"
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="manual-issuer" className="text-sm text-muted-foreground">
                  Serviço (opcional)
                </Label>
                <Input
                  id="manual-issuer"
                  placeholder="Ex: Google, GitHub, AWS..."
                  value={manualIssuer}
                  onChange={(e) => setManualIssuer(e.target.value)}
                  className="h-11 bg-secondary/40 border-border/50 rounded-xl focus:border-primary/50"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="manual-secret" className="text-sm text-muted-foreground">
                  Chave secreta *
                </Label>
                <Input
                  id="manual-secret"
                  placeholder="Ex: JBSWY3DPEHPK3PXP"
                  value={manualSecret}
                  onChange={(e) => setManualSecret(e.target.value)}
                  className="h-11 bg-secondary/40 border-border/50 rounded-xl focus:border-primary/50 font-mono text-sm tracking-wider"
                  required
                />
                <p className="text-xs text-muted-foreground/60">
                  Chave Base32 fornecida pelo serviço (sem espaços)
                </p>
              </div>

              <Button
                type="submit"
                disabled={addMutation.isPending || !manualName.trim() || !manualSecret.trim()}
                className="w-full h-11 rounded-xl font-medium"
                style={{
                  background: "linear-gradient(135deg, oklch(0.60 0.22 270), oklch(0.55 0.22 300))",
                  boxShadow: "0 4px 16px oklch(0.60 0.22 270 / 0.25)",
                }}
              >
                {addMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Adicionando...
                  </span>
                ) : (
                  "Adicionar conta"
                )}
              </Button>
            </form>
          )}
        </div>
      </div>

      {/* QR scanner custom styles */}
      <style>{`
        #qr-reader-container video {
          width: 100% !important;
          border-radius: 0 !important;
          object-fit: cover;
        }
        #qr-reader-container img[alt="Info icon"] { display: none !important; }
        #qr-reader-container > div:last-child { display: none !important; }
        #qr-reader-container__scan_region { border: none !important; }
        #qr-reader-container__scan_region > img { display: none !important; }
        #qr-reader-container__dashboard { display: none !important; }
      `}</style>
    </div>
  );
}
