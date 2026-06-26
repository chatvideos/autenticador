import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  X,
  Camera,
  Keyboard,
  Loader2,
  CheckCircle2,
  AlertCircle,
  PackagePlus,
  ClipboardPaste,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { parseAnyAuthUri, type ImportedAccount } from "@/lib/googleAuthImport";

interface AddAccountModalProps {
  onClose: () => void;
  onAdded: () => void;
}

type Tab = "qr" | "manual" | "paste";

type ScannerState =
  | { status: "loading" }
  | { status: "scanning" }
  | { status: "error"; message: string }
  | { status: "scanned_single"; account: ImportedAccount }
  | { status: "scanned_multiple"; accounts: ImportedAccount[] };

export default function AddAccountModal({ onClose, onAdded }: AddAccountModalProps) {
  const [tab, setTab] = useState<Tab>("qr");

  // Manual form
  const [manualName, setManualName] = useState("");
  const [manualSecret, setManualSecret] = useState("");
  const [manualIssuer, setManualIssuer] = useState("");

  // Paste URI form
  const [pasteUri, setPasteUri] = useState("");
  const [pasteResult, setPasteResult] = useState<
    { single: ImportedAccount } | { multiple: ImportedAccount[] } | null
  >(null);
  const [pasteError, setPasteError] = useState("");

  // QR scanner state
  const [scannerState, setScannerState] = useState<ScannerState>({ status: "loading" });
  const [selectedAccounts, setSelectedAccounts] = useState<Set<number>>(new Set());
  const [lastScannedRaw, setLastScannedRaw] = useState<string>("");
  const scannerRef = useRef<any>(null);
  const scannerDivId = "qr-reader-container";

  const utils = trpc.useUtils();

  const addMutation = trpc.totp.add.useMutation({
    onError: (err) => toast.error(err.message),
  });

  // Initialize QR scanner when on QR tab
  useEffect(() => {
    if (tab !== "qr") return;

    let scanner: any = null;
    let mounted = true;

    const initScanner = async () => {
      setScannerState({ status: "loading" });
      setLastScannedRaw("");
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (!mounted) return;

        scanner = new Html5Qrcode(scannerDivId);
        scannerRef.current = scanner;

        const cameras = await Html5Qrcode.getCameras();
        if (!mounted) return;

        if (!cameras || cameras.length === 0) {
          setScannerState({ status: "error", message: "Nenhuma câmera encontrada neste dispositivo." });
          return;
        }

        // Prefer back camera on mobile
        const camera =
          cameras.find((c: any) =>
            c.label.toLowerCase().includes("back") ||
            c.label.toLowerCase().includes("traseira") ||
            c.label.toLowerCase().includes("rear")
          ) || cameras[cameras.length - 1];

        await scanner.start(
          camera.id,
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText: string) => {
            // Guardar o texto bruto para debug
            setLastScannedRaw(decodedText);
            console.log("[QR Scanner] Texto lido:", decodedText);

            const result = parseAnyAuthUri(decodedText);
            console.log("[QR Scanner] Resultado do parser:", result);

            if (!result) {
              // QR lido mas formato não reconhecido — não parar o scanner ainda
              // Apenas registrar para debug
              return;
            }

            scanner.stop().catch(() => {});
            if ("single" in result) {
              setScannerState({ status: "scanned_single", account: result.single });
            } else {
              setScannerState({ status: "scanned_multiple", accounts: result.multiple });
              setSelectedAccounts(new Set(result.multiple.map((_, i) => i)));
            }
          },
          () => {} // ignore frame errors
        );

        if (mounted) setScannerState({ status: "scanning" });
      } catch (err: any) {
        if (!mounted) return;
        if (err?.message?.includes("Permission") || err?.name === "NotAllowedError") {
          setScannerState({
            status: "error",
            message: "Permissão de câmera negada. Permita o acesso à câmera e tente novamente.",
          });
        } else {
          setScannerState({
            status: "error",
            message: "Não foi possível iniciar a câmera. Tente outra opção abaixo.",
          });
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
      setScannerState({ status: "loading" });
    }
  }, [tab]);

  const handleAddSingle = async (account: ImportedAccount) => {
    await addMutation.mutateAsync({ name: account.name, secret: account.secret, issuer: account.issuer });
    utils.totp.list.invalidate();
    onAdded();
  };

  const handleAddMultiple = async () => {
    if (scannerState.status !== "scanned_multiple") return;
    const toAdd = scannerState.accounts.filter((_, i) => selectedAccounts.has(i));
    if (toAdd.length === 0) { toast.error("Selecione ao menos uma conta."); return; }
    let added = 0;
    for (const account of toAdd) {
      try {
        await addMutation.mutateAsync({ name: account.name, secret: account.secret, issuer: account.issuer });
        added++;
      } catch { /* continua */ }
    }
    utils.totp.list.invalidate();
    toast.success(`${added} conta${added !== 1 ? "s" : ""} importada${added !== 1 ? "s" : ""}!`);
    onAdded();
  };

  const handleAddManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim() || !manualSecret.trim()) return;
    await addMutation.mutateAsync({ name: manualName.trim(), secret: manualSecret.trim(), issuer: manualIssuer.trim() || undefined });
    utils.totp.list.invalidate();
    onAdded();
  };

  const handlePasteUri = () => {
    setPasteError("");
    const uri = pasteUri.trim();
    if (!uri) { setPasteError("Cole o texto do QR code aqui."); return; }
    const result = parseAnyAuthUri(uri);
    if (!result) {
      setPasteError("Formato não reconhecido. Certifique-se de colar o texto completo que começa com otpauth:// ou otpauth-migration://");
      return;
    }
    setPasteResult(result);
  };

  const handleAddPasteResult = async () => {
    if (!pasteResult) return;
    if ("single" in pasteResult) {
      await addMutation.mutateAsync({ name: pasteResult.single.name, secret: pasteResult.single.secret, issuer: pasteResult.single.issuer });
      utils.totp.list.invalidate();
      onAdded();
    } else {
      let added = 0;
      for (const account of pasteResult.multiple) {
        try {
          await addMutation.mutateAsync({ name: account.name, secret: account.secret, issuer: account.issuer });
          added++;
        } catch { /* continua */ }
      }
      utils.totp.list.invalidate();
      toast.success(`${added} conta${added !== 1 ? "s" : ""} importada${added !== 1 ? "s" : ""}!`);
      onAdded();
    }
  };

  const toggleAccount = (idx: number) => {
    setSelectedAccounts((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const resetScanner = () => {
    setScannerState({ status: "loading" });
    setSelectedAccounts(new Set());
    setLastScannedRaw("");
    setTab("manual");
    setTimeout(() => setTab("qr"), 50);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full sm:max-w-md mx-0 sm:mx-4 bg-card rounded-t-3xl sm:rounded-2xl border border-border/60 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-border/60" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/40 flex-shrink-0">
          <h2 className="text-base font-semibold text-foreground">Adicionar conta 2FA</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex p-3 gap-1.5 flex-shrink-0">
          {(["qr", "paste", "manual"] as Tab[]).map((t) => {
            const labels: Record<Tab, { icon: React.ReactNode; label: string }> = {
              qr: { icon: <Camera className="w-3.5 h-3.5" />, label: "Câmera" },
              paste: { icon: <ClipboardPaste className="w-3.5 h-3.5" />, label: "Colar URI" },
              manual: { icon: <Keyboard className="w-3.5 h-3.5" />, label: "Manual" },
            };
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl text-xs font-medium transition-all duration-200 ${
                  tab === t
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                {labels[t].icon}
                {labels[t].label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="px-5 pb-5 overflow-y-auto flex-1">

          {/* ── QR Scanner Tab ── */}
          {tab === "qr" && (
            <div className="space-y-3">
              {(scannerState.status === "scanning" || scannerState.status === "loading") && (
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <p className="text-xs text-blue-300 font-medium mb-1">📱 Como usar</p>
                  <p className="text-xs text-muted-foreground">
                    No Google Authenticator: <strong>Menu (⋮) → Exportar contas</strong> → selecione as contas → escaneie o QR gerado com esta câmera.
                  </p>
                </div>
              )}

              {scannerState.status === "scanned_single" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                    <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">Conta encontrada!</p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {scannerState.account.issuer ? `${scannerState.account.issuer} — ` : ""}{scannerState.account.name}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Button variant="outline" onClick={resetScanner} className="h-11 rounded-xl border-border/60">Escanear outro</Button>
                    <Button onClick={() => handleAddSingle(scannerState.account)} disabled={addMutation.isPending} className="h-11 rounded-xl" style={{ background: "linear-gradient(135deg, oklch(0.60 0.22 270), oklch(0.55 0.22 300))" }}>
                      {addMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Adicionar"}
                    </Button>
                  </div>
                </div>
              )}

              {scannerState.status === "scanned_multiple" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                    <PackagePlus className="w-5 h-5 text-green-400 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{scannerState.accounts.length} conta{scannerState.accounts.length !== 1 ? "s" : ""} encontrada{scannerState.accounts.length !== 1 ? "s" : ""}!</p>
                      <p className="text-xs text-muted-foreground">Selecione as que deseja importar</p>
                    </div>
                  </div>
                  <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                    {scannerState.accounts.map((acc, i) => (
                      <button key={i} onClick={() => toggleAccount(i)} className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all duration-150 text-left ${selectedAccounts.has(i) ? "bg-primary/10 border-primary/40" : "bg-secondary/30 border-border/40 opacity-60"}`}>
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${selectedAccounts.has(i) ? "bg-primary border-primary" : "border-border/60"}`}>
                          {selectedAccounts.has(i) && <CheckCircle2 className="w-3 h-3 text-primary-foreground" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">{acc.name}</p>
                          {acc.issuer && <p className="text-xs text-muted-foreground truncate">{acc.issuer}</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                    <span>{selectedAccounts.size} selecionada{selectedAccounts.size !== 1 ? "s" : ""}</span>
                    <button onClick={() => { if (selectedAccounts.size === scannerState.accounts.length) setSelectedAccounts(new Set()); else setSelectedAccounts(new Set(scannerState.accounts.map((_, i) => i))); }} className="text-primary hover:underline">
                      {selectedAccounts.size === scannerState.accounts.length ? "Desmarcar todas" : "Selecionar todas"}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Button variant="outline" onClick={resetScanner} className="h-11 rounded-xl border-border/60">Escanear outro</Button>
                    <Button onClick={handleAddMultiple} disabled={addMutation.isPending || selectedAccounts.size === 0} className="h-11 rounded-xl" style={{ background: "linear-gradient(135deg, oklch(0.60 0.22 270), oklch(0.55 0.22 300))" }}>
                      {addMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : `Importar ${selectedAccounts.size}`}
                    </Button>
                  </div>
                </div>
              )}

              {scannerState.status === "error" && (
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20">
                    <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-muted-foreground">{scannerState.message}</p>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">Use a aba <strong>Colar URI</strong> ou <strong>Manual</strong> como alternativa</p>
                </div>
              )}

              {(scannerState.status === "loading" || scannerState.status === "scanning") && (
                <div className="space-y-3">
                  <div className="relative rounded-2xl overflow-hidden bg-black" style={{ minHeight: "260px" }}>
                    <div id={scannerDivId} className="w-full" />
                    {scannerState.status === "loading" && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80">
                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                        <p className="text-sm text-muted-foreground">Iniciando câmera...</p>
                      </div>
                    )}
                  </div>
                  {/* Debug: mostrar o que foi lido */}
                  {lastScannedRaw && (
                    <div className="p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                      <p className="text-xs text-yellow-300 font-medium mb-1">QR lido (formato não reconhecido):</p>
                      <p className="text-xs text-muted-foreground font-mono break-all">{lastScannedRaw.slice(0, 120)}{lastScannedRaw.length > 120 ? "..." : ""}</p>
                      <button
                        className="text-xs text-primary hover:underline mt-1"
                        onClick={() => { setPasteUri(lastScannedRaw); setTab("paste"); }}
                      >
                        Tentar processar manualmente →
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Colar URI Tab ── */}
          {tab === "paste" && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <p className="text-xs text-blue-300 font-medium mb-1">📋 Como usar esta opção</p>
                <p className="text-xs text-muted-foreground">
                  Use um app leitor de QR no celular para ler o QR code do Google Authenticator. O texto começa com <code className="text-blue-300">otpauth-migration://</code>. Copie e cole aqui.
                </p>
              </div>

              {!pasteResult ? (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm text-muted-foreground">Cole o texto do QR code</Label>
                    <Textarea
                      placeholder="otpauth-migration://offline?data=... ou otpauth://totp/..."
                      value={pasteUri}
                      onChange={(e) => { setPasteUri(e.target.value); setPasteError(""); }}
                      className="min-h-[100px] bg-secondary/40 border-border/50 rounded-xl focus:border-primary/50 font-mono text-xs"
                      autoFocus
                    />
                    {pasteError && (
                      <p className="text-xs text-destructive">{pasteError}</p>
                    )}
                  </div>
                  <Button
                    onClick={handlePasteUri}
                    disabled={!pasteUri.trim()}
                    className="w-full h-11 rounded-xl"
                    style={{ background: "linear-gradient(135deg, oklch(0.60 0.22 270), oklch(0.55 0.22 300))" }}
                  >
                    Processar
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {"single" in pasteResult ? (
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                      <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">Conta encontrada!</p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {pasteResult.single.issuer ? `${pasteResult.single.issuer} — ` : ""}{pasteResult.single.name}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                      <PackagePlus className="w-5 h-5 text-green-400 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-foreground">{pasteResult.multiple.length} conta{pasteResult.multiple.length !== 1 ? "s" : ""} encontrada{pasteResult.multiple.length !== 1 ? "s" : ""}!</p>
                        <p className="text-xs text-muted-foreground">Todas serão importadas</p>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <Button variant="outline" onClick={() => setPasteResult(null)} className="h-11 rounded-xl border-border/60">Voltar</Button>
                    <Button onClick={handleAddPasteResult} disabled={addMutation.isPending} className="h-11 rounded-xl" style={{ background: "linear-gradient(135deg, oklch(0.60 0.22 270), oklch(0.55 0.22 300))" }}>
                      {addMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Importar"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Manual Tab ── */}
          {tab === "manual" && (
            <form onSubmit={handleAddManual} className="space-y-4">
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <p className="text-xs text-amber-300 font-medium mb-1">💡 Como obter a chave secreta</p>
                <p className="text-xs text-muted-foreground">
                  Acesse o site → Segurança → Autenticação de dois fatores → Desative e reative. Na tela de configuração, o site mostrará a chave secreta em texto (Base32).
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="manual-name" className="text-sm text-muted-foreground">Nome da conta *</Label>
                <Input id="manual-name" placeholder="Ex: meu@email.com" value={manualName} onChange={(e) => setManualName(e.target.value)} className="h-11 bg-secondary/40 border-border/50 rounded-xl focus:border-primary/50" required autoFocus />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="manual-issuer" className="text-sm text-muted-foreground">Serviço (opcional)</Label>
                <Input id="manual-issuer" placeholder="Ex: Google, GitHub, AWS..." value={manualIssuer} onChange={(e) => setManualIssuer(e.target.value)} className="h-11 bg-secondary/40 border-border/50 rounded-xl focus:border-primary/50" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="manual-secret" className="text-sm text-muted-foreground">Chave secreta *</Label>
                <Input id="manual-secret" placeholder="Ex: JBSWY3DPEHPK3PXP" value={manualSecret} onChange={(e) => setManualSecret(e.target.value)} className="h-11 bg-secondary/40 border-border/50 rounded-xl focus:border-primary/50 font-mono text-sm tracking-wider" required />
                <p className="text-xs text-muted-foreground/60">Chave Base32 fornecida pelo serviço (sem espaços)</p>
              </div>

              <Button type="submit" disabled={addMutation.isPending || !manualName.trim() || !manualSecret.trim()} className="w-full h-11 rounded-xl font-medium" style={{ background: "linear-gradient(135deg, oklch(0.60 0.22 270), oklch(0.55 0.22 300))", boxShadow: "0 4px 16px oklch(0.60 0.22 270 / 0.25)" }}>
                {addMutation.isPending ? <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Adicionando...</span> : "Adicionar conta"}
              </Button>
            </form>
          )}
        </div>
      </div>

      <style>{`
        #qr-reader-container video { width: 100% !important; border-radius: 0 !important; object-fit: cover; }
        #qr-reader-container img[alt="Info icon"] { display: none !important; }
        #qr-reader-container > div:last-child { display: none !important; }
        #qr-reader-container__scan_region { border: none !important; }
        #qr-reader-container__scan_region > img { display: none !important; }
        #qr-reader-container__dashboard { display: none !important; }
      `}</style>
    </div>
  );
}
