/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — Simulador de Custos e Sensibilidade (F01, F02, F03, F07)
 */

import React, { useState, useMemo } from 'react';
import { Calculator, TrendingUp, AlertTriangle, ArrowRight, ShieldCheck, Percent, HelpCircle } from 'lucide-react';
import { Ingredient, Recipe } from '../domain/types';
import {
  simulateIngredientPriceChange,
  calculateSensitivityRanking,
  calculateMarginReadjustment,
  calculateKitchenInflationLaspeyres,
} from '../domain/cost-simulator';
import { formatCentsToCurrency, formatBaseQuantity } from '../domain/units';
import { Modal } from './Modal';
import { ExplanationModal, HowWeCalculatedButton } from './ExplanationModal';

interface CostSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  ingredients: Ingredient[];
  recipes: Recipe[];
  monthlySalesVolume: Record<string, number>;
  initialIngredientId?: string;
}

export const CostSimulatorModal: React.FC<CostSimulatorModalProps> = ({
  isOpen,
  onClose,
  ingredients,
  recipes,
  monthlySalesVolume,
  initialIngredientId,
}) => {
  const [activeTab, setActiveTab] = useState<'F01_SIMULATOR' | 'F02_SENSITIVITY' | 'F03_MARGIN' | 'F07_INFLATION'>('F01_SIMULATOR');

  // Estado F01
  const [selectedIngId, setSelectedIngId] = useState<string>(initialIngredientId || ingredients[0]?.id || '');
  const [deltaPercent, setDeltaPercent] = useState<number>(10);

  // Estado F03
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>(recipes[0]?.id || '');
  const [simulatedCostCents, setSimulatedCostCents] = useState<number>(0);
  const [targetMargin, setTargetMargin] = useState<number>(70);

  // Modal explicação
  const [explanationData, setExplanationData] = useState<{ title: string; explanation: any } | null>(null);

  const selectedIng = useMemo(() => ingredients.find((i) => i.id === selectedIngId), [ingredients, selectedIngId]);
  const selectedRecipe = useMemo(() => recipes.find((r) => r.id === selectedRecipeId), [recipes, selectedRecipeId]);

  // F01 Resultado
  const f01Result = useMemo(() => {
    if (!selectedIng) return null;
    const newPriceMicrocents = Math.round(selectedIng.currentUnitCostMicrocents * (1 + deltaPercent / 100));
    try {
      return simulateIngredientPriceChange(selectedIng.id, newPriceMicrocents, ingredients, recipes, monthlySalesVolume);
    } catch (e: any) {
      return null;
    }
  }, [selectedIng, deltaPercent, ingredients, recipes, monthlySalesVolume]);

  // F02 Resultado
  const f02Ranking = useMemo(() => {
    try {
      return calculateSensitivityRanking(ingredients, recipes, monthlySalesVolume);
    } catch {
      return null;
    }
  }, [ingredients, recipes, monthlySalesVolume]);

  // F03 Resultado
  const f03Result = useMemo(() => {
    if (!selectedRecipe) return null;
    const cost = simulatedCostCents > 0 ? simulatedCostCents : Math.round(selectedRecipe.salePriceInCents * 0.35);
    try {
      return calculateMarginReadjustment(selectedRecipe, Math.round(selectedRecipe.salePriceInCents * 0.30), cost, targetMargin);
    } catch {
      return null;
    }
  }, [selectedRecipe, simulatedCostCents, targetMargin]);

  // F07 Resultado
  const f07Result = useMemo(() => {
    const basket = ingredients.map((ing) => ({
      ingredientId: ing.id,
      ingredientName: ing.name,
      baseUnitQuantityQ0: 1000,
      basePriceP0Microcents: ing.currentUnitCostMicrocents,
      currentPriceP1Microcents: ing.currentUnitCostMicrocents,
    }));
    return calculateKitchenInflationLaspeyres(basket, 0, f02Ranking?.totalTheoreticalCmvInCents || 0);
  }, [ingredients, f02Ranking]);

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Inteligência de Custos e Preços" maxWidth="3xl">
      <div className="space-y-5">
        {/* Sub-Tabs */}
        <div className="flex border-b border-stone-200 gap-1 overflow-x-auto text-xs font-semibold">
          <button
            onClick={() => setActiveTab('F01_SIMULATOR')}
            className={`pb-2.5 px-3 border-b-2 cursor-pointer transition-colors ${
              activeTab === 'F01_SIMULATOR'
                ? 'border-stone-900 text-stone-900'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            F01 · Simulador "E se?"
          </button>
          <button
            onClick={() => setActiveTab('F02_SENSITIVITY')}
            className={`pb-2.5 px-3 border-b-2 cursor-pointer transition-colors ${
              activeTab === 'F02_SENSITIVITY'
                ? 'border-stone-900 text-stone-900'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            F02 · Quem manda no lucro
          </button>
          <button
            onClick={() => setActiveTab('F03_MARGIN')}
            className={`pb-2.5 px-3 border-b-2 cursor-pointer transition-colors ${
              activeTab === 'F03_MARGIN'
                ? 'border-stone-900 text-stone-900'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            F03 · Reajuste p/ Manter Margem
          </button>
          <button
            onClick={() => setActiveTab('F07_INFLATION')}
            className={`pb-2.5 px-3 border-b-2 cursor-pointer transition-colors ${
              activeTab === 'F07_INFLATION'
                ? 'border-stone-900 text-stone-900'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            F07 · Inflação da Cozinha
          </button>
        </div>

        {/* TAB F01: SIMULADOR E SE */}
        {activeTab === 'F01_SIMULATOR' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-stone-50 p-4 rounded-xl border border-stone-200">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Escolha o Insumo:</label>
                <select
                  value={selectedIngId}
                  onChange={(e) => setSelectedIngId(e.target.value)}
                  className="w-full text-xs bg-white border border-stone-300 rounded-lg p-2 font-medium"
                >
                  {ingredients.map((ing) => (
                    <option key={ing.id} value={ing.id}>
                      {ing.name} ({ing.baseUnit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-stone-700">Variação no Custo:</label>
                  <span className="text-xs font-mono font-bold text-stone-900">
                    {deltaPercent > 0 ? `+${deltaPercent}%` : `${deltaPercent}%`}
                  </span>
                </div>
                <input
                  type="range"
                  min="-30"
                  max="50"
                  step="5"
                  value={deltaPercent}
                  onChange={(e) => setDeltaPercent(Number(e.target.value))}
                  className="w-full accent-stone-900 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-stone-400 mt-0.5">
                  <span>-30%</span>
                  <span>0%</span>
                  <span>+20%</span>
                  <span>+50%</span>
                </div>
              </div>
            </div>

            {f01Result && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-stone-900 text-white flex items-center justify-between">
                  <div>
                    <span className="text-xs text-stone-400 font-medium block">Impacto Total no Lucro Mensal:</span>
                    <span className={`text-2xl font-bold font-mono ${f01Result.deltaMonthlyProfitInCents < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {f01Result.deltaMonthlyProfitInCents < 0 ? '-' : '+'}
                      {formatCentsToCurrency(Math.abs(f01Result.deltaMonthlyProfitInCents))}
                      <span className="text-xs font-normal text-stone-400">/mês</span>
                    </span>
                  </div>
                  <HowWeCalculatedButton
                    onClick={() => setExplanationData({ title: 'Simulador E se (F01)', explanation: f01Result.explanation })}
                    className="text-stone-300 hover:text-white"
                  />
                </div>

                <div>
                  <span className="text-xs font-bold text-stone-700 uppercase tracking-wider block mb-2">
                    Pratos Afetados ({f01Result.affectedRecipes.length})
                  </span>
                  {f01Result.affectedRecipes.length === 0 ? (
                    <p className="text-xs text-stone-500 py-3 text-center bg-stone-50 rounded-lg">
                      Nenhum prato depende deste insumo nas fichas cadastradas.
                    </p>
                  ) : (
                    <div className="max-h-60 overflow-y-auto divide-y divide-stone-100 border border-stone-200 rounded-xl">
                      {f01Result.affectedRecipes.map((item) => (
                        <div key={item.recipeId} className="p-3 flex items-center justify-between text-xs hover:bg-stone-50">
                          <div>
                            <span className="font-semibold text-stone-900 block">{item.recipeName}</span>
                            <span className="text-[11px] text-stone-500">
                              Custo da porção: {formatCentsToCurrency(item.portionCostBeforeInCents)} →{' '}
                              <strong className="text-stone-800">{formatCentsToCurrency(item.portionCostAfterInCents)}</strong>
                              {' '}(+{formatCentsToCurrency(item.costDeltaInCents)})
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="font-mono font-bold text-rose-600 block">
                              -{formatCentsToCurrency(item.monthlyImpactInCents)}/mês
                            </span>
                            <span className="text-[10px] text-stone-400">{item.monthlySalesVolume} vendidas/mês</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB F02: RANKING DE SENSIBILIDADE */}
        {activeTab === 'F02_SENSITIVITY' && f02Ranking && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900">
              <div>
                <span className="text-xs font-bold block uppercase tracking-wider">Regra de Sensibilidade</span>
                <span className="text-xs">
                  Se estes 10 insumos subirem 10%, seu lucro encolhe em{' '}
                  <strong className="font-mono text-sm">{formatCentsToCurrency(f02Ranking.top10RiskInCents)}/mês</strong>.
                </span>
              </div>
              <HowWeCalculatedButton
                onClick={() => setExplanationData({ title: 'Ranking de Sensibilidade (F02)', explanation: f02Ranking.explanation })}
              />
            </div>

            <div className="border border-stone-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-100 text-stone-600 font-semibold border-b border-stone-200">
                  <tr>
                    <th className="py-2.5 px-3">Insumo</th>
                    <th className="py-2.5 px-3">Consumo Mês</th>
                    <th className="py-2.5 px-3">Gasto Total</th>
                    <th className="py-2.5 px-3 text-right">Risco (+10%)</th>
                    <th className="py-2.5 px-3 text-right">% CMV</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {f02Ranking.items.slice(0, 15).map((item, idx) => (
                    <tr key={item.ingredientId} className="hover:bg-stone-50">
                      <td className="py-2 px-3 font-medium text-stone-900">
                        {idx + 1}. {item.ingredientName}
                      </td>
                      <td className="py-2 px-3 font-mono text-stone-600">
                        {item.monthlyTheoreticalConsumption} {item.baseUnit}
                      </td>
                      <td className="py-2 px-3 font-mono text-stone-700">
                        {formatCentsToCurrency(item.monthlySpendInCents)}
                      </td>
                      <td className="py-2 px-3 font-mono font-bold text-rose-600 text-right">
                        +{formatCentsToCurrency(item.impactTenPercentInCents)}
                      </td>
                      <td className="py-2 px-3 font-mono text-stone-600 text-right">
                        {item.percentOfTotalCmv}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB F03: REAJUSTE PARA MANTER MARGEM */}
        {activeTab === 'F03_MARGIN' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-stone-50 p-4 rounded-xl border border-stone-200">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Prato:</label>
                <select
                  value={selectedRecipeId}
                  onChange={(e) => setSelectedRecipeId(e.target.value)}
                  className="w-full text-xs bg-white border border-stone-300 rounded-lg p-2 font-medium"
                >
                  {recipes.filter(r => !r.isSubRecipe).map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Novo Custo (R$):</label>
                <input
                  type="number"
                  step="0.50"
                  placeholder="Ex: 15.50"
                  onChange={(e) => setSimulatedCostCents(Math.round(parseFloat(e.target.value || '0') * 100))}
                  className="w-full text-xs bg-white border border-stone-300 rounded-lg p-2 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Margem Alvo (%):</label>
                <input
                  type="number"
                  min="10"
                  max="95"
                  value={targetMargin}
                  onChange={(e) => setTargetMargin(Number(e.target.value))}
                  className="w-full text-xs bg-white border border-stone-300 rounded-lg p-2 font-mono"
                />
              </div>
            </div>

            {f03Result && (
              <div className="p-4 bg-white border border-stone-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-stone-500 font-medium block">Preço de Venda Recomendado:</span>
                    <span className="text-2xl font-bold font-mono text-stone-900">
                      {formatCentsToCurrency(f03Result.suggestedNewPriceInCents)}
                    </span>
                    <span className="text-xs text-amber-700 font-medium ml-2">
                      (reajuste de {f03Result.readjustmentPercentage}%)
                    </span>
                  </div>
                  <HowWeCalculatedButton
                    onClick={() => setExplanationData({ title: 'Reajuste para Manter Margem (F03)', explanation: f03Result.explanation })}
                  />
                </div>

                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 text-xs">
                  <strong>Limite de tolerância de vendas:</strong> Você pode perder até{' '}
                  <strong className="font-mono text-sm">{f03Result.maxTolerableVolumeDropPercentage}%</strong> dos pedidos
                  deste prato e o seu lucro continuará rigorosamente o mesmo.
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB F07: INFLAÇÃO DA COZINHA */}
        {activeTab === 'F07_INFLATION' && f07Result && (
          <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-stone-500 font-medium block">Índice Laspeyres da Cozinha:</span>
                <span className="text-2xl font-bold font-mono text-stone-900">
                  {f07Result.indexLaspeyres}
                </span>
                <span className="text-xs text-stone-500 ml-2">(Base 100)</span>
              </div>
              <HowWeCalculatedButton
                onClick={() => setExplanationData({ title: 'Inflação da Cozinha Laspeyres (F07)', explanation: f07Result.explanation })}
              />
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              Mede a variação real do custo da cesta de insumos ponderada pelo consumo histórico do seu restaurante.
            </p>
          </div>
        )}

        <div className="pt-3 border-t border-stone-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium rounded-lg cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>

      {explanationData && (
        <ExplanationModal
          isOpen={true}
          onClose={() => setExplanationData(null)}
          title={explanationData.title}
          explanation={explanationData.explanation}
        />
      )}
    </Modal>
  );
};
