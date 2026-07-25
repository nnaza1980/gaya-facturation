"use client";

import { usePathname } from "next/navigation";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const nav = [
    { href: "/dashboard", label: "Classement" },
    { href: "/dashboard/releve", label: "Relevé de facturation" },
    { href: "/dashboard/nouveau-dossier", label: "Nouveau dossier" },
    { href: "/dashboard/nouveau-mandat", label: "Nouveau mandat gestion" },
    { href: "/dashboard/encaissements", label: "Encaissements gestion" },
    { href: "/dashboard/taux-agents", label: "Taux des agents" },
  ];

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside style={{ width: 240, background: "var(--gaya-green-dark)", color: "#fff", padding: "26px 18px", display: "flex", flexDirection: "column" }}>
        <div style={{ fontFamily: "Fraunces, serif", fontSize: 26, fontWeight: 600, marginBottom: 4 }}>Gaya</div>
        <div style={{ fontSize: 12, opacity: .7, marginBottom: 30 }}>Facturation &amp; performance</div>

        <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {nav.map((n) => {
            const active = pathname === n.href;
            return (
              <a key={n.href} href={n.href}
                style={{
                  padding: "10px 12px", borderRadius: 9, fontSize: 14, fontWeight: 500,
                  background: active ? "rgba(255,255,255,.14)" : "transparent",
                }}>
                {n.label}
              </a>
            );
          })}
        </nav>

        <div style={{ marginTop: "auto", fontSize: 11, opacity: .6 }}>
          Version de démonstration
        </div>
      </aside>

      <main style={{ flex: 1, padding: "32px 40px", maxWidth: 1150 }}>{children}</main>
    </div>
  );
}
