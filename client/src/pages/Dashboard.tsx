import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Plus, LogOut, ShieldCheck, Search, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import TotpCard from "@/components/TotpCard";
import AddAccountModal from "@/components/AddAccountModal";

interface DashboardProps {
  onLogout: () => void;
}

export default function Dashboard({ onLogout }: DashboardProps) {
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  const logoutMutation = trpc.appAuth.logout.useMutation({
    onSuccess: () => onLogout(),
  });

  const { data: accounts = [], isLoading, refetch } = trpc.totp.list.useQuery(undefined, {
    refetchInterval: 30000,
    refetchIntervalInBackground: true,
  });

  const utils = trpc.useUtils();

  const handleRemove = (id: number) => {
    utils.totp.list.setData(undefined, (prev) =>
      prev ? prev.filter((a) => a.id !== id) : prev
    );
  };

  const filtered = accounts.filter((acc) => {
    const q = search.toLowerCase();
    return (
      acc.name.toLowerCase().includes(q) ||
      (acc.issuer?.toLowerCase().includes(q) ?? false)
    );
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="container">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shadow-md"
                style={{
                  background: "linear-gradient(135deg, oklch(0.60 0.22 270), oklch(0.55 0.22 300))",
                }}
              >
                <ShieldCheck className="w-4 h-4 text-white" strokeWidth={1.5} />
              </div>
              <div>
                <h1 className="text-sm font-semibold text-foreground leading-none">
                  Autenticador 2FA
                </h1>
                <p className="text-xs text-muted-foreground leading-none mt-0.5">
                  {accounts.length} {accounts.length === 1 ? "conta" : "contas"}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => refetch()}
                className="w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground"
                title="Atualizar"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => logoutMutation.mutate()}
                className="w-8 h-8 rounded-lg text-muted-foreground hover:text-destructive"
                title="Sair"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container py-6">
        {/* Search + Add */}
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
            <Input
              placeholder="Buscar conta..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10 bg-secondary/40 border-border/50 rounded-xl text-sm focus:border-primary/50"
            />
          </div>
          <Button
            onClick={() => setShowAddModal(true)}
            className="h-10 px-4 rounded-xl font-medium gap-2 flex-shrink-0"
            style={{
              background: "linear-gradient(135deg, oklch(0.60 0.22 270), oklch(0.55 0.22 300))",
              boxShadow: "0 4px 16px oklch(0.60 0.22 270 / 0.25)",
            }}
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Adicionar</span>
          </Button>
        </div>

        {/* Accounts grid */}
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="glass-card rounded-2xl p-5 animate-pulse"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-border/30" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-border/30 rounded w-24" />
                    <div className="h-6 bg-border/30 rounded w-32" />
                  </div>
                  <div className="w-9 h-9 rounded-full bg-border/30" />
                </div>
                <div className="mt-4 h-0.5 bg-border/30 rounded-full" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            {search ? (
              <>
                <div className="w-14 h-14 rounded-2xl bg-secondary/50 flex items-center justify-center mb-4">
                  <Search className="w-6 h-6 text-muted-foreground/50" />
                </div>
                <p className="text-foreground font-medium">Nenhuma conta encontrada</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Tente buscar por outro nome
                </p>
              </>
            ) : (
              <>
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-lg"
                  style={{
                    background: "linear-gradient(135deg, oklch(0.60 0.22 270 / 0.2), oklch(0.55 0.22 300 / 0.2))",
                    border: "1px solid oklch(0.60 0.22 270 / 0.2)",
                  }}
                >
                  <ShieldCheck className="w-7 h-7 text-primary/60" strokeWidth={1.5} />
                </div>
                <p className="text-foreground font-medium">Nenhuma conta cadastrada</p>
                <p className="text-sm text-muted-foreground mt-1 mb-5">
                  Adicione suas contas 2FA para começar
                </p>
                <Button
                  onClick={() => setShowAddModal(true)}
                  className="h-10 px-5 rounded-xl font-medium gap-2"
                  style={{
                    background: "linear-gradient(135deg, oklch(0.60 0.22 270), oklch(0.55 0.22 300))",
                  }}
                >
                  <Plus className="w-4 h-4" />
                  Adicionar primeira conta
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((account) => (
              <TotpCard
                key={account.id}
                account={account}
                onRemove={handleRemove}
              />
            ))}
          </div>
        )}
      </main>

      {/* Add Account Modal */}
      {showAddModal && (
        <AddAccountModal
          onClose={() => setShowAddModal(false)}
          onAdded={() => {
            setShowAddModal(false);
            utils.totp.list.invalidate();
            toast.success("Conta adicionada com sucesso!");
          }}
        />
      )}
    </div>
  );
}
