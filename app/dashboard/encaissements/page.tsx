"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { formatEuros } from "@/lib/calculs";

type Mandat = {
  id: string; numero_mandat: string; nom_bailleur: string; nom_locataire: string | null;
  bien_adresse: string; agent_apporteur_id: string; honoraires_gestion_mensuels: number;
  agent?: { prenom: string; nom: string } | null;
};
type Encaissement = { id: string; mandat_id: string; periode: string; honoraires_encaisses: number; taux_gestion_fige: number };

function moisLabel(d: Date) { return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }); }
function premierDuMois(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function isoDate(d: Date) { return d.toISOString().slice(0, 10); }

export default function EncaissementsPage() {
  const [mois, setMois] = useState(() => premierDuMois(new Date()));
  const [mandats, setMandats] = useState<Mandat[]>([]);
  const [dejaSaisi, setDejaSaisi] = useState<Record<string, Encaissement>>({});
  const [tauxGestion, setTauxGestion] = useState(0.15);
  const [saisie, setSaisie] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const charger = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const debut = isoDate(mois);

    const { data: params } = await supabase.from("parametres").select("taux_gestion").eq("id", 1).single();
    if (params) setTauxGestion(Number(params.taux_gestion));

    // Agents (pour afficher le nom de l'apporteur)
    const { data: ag } = await supabase.from("agents").select("id, prenom, nom");
    const agentsMap: Record<string, { prenom: string; nom: string }> = {};
    (ag || []).forEach((a: any) => { agentsMap[a.id] = { prenom: a.prenom, nom: a.nom }; });

    // Mandats actifs (activés à/avant la fin de ce mois)
    const finMois = isoDate(new Date(mois.getFullYear(), mois.getMonth() + 1, 0));
    const { data: m } = await supabase
      .from("mandats_gestion")
      .select("id, numero_mandat, nom_bailleur, nom_locataire, bien_adresse, agent_apporteur_id, honoraires_gestion_mensuels, date_activation")
      .lte("date_activation", finMois);
    const mandatsActifs: Mandat[] = ((m as any[]) || []).map((md) => ({
      ...md,
      agent: agentsMap[md.agent_apporteur_id] || null,
    }));
    setMandats(mandatsActifs);

    // Encaissements déjà saisis pour ce mois
    const { data: enc } = await supabase
      .from("encaissements_gestion")
      .select("id, mandat_id, periode, honoraires_encaisses, taux_gestion_fige")
      .eq("periode", debut);
    const map: Record<string, Encaissement> = {};
    const pre: Record<string, string> = {};
    (enc as Encaissement[] | null)?.forEach((e) => {
      map[e.mandat_id] = e;
      pre[e.mandat_id] = String(e.honoraires_encaisses);
    });
    setDejaSaisi(map);
    // pré-remplir avec les honoraires théoriques du mandat si pas déjà saisi
    mandatsActifs.forEach((md) => {
      if (!pre[md.id]) pre[md.id] = String(md.honoraires_gestion_mensuels);
    });
    setSaisie(pre);
    setLoading(false);
  }, [mois]);

  useEffect(() => { charger(); }, [charger]);

  async function enregistrer() {
    setMsg("");
    setSaving(true);
    const supabase = createClient();
    const debut = isoDate(mois);
    const lignes = mandats
      .filter((md) => !dejaSaisi[md.id]) // ne réinsère pas ceux déjà saisis
      .map((md) => ({
        mandat_id: md.id,
        periode: debut,
        honoraires_encaisses: Number(saisie[md.id]) || 0,
        taux_gestion_fige: tauxGestion,
      }))
      .filter((l) => l.honoraires_encaisses > 0);

    if (lignes.length === 0) {
      setSaving(false);
      setMsg("Rien de nouveau à enregistrer (tout est déjà saisi ou à zéro).");
      return;
    }
    const { error } = await supabase.from("encaissements_gestion").insert(lignes);
    setSaving(false);
    if (error) { setMsg("Erreur : " + error.message); return; }
    setMsg(`✅ ${lignes.length} encaissement(s) enregistré(s) pour ${moisLabel(mois)}.`);
    charger();
  }

  const totalHonoraires = mandats.reduce((s, md) => s + (Number(saisie[md.id]) || 0), 0);
  const totalCommissions = Math.round(totalHonoraires * tauxGestion * 100) / 100;

  return (
    <div style={{ maxWidth: 960 }}>
      <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 30, fontWeight: 600, marginBottom: 6 }}>Encaissements de gestion</h1>
      <p style={{ color: "var(--muted)", marginBottom: 24 }}>
        Saisie mensuelle des honoraires de gestion réellement encaissés. Déclenche les commissions récurrentes des agents.
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
        <button className="btn btn-ghost" onClick={() => setMois((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>←</button>
        <div style={{ fontWeight: 600, minWidth: 150, textAlign: "center", textTransform: "capitalize" }}>{moisLabel(mois)}</div>
        <button className="btn btn-ghost" onClick={() => setMois((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>→</button>
      </div>

      {loading ? (
        <div className="card" style={{ padding: 28, color: "var(--muted)" }}>Chargement…</div>
      ) : mandats.length === 0 ? (
        <div className="card" style={{ padding: 28, color: "var(--muted)" }}>Aucun mandat de gestion actif sur ce mois.</div>
      ) : (
        <>
          <div className="card" style={{ overflow: "auto", marginBottom: 20 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--gaya-green-light)" }}>
                  <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 600, color: "var(--gaya-green-dark)" }}>N° mandat</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 600, color: "var(--gaya-green-dark)" }}>Agent</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 600, color: "var(--gaya-green-dark)" }}>Bien</th>
                  <th style={{ textAlign: "right", padding: "10px 12px", fontWeight: 600, color: "var(--gaya-green-dark)" }}>Honoraires encaissés (€)</th>
                  <th style={{ textAlign: "right", padding: "10px 12px", fontWeight: 600, color: "var(--gaya-green-dark)" }}>Commission ({Math.round(tauxGestion * 100)}%)</th>
                  <th style={{ textAlign: "center", padding: "10px 12px", fontWeight: 600, color: "var(--gaya-green-dark)" }}>Statut</th>
                </tr>
              </thead>
              <tbody>
                {mandats.map((md) => {
                  const val = Number(saisie[md.id]) || 0;
                  const comm = Math.round(val * tauxGestion * 100) / 100;
                  const locked = !!dejaSaisi[md.id];
                  return (
                    <tr key={md.id} style={{ borderTop: "1px solid var(--line)" }}>
                      <td style={{ padding: "10px 12px", fontWeight: 600 }}>{md.numero_mandat}</td>
                      <td style={{ padding: "10px 12px" }}>{md.agent ? `${md.agent.prenom} ${md.agent.nom}` : "—"}</td>
                      <td style={{ padding: "10px 12px", color: "var(--muted)" }}>{md.bien_adresse}</td>
                      <td style={{ padding: "8px 12px", textAlign: "right" }}>
                        <input type="number" className="input" style={{ width: 120, textAlign: "right", padding: "7px 9px" }}
                          value={saisie[md.id] ?? ""} disabled={locked}
                          onChange={(e) => setSaisie((s) => ({ ...s, [md.id]: e.target.value }))} />
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: "var(--gaya-green)" }}>{formatEuros(comm)}</td>
                      <td style={{ padding: "10px 12px", textAlign: "center" }}>
                        {locked
                          ? <span style={{ fontSize: 12, color: "var(--gaya-green)", fontWeight: 600 }}>✓ enregistré</span>
                          : <span style={{ fontSize: 12, color: "var(--muted)" }}>à saisir</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "2px solid var(--gaya-green)", background: "#fafcfb" }}>
                  <td colSpan={3} style={{ padding: "11px 12px", fontWeight: 600 }}>Total du mois</td>
                  <td style={{ padding: "11px 12px", textAlign: "right", fontWeight: 700 }}>{formatEuros(totalHonoraires)}</td>
                  <td style={{ padding: "11px 12px", textAlign: "right", fontWeight: 700, color: "var(--gaya-green)" }}>{formatEuros(totalCommissions)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {msg && (
            <div style={{ background: msg.startsWith("✅") ? "var(--gaya-green-light)" : "#fbeae9", color: msg.startsWith("✅") ? "var(--gaya-green-dark)" : "var(--danger)", padding: "12px 14px", borderRadius: 10, fontSize: 14, marginBottom: 16 }}>
              {msg}
            </div>
          )}

          <button onClick={enregistrer} className="btn btn-primary" disabled={saving} style={{ fontSize: 15, padding: "12px 24px" }}>
            {saving ? "Enregistrement…" : "Enregistrer les encaissements du mois"}
          </button>
        </>
      )}
    </div>
  );
}
