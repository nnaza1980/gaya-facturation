"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { formatEuros } from "@/lib/calculs";

type Agent = { id: string; prenom: string; nom: string };

type LigneAction = {
  id: string; agent: string; activite: string; numero_mandat: string;
  vendeur_bailleur: string; acquereur_locataire: string | null; bien: string;
  ca_total: number; part: number; taux: number; montant: number;
};
type LigneGestion = {
  id: string; agent: string; numero_mandat: string; bailleur: string;
  locataire: string | null; bien: string; honoraires: number; taux: number; commission: number;
};

function moisLabel(d: Date) { return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }); }
function premierDuMois(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function isoDate(d: Date) { const m = String(d.getMonth() + 1).padStart(2, "0"); const j = String(d.getDate()).padStart(2, "0"); return `${d.getFullYear()}-${m}-${j}`; }

export default function RelevePage() {
  const [mois, setMois] = useState(() => premierDuMois(new Date()));
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentSel, setAgentSel] = useState<string>("all"); // "all" ou un id
  const [actions, setActions] = useState<LigneAction[]>([]);
  const [gestions, setGestions] = useState<LigneGestion[]>([]);
  const [loading, setLoading] = useState(true);

  // Charger la liste des agents une fois
  useEffect(() => {
    const supabase = createClient();
    supabase.from("agents").select("id, prenom, nom").eq("est_agent", true).order("nom")
      .then(({ data }) => { if (data) setAgents(data as Agent[]); });
  }, []);

  const charger = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const debut = isoDate(mois);
    const finExclue = isoDate(new Date(mois.getFullYear(), mois.getMonth() + 1, 1));

    // Map id -> nom pour affichage
    const nomAgent = (id: string) => {
      const a = agents.find((x) => x.id === id);
      return a ? `${a.prenom} ${a.nom}` : "—";
    };

    // --- Actions ponctuelles ---
    const { data: negos } = await supabase
      .from("dossiers_negociateurs")
      .select("agent_id, part_figee, taux_indiv_fige, dossier:dossiers(id, activite, numero_mandat, nom_vendeur_bailleur, nom_acquereur_locataire, bien_adresse, honoraires_ht, statut, date_acte_ou_bail)");

    const lignesActions: LigneAction[] = [];
    (negos || []).forEach((n: any) => {
      const d = n.dossier; if (!d) return;
      if (agentSel !== "all" && n.agent_id !== agentSel) return;
      const facturable =
        (d.activite === "transaction" && d.statut === "acte") ||
        (d.activite === "location" && d.statut === "bail_signe");
      if (!facturable || !d.date_acte_ou_bail) return;
      if (d.date_acte_ou_bail < debut || d.date_acte_ou_bail >= finExclue) return;
      const caTotal = Number(d.honoraires_ht) || 0;
      const montant = Math.round(caTotal * Number(n.part_figee) * Number(n.taux_indiv_fige) * 100) / 100;
      lignesActions.push({
        id: d.id + n.agent_id, agent: nomAgent(n.agent_id), activite: d.activite,
        numero_mandat: d.numero_mandat, vendeur_bailleur: d.nom_vendeur_bailleur,
        acquereur_locataire: d.nom_acquereur_locataire, bien: d.bien_adresse,
        ca_total: caTotal, part: Number(n.part_figee), taux: Number(n.taux_indiv_fige), montant,
      });
    });

    // --- Gestion ---
    const { data: enc } = await supabase
      .from("encaissements_gestion")
      .select("id, honoraires_encaisses, taux_gestion_fige, periode, mandat:mandats_gestion(numero_mandat, nom_bailleur, nom_locataire, bien_adresse, agent_apporteur_id)")
      .gte("periode", debut).lt("periode", finExclue);

    const lignesGestion: LigneGestion[] = [];
    (enc || []).forEach((e: any) => {
      const m = e.mandat; if (!m) return;
      if (agentSel !== "all" && m.agent_apporteur_id !== agentSel) return;
      const honoraires = Number(e.honoraires_encaisses) || 0;
      const taux = Number(e.taux_gestion_fige);
      lignesGestion.push({
        id: e.id, agent: nomAgent(m.agent_apporteur_id), numero_mandat: m.numero_mandat,
        bailleur: m.nom_bailleur, locataire: m.nom_locataire, bien: m.bien_adresse,
        honoraires, taux, commission: Math.round(honoraires * taux * 100) / 100,
      });
    });

    setActions(lignesActions);
    setGestions(lignesGestion);
    setLoading(false);
  }, [mois, agentSel, agents]);

  useEffect(() => { charger(); }, [charger]);

  const totalActions = actions.reduce((s, a) => s + a.montant, 0);
  const totalGestion = gestions.reduce((s, g) => s + g.commission, 0);
  const totalGeneral = totalActions + totalGestion;
  const vueGlobale = agentSel === "all";

  function exporterCSV() {
    const sep = ";";
    const lignes: string[] = [];
    lignes.push(["Type", "Agent", "N mandat", "Vendeur/Bailleur", "Acquereur/Locataire", "Bien", "CA total / Honoraires", "Part %", "Taux %", "Montant"].join(sep));
    actions.forEach((a) => lignes.push([
      a.activite === "transaction" ? "Vente" : "Location", a.agent, a.numero_mandat,
      a.vendeur_bailleur, a.acquereur_locataire || "", a.bien,
      String(a.ca_total), String(Math.round(a.part * 100)), String(Math.round(a.taux * 100)), String(a.montant),
    ].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(sep)));
    gestions.forEach((g) => lignes.push([
      "Gestion", g.agent, g.numero_mandat, g.bailleur, g.locataire || "", g.bien,
      String(g.honoraires), "", String(Math.round(g.taux * 100)), String(g.commission),
    ].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(sep)));
    lignes.push("");
    lignes.push(["TOTAL", "", "", "", "", "", "", "", "", String(totalGeneral)].map((c) => `"${c}"`).join(sep));
    const csv = "\uFEFF" + lignes.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const nomAgent = vueGlobale ? "tous-agents" : (agents.find((a) => a.id === agentSel)?.nom || "agent").replace(/\s+/g, "-");
    link.href = url;
    link.download = `releve-gaya-${nomAgent}-${moisLabel(mois).replace(/\s+/g, "-")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }


  return (
    <div>
      <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 30, fontWeight: 600, marginBottom: 6 }}>
        Relevé de facturation
      </h1>
      <p style={{ color: "var(--muted)", marginBottom: 24 }}>
        Le détail à reporter sur la facture, pour l&apos;agent et le mois choisis.
      </p>

      <div style={{ marginBottom: 20 }}>
        <button className="btn btn-primary" onClick={exporterCSV} disabled={actions.length === 0 && gestions.length === 0}>
          ⬇ Exporter en Excel (CSV)
        </button>
      </div>

      {/* Sélecteurs */}
      <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 26, flexWrap: "wrap" }}>
        <div>
          <label className="label">Agent</label>
          <select className="input" style={{ minWidth: 220 }} value={agentSel} onChange={(e) => setAgentSel(e.target.value)}>
            <option value="all">Tous les agents (vue admin)</option>
            {agents.map((a) => <option key={a.id} value={a.id}>{a.prenom} {a.nom}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Mois</label>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button className="btn btn-ghost" onClick={() => setMois((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>←</button>
            <div style={{ fontWeight: 600, minWidth: 130, textAlign: "center", textTransform: "capitalize" }}>{moisLabel(mois)}</div>
            <button className="btn btn-ghost" onClick={() => setMois((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>→</button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ padding: 28, color: "var(--muted)" }}>Chargement…</div>
      ) : (
        <>
          <Section titre="Actions du mois — transactions actées &amp; baux signés">
            {actions.length === 0 ? <Vide texte="Aucune transaction actée ni bail signé ce mois-ci." /> : (
              <Table
                cols={[...(vueGlobale ? ["Agent"] : []), "N° mandat", "Type", "Vendeur / Bailleur", "Acquéreur / Locataire", "Bien", "CA total", "Part", "Taux", "Montant"]}
                rows={actions.map((a) => [
                  ...(vueGlobale ? [a.agent] : []),
                  a.numero_mandat, a.activite === "transaction" ? "Vente" : "Location",
                  a.vendeur_bailleur, a.acquereur_locataire || "—", a.bien,
                  formatEuros(a.ca_total), Math.round(a.part * 100) + " %", Math.round(a.taux * 100) + " %", formatEuros(a.montant),
                ])}
                totalLabel="Total actions ponctuelles" totalValue={formatEuros(totalActions)} nRight={4}
              />
            )}
          </Section>

          <Section titre="Commissions de gestion récurrentes du mois">
            {gestions.length === 0 ? <Vide texte="Aucun encaissement de gestion ce mois-ci." /> : (
              <Table
                cols={[...(vueGlobale ? ["Agent"] : []), "N° mandat", "Bailleur", "Locataire", "Bien", "Honoraires gestion", "Taux", "Commission"]}
                rows={gestions.map((g) => [
                  ...(vueGlobale ? [g.agent] : []),
                  g.numero_mandat, g.bailleur, g.locataire || "—", g.bien,
                  formatEuros(g.honoraires), Math.round(g.taux * 100) + " %", formatEuros(g.commission),
                ])}
                totalLabel="Total commissions de gestion" totalValue={formatEuros(totalGestion)} nRight={3}
              />
            )}
          </Section>

          <div style={{ background: "var(--gaya-green)", color: "#fff", borderRadius: "var(--radius)", padding: "20px 26px", display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>
              {vueGlobale ? "Total à facturer — tous agents" : "Total à facturer ce mois-ci"}
            </div>
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 26, fontWeight: 600 }}>{formatEuros(totalGeneral)}</div>
          </div>
        </>
      )}
    </div>
  );
}

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 26 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--gaya-green-dark)", marginBottom: 10 }} dangerouslySetInnerHTML={{ __html: titre }} />
      {children}
    </div>
  );
}
function Vide({ texte }: { texte: string }) {
  return <div className="card" style={{ padding: 20, color: "var(--muted)", fontSize: 14 }}>{texte}</div>;
}
function Table({ cols, rows, totalLabel, totalValue, nRight }: {
  cols: string[]; rows: string[][]; totalLabel: string; totalValue: string; nRight: number;
}) {
  const rightFrom = cols.length - nRight;
  return (
    <div className="card" style={{ overflow: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "var(--gaya-green-light)" }}>
            {cols.map((c, i) => (
              <th key={i} style={{ textAlign: i >= rightFrom ? "right" : "left", padding: "10px 12px", fontWeight: 600, color: "var(--gaya-green-dark)", whiteSpace: "nowrap" }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} style={{ borderTop: "1px solid var(--line)" }}>
              {r.map((cell, ci) => (
                <td key={ci} style={{ textAlign: ci >= rightFrom ? "right" : "left", padding: "9px 12px", whiteSpace: "nowrap" }}>{cell}</td>
              ))}
            </tr>
          ))}
          <tr style={{ borderTop: "2px solid var(--gaya-green)", background: "#fafcfb" }}>
            <td colSpan={cols.length - 1} style={{ padding: "11px 12px", fontWeight: 600 }}>{totalLabel}</td>
            <td style={{ padding: "11px 12px", textAlign: "right", fontWeight: 700, color: "var(--gaya-green)" }}>{totalValue}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
