/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — F43: Algoritmo Determinístico de Similaridade de Nomes (Jaro-Winkler + Tokens)
 */

const FOOD_STOPWORDS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'com', 'ao', 'a', 'e', 'em', 'para',
  'porcao', 'combo', 'prato', 'adicional', 'extra', 'individual', 'grande',
  'medio', 'pequeno', 'kg', 'g', 'ml', 'l', 'un', 'lata', 'garrafa'
]);

/**
 * Normaliza strings para comparação determinística:
 * Remove diacríticos, pontuação e stopwords culinárias.
 */
export function normalizeProductName(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ') // substitui pontuação por espaço
    .split(/\s+/)
    .filter(token => token.length > 0 && !FOOD_STOPWORDS.has(token))
    .join(' ')
    .trim();
}

/**
 * Distância de Jaro entre duas sequências de caracteres.
 */
export function calculateJaroDistance(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  if (!s1.length || !s2.length) return 0.0;

  const matchWindow = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
  const s1Matches = new Array(s1.length).fill(false);
  const s2Matches = new Array(s2.length).fill(false);

  let matches = 0;
  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, s2.length);

    for (let j = start; j < end; j++) {
      if (s2Matches[j]) continue;
      if (s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0.0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const m = matches;
  return (m / s1.length + m / s2.length + (m - transpositions / 2) / m) / 3;
}

/**
 * Similaridade de Jaro-Winkler (com bônus de prefixo de até 4 caracteres).
 */
export function calculateJaroWinkler(s1: string, s2: string, prefixScale = 0.1): number {
  const jaro = calculateJaroDistance(s1, s2);
  if (jaro <= 0.7) return jaro;

  let prefixLength = 0;
  const maxPrefix = Math.min(4, Math.min(s1.length, s2.length));
  for (let i = 0; i < maxPrefix; i++) {
    if (s1[i] === s2[i]) prefixLength++;
    else break;
  }

  return jaro + prefixLength * prefixScale * (1 - jaro);
}

/**
 * Coeficiente de Sobreposição de Conjunto de Palavras (Jaccard token set).
 */
export function calculateTokenOverlap(s1: string, s2: string): number {
  const set1 = new Set(s1.split(/\s+/).filter(Boolean));
  const set2 = new Set(s2.split(/\s+/).filter(Boolean));

  if (set1.size === 0 || set2.size === 0) return 0.0;

  let intersection = 0;
  for (const token of set1) {
    if (set2.has(token)) intersection++;
  }

  const union = new Set([...set1, ...set2]).size;
  return union === 0 ? 0.0 : intersection / union;
}

export interface SimilarityMatch {
  targetId: string;
  targetName: string;
  score: number;
  confidenceTier: 'ALTA' | 'MEDIA' | 'BAIXA';
  autoSuggested: boolean;
}

/**
 * F43: Calcula pontuação determinística entre nome externo e lista de fichas técnicas.
 */
export function matchProductToRecipes(
  externalName: string,
  candidates: { id: string; name: string }[]
): SimilarityMatch[] {
  const normSource = normalizeProductName(externalName);
  if (!normSource) return [];

  const results: SimilarityMatch[] = [];

  for (const candidate of candidates) {
    const normTarget = normalizeProductName(candidate.name);
    if (!normTarget) continue;

    // Strings idênticas
    if (normSource === normTarget) {
      results.push({
        targetId: candidate.id,
        targetName: candidate.name,
        score: 1.0,
        confidenceTier: 'ALTA',
        autoSuggested: true,
      });
      continue;
    }

    const jw = calculateJaroWinkler(normSource, normTarget);
    const tokens = calculateTokenOverlap(normSource, normTarget);
    const score = Number((0.6 * jw + 0.4 * tokens).toFixed(4));

    let tier: 'ALTA' | 'MEDIA' | 'BAIXA' = 'BAIXA';
    let autoSuggested = false;

    if (score >= 0.85) {
      tier = 'ALTA';
      autoSuggested = true;
    } else if (score >= 0.60) {
      tier = 'MEDIA';
      autoSuggested = false;
    }

    if (score >= 0.50) {
      results.push({
        targetId: candidate.id,
        targetName: candidate.name,
        score,
        confidenceTier: tier,
        autoSuggested,
      });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}
