"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { formatEuros } from "@/lib/calculs";

type Row = {
  agent_id: string; prenom: string; nom: string;
  activite: string; statut: string;
  date_acte_ou_bail: string | null; date_prise_offre: string | null;
  ca_part: number;
};
type Agg = { agent_id: string; nom: string; acte: number; compromis: number };

type Periode = "mois" | "annee";
type ActiviteFiltre = "global" | "transaction" | "location";

function debutMois(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function debutAnnee(d: Date) { return new Date(d.getFullYear(), 0, 1); }
function isoDate(d: Date) { return d.toISOString().slice(0, 10); }

export default function Leaderboard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [periode, setPeriode] = useState<Periode>("annee");
  const [activite, setActivite] = useState<ActiviteFiltre>("global");

  const charger = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase.from("v_leaderboard").select("*");
    setRows((data as Row[]) || []);
    setLoading(false);
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const now = new Date();
  const debut = periode === "mois" ? debutMois(now) : debutAnnee(now);
  const debutISO = isoDate(debut);
  const finISO = periode === "mois"
    ? isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 1))
    : isoDate(new Date(now.getFullYear() + 1, 0, 1));

  function dansPeriode(dateStr: string | null) {
    if (!dateStr) return false;
    return dateStr >= debutISO && dateStr < finISO;
  }

  const agg: Record<string, Agg> = {};
  rows.forEach((r) => {
    if (activite !== "global" && r.activite !== activite) return;
    if (!agg[r.agent_id]) agg[r.agent_id] = { agent_id: r.agent_id, nom: `${r.prenom} ${r.nom}`, acte: 0, compromis: 0 };

    const estActe = r.statut === "acte" || r.statut === "bail_signe";
    if (estActe && dansPeriode(r.date_acte_ou_bail)) {
      agg[r.agent_id].acte += r.ca_part;
    } else if (r.statut === "compromis" && dansPeriode(r.date_prise_offre)) {
      agg[r.agent_id].compromis += r.ca_part;
    }
  });

  const classement = Object.values(agg)
    .filter((a) => a.acte > 0 || a.compromis > 0)
    .sort((a, b) => b.acte - a.acte);

  const maxActe = Math.max(1, ...classement.map((c) => c.acte));
  const medailles = ["🥇", "🥈", "🥉"];

  return (
    <div>
      <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 30, fontWeight: 600, marginBottom: 6 }}>
        Classement des agents
      </h1>
      <p style={{ color: "var(--muted)", marginBottom: 24 }}>
        Chiffre d&apos;affaires généré pour Gaya. Acté = encaissé ; compromis = signé, en cours.
      </p>

      <div style={{ display: "flex", gap: 24, marginBottom: 26, flexWrap: "wrap" }}>
        <Segmented
          label="Période"
          value={periode}
          options={[{ v: "mois", l: "Mois en cours" }, { v: "annee", l: "Cumul annuel" }]}
          onChange={(v) => setPeriode(v as Periode)}
        />
        <Segmented
          label="Activité"
          value={activite}
          options={[{ v: "global", l: "Global" }, { v: "transaction", l: "Vente" }, { v: "location", l: "Location" }]}
          onChange={(v) => setActivite(v as ActiviteFiltre)}
        />
      </div>

      {loading ? (
        <div className="card" style={{ padding: 28, color: "var(--muted)" }}>Chargement…</div>
      ) : classement.length === 0 ? (
        <div className="card" style={{ padding: 28, color: "var(--muted)" }}>Aucun CA sur cette période.</div>
      ) : (
        <div className="card" style={{ overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "var(--gaya-green-light)" }}>
                <th style={{ textAlign: "left", padding: "12px 14px", fontWeight: 600, color: "var(--gaya-green-dark)", width: 60 }}>#</th>
                <th style={{ textAlign: "left", padding: "12px 14px", fontWeight: 600, color: "var(--gaya-green-dark)" }}>Agent</th>
                <th style={{ textAlign: "right", padding: "12px 14px", fontWeight: 600, color: "var(--gaya-green-dark)" }}>CA acté</th>
                <th style={{ textAlign: "right", padding: "12px 14px", fontWeight: 600, color: "var(--gaya-green-dark)" }}>CA en compromis</th>
              </tr>
            </thead>
            <tbody>
              {classement.map((c, i) => (
                <tr key={c.agent_id} style={{ borderTop: "1px solid var(--line)" }}>
                  <td style={{ padding: "12px 14px", fontSize: 18 }}>{medailles[i] || `${i + 1}`}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ fontWeight: 600, marginBottom: 5 }}>{c.nom}</div>
                    <div style={{ height: 7, background: "var(--gaya-green-light)", borderRadius: 5, overflow: "hidden", maxWidth: 320 }}>
                      <div style={{ height: "100%", width: `${(c.acte / maxActe) * 100}%`, background: "var(--gaya-green)" }} />
                    </div>
                  </td>
                  <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: 700, color: "var(--gaya-green)", fontSize: 15 }}>{formatEuros(c.acte)}</td>
                  <td style={{ padding: "12px 14px", textAlign: "right", color: "var(--muted)" }}>{formatEuros(c.compromis)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Segmented({ label, value, options, onChange }: {
  label: string; value: string; options: { v: string; l: string }[]; onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="label">{label}</div>
      <div style={{ display: "inline-flex", background: "#fff", border: "1px solid var(--line)", borderRadius: 10, padding: 3, gap: 3 }}>
        {options.map((o) => {
          const active = o.v === value;
          return (
            <button key={o.v} onClick={() => onChange(o.v)}
              style={{
                padding: "7px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
                background: active ? "var(--gaya-green)" : "transparent",
                color: active ? "#fff" : "var(--muted)",
              }}>
              {o.l}
            </button>
          );
        })}
      </div>
    </div>
  );
}
