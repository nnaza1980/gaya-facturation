// ============================================================
// Moteur de calcul Gaya — répartition entrée/sortie & rémunération
// ============================================================

export type Parametres = {
  seuil_1_jours: number;
  seuil_2_jours: number;
  part_entree_moins_1m: number;
  part_entree_1_3m: number;
  part_entree_plus_3m: number;
  taux_gestion: number;
};

// Nombre de jours entre prise de mandat et prise d'offre
export function ancienneteJours(datePriseMandat: string, datePriseOffre: string): number {
  const d1 = new Date(datePriseMandat);
  const d2 = new Date(datePriseOffre);
  return Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

// Clé de répartition standard (1 entrée + 1 sortie) selon l'ancienneté
export function cleRepartitionStandard(
  jours: number,
  p: Parametres
): { partEntree: number; partSortie: number } {
  let partEntree: number;
  if (jours < p.seuil_1_jours) partEntree = p.part_entree_moins_1m;
  else if (jours <= p.seuil_2_jours) partEntree = p.part_entree_1_3m;
  else partEntree = p.part_entree_plus_3m;
  return { partEntree, partSortie: 1 - partEntree };
}

// Libellé lisible de la tranche
export function libelleTranche(jours: number, p: Parametres): string {
  if (jours < p.seuil_1_jours) return `< 1 mois (${Math.round(p.part_entree_moins_1m * 100)}/${Math.round((1 - p.part_entree_moins_1m) * 100)})`;
  if (jours <= p.seuil_2_jours) return `1 à 3 mois (${Math.round(p.part_entree_1_3m * 100)}/${Math.round((1 - p.part_entree_1_3m) * 100)})`;
  return `> 3 mois (${Math.round(p.part_entree_plus_3m * 100)}/${Math.round((1 - p.part_entree_plus_3m) * 100)})`;
}

// Montant dû à un négociateur : CA total × sa part × son taux individuel
export function montantNegociateur(caTotal: number, part: number, tauxIndiv: number): number {
  return Math.round(caTotal * part * tauxIndiv * 100) / 100;
}

// Commission de gestion : honoraires encaissés × taux (15%)
export function commissionGestion(honorairesEncaisses: number, taux: number): number {
  return Math.round(honorairesEncaisses * taux * 100) / 100;
}

// Contrôle : la somme des parts fait-elle 100% ?
export function partsValides(parts: number[]): boolean {
  const total = parts.reduce((a, b) => a + b, 0);
  return Math.abs(total - 1) < 0.0001;
}

export function formatEuros(n: number): string {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " €";
}
