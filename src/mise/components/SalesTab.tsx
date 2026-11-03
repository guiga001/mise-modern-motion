/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — Vendas Manuais & Gestão de Faturamento
 * 100% Manual, simples e direto: lance qualquer venda no balcão, mesa, PIX ou delivery.
 */

import React, { useState, useMemo } from 'react';
import {
  Plus,
  ShoppingBag,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  UploadCloud,
  Calendar,
  DollarSign,
  Layers,
  Trash2,
} from 'lucide-react';
import { SalesImport, Recipe, StockMovement } from '../domain/types';
import { formatBaseQuantity, formatCentsToCurrency, parseCurrencyToCents } from '../domain/units';
import { parseSalesCsvText, processSalesAndDeductStock, computeContentHash } from '../domain/sales';
import { MiseDatabaseState, appendAuditLog } from '../lib/storage';
import { Modal } from './Modal';
import { EmptyState } from './EmptyState';
import { calculateUncostedRevenue, calculateChannelMargins, calculateDailySalesGoal } from '../domain/sales-intelligence';
import { matchProductToRecipes } from '../domain/similarity';
import { ExplanationModal, HowWeCalculatedButton } from './ExplanationModal';
import { Target, HelpCircle, Check, Link2 } from 'lucide-react';

interface SalesTabProps {
  database: MiseDatabaseState;
  onUpdateDatabase: (newState: MiseDatabaseState) => void;
  onNavigateToRecipes: () => void;
}

export const SalesTab: React.FC<SalesTabProps> = ({
  database,
  onUpdateDatabase,
  onNavigateToRecipes,
}) => {
  const { activeStoreId, stores, salesImports, recipes, ingredients, stockMovements } = database;
  const targetStoreId = activeStoreId === 'CONSOLIDATED' ? (stores[0]?.id || 'store_1') : activeStoreId;

  const [activeView, setActiveView] = useState<'MANUAL' | 'CSV'>('MANUAL');
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);

  // Form Lançamento Manual de Venda
  const [selectedRecipeId, setSelectedRecipeId] = useState('');
  const [customProductName, setCustomProductName] = useState('');
  const [saleQuantity, setSaleQuantity] = useState('1');
  const [salePriceStr, setSalePriceStr] = useState('');
  const [paymentChannel, setPaymentChannel] = useState('Balcão / Dinheiro');
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [feeStr, setFeeStr] = useState('0,00');

  // Form CSV Opcional
  const [csvContent, setCsvContent] = useState('');
  const [csvChannel, setCsvChannel] = useState('iFood Delivery');
  const [csvPreviewRows, setCsvPreviewRows] = useState<any[]>([]);
  const [csvError, setCsvError] = useState('');
  const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
  const [selectedExplanation, setSelectedExplanation] = useState<{ title: string; explanation: any } | null>(null);

  const ingredientsMap = useMemo(() => new Map(ingredients.map(i => [i.id, i])), [ingredients]);
  const recipesMap = useMemo(() => new Map(recipes.map(r => [r.id, r])), [recipes]);

  // F08: Receita sem custo
  const uncostedReport = useMemo(() => {
    return calculateUncostedRevenue(salesImports, recipesMap, database.productNameToRecipeIdMap || {});
  }, [salesImports, recipesMap, database.productNameToRecipeIdMap]);

  // F25: Margem líquida real por canal
  const channelReport = useMemo(() => {
    return calculateChannelMargins(salesImports, recipesMap, ingredientsMap);
  }, [salesImports, recipesMap, ingredientsMap]);

  // F43: Sugestões de similaridade para itens sem mapeamento
  const mappingSuggestions = useMemo(() => {
    const candidates = recipes.map(r => ({ id: r.id, name: r.name }));
    const result: { externalName: string; matches: any[] }[] = [];
    for (const item of uncostedReport.problematicItems) {
      if (item.reason === 'SEM_MAPEAMENTO') {
        const matches = matchProductToRecipes(item.externalProductName, candidates);
        result.push({
          externalName: item.externalProductName,
          matches,
        });
      }
    }
    return result;
  }, [uncostedReport.problematicItems, recipes]);

  const handleApplyMapping = (externalName: string, recipeId: string) => {
    const updatedMap = {
      ...(database.productNameToRecipeIdMap || {}),
      [externalName]: recipeId,
    };

    // Atualizar também retrospectivamente os imports de vendas
    const updatedSales = database.salesImports.map((imp) => ({
      ...imp,
      lines: imp.lines.map((line) =>
        line.externalProductName === externalName ? { ...line, mappedRecipeId: recipeId } : line
      ),
    }));

    const newState: MiseDatabaseState = {
      ...database,
      productNameToRecipeIdMap: updatedMap,
      salesImports: updatedSales,
      auditLogs: [
        ...database.auditLogs,
        {
          id: `aud_${Date.now()}`,
          action: 'MAP_RECIPE_SIMILARITY',
          entityType: 'Recipe',
          entityId: recipeId,
          userId: database.activeUserId || 'dono',
          userName: 'Dono/Gestor',
          details: `Item de venda "${externalName}" mapeado para a Ficha Técnica ID "${recipeId}" via similaridade determinística (F43).`,
          timestamp: new Date().toISOString(),
        },
      ],
    };

    onUpdateDatabase(newState);
  };

  // Atualiza preço sugerido automaticamente quando seleciona uma receita
  const handleSelectRecipe = (recipeId: string) => {
    setSelectedRecipeId(recipeId);
    if (!recipeId) return;
    const rec = recipes.find(r => r.id === recipeId);
    if (rec) {
      const qty = Math.max(1, parseInt(saleQuantity) || 1);
      const totalCents = rec.salePriceInCents * qty;
      setSalePriceStr((totalCents / 100).toFixed(2).replace('.', ','));
    }
  };

  const handleQtyChange = (qtyStr: string) => {
    setSaleQuantity(qtyStr);
    const qty = Math.max(1, parseInt(qtyStr) || 1);
    if (selectedRecipeId) {
      const rec = recipes.find(r => r.id === selectedRecipeId);
      if (rec) {
        const totalCents = rec.salePriceInCents * qty;
        setSalePriceStr((totalCents / 100).toFixed(2).replace('.', ','));
      }
    }
  };

  // Salvar Venda Manual
  const handleSaveManualSale = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Math.max(1, parseInt(saleQuantity) || 1);
    const totalGrossInCents = parseCurrencyToCents(salePriceStr);
    if (totalGrossInCents <= 0) return;

    const feeInCents = parseCurrencyToCents(feeStr);
    const netRevenueInCents = Math.max(0, totalGrossInCents - feeInCents);

    const recipe = selectedRecipeId ? recipes.find(r => r.id === selectedRecipeId) : null;
    const productName = recipe ? recipe.name : (customProductName.trim() || 'Venda Avulsa');

    const now = new Date().toISOString();
    const newMovements: StockMovement[] = [];

    // Se houver Ficha Técnica vinculada, explode os insumos e baixa o estoque
    if (recipe) {
      const portions = Math.max(1, recipe.yieldPortions || 1);
      const factorPerPortion = qty / portions;

      for (const line of recipe.lines) {
        if (line.ingredientId) {
          const ing = ingredientsMap.get(line.ingredientId);
          const grossQty = line.quantityInBaseUnit * (line.correctionFactor || 1) * factorPerPortion;
          const unitCostMicro = ing ? ing.currentUnitCostMicrocents : 0;
          const totalCostInCents = Math.round((grossQty * unitCostMicro) / 10000);

          newMovements.push({
            id: `mov_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            storeId: targetStoreId,
            ingredientId: line.ingredientId,
            type: 'SALES_CONSUMPTION',
            quantityInBaseUnit: -grossQty,
            unitCostMicrocents: unitCostMicro,
            totalCostInCents,
            reason: `Venda manual de ${qty}x ${productName}`,
            createdAt: now,
            createdBy: 'Dono Gestor',
          });
        }
      }
    }

    const saleRecord: SalesImport = {
      id: `sale_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      storeId: targetStoreId,
      channel: paymentChannel,
      periodStartDate: saleDate,
      periodEndDate: saleDate,
      fileHash: `manual_${Date.now()}`,
      totalGrossInCents,
      totalNetInCents: netRevenueInCents,
      totalOrdersCount: qty,
      lines: [
        {
          externalProductName: productName,
          mappedRecipeId: recipe ? recipe.id : undefined,
          quantity: qty,
          salePriceInCents: Math.round(totalGrossInCents / qty),
          totalGrossInCents,
          discountsInCents: 0,
          channelFeeInCents: feeInCents,
          netRevenueInCents,
        },
      ],
      stockDeducted: newMovements.length > 0,
      importedAt: now,
    };

    const stateWithSale = {
      ...database,
      salesImports: [saleRecord, ...database.salesImports],
      stockMovements: [...newMovements, ...database.stockMovements],
    };

    const newState = appendAuditLog(
      stateWithSale,
      'MANUAL_SALE',
      'SalesImport',
      saleRecord.id,
      `Venda manual de ${qty}x '${productName}' no valor de ${formatCentsToCurrency(totalGrossInCents)} via ${paymentChannel}.`
    );

    onUpdateDatabase(newState);
    setIsManualModalOpen(false);
    setSelectedRecipeId('');
    setCustomProductName('');
    setSaleQuantity('1');
    setSalePriceStr('');
    setFeeStr('0,00');
  };

  // CSV Import (secundário/opcional)
  const handleParseCsv = (text: string) => {
    setCsvContent(text);
    setCsvError('');
    try {
      const rows = parseSalesCsvText(text);
      setCsvPreviewRows(rows);
    } catch {
      setCsvError('Erro ao interpretar as linhas do arquivo.');
    }
  };

  const handleConfirmCsvImport = () => {
    if (csvPreviewRows.length === 0) return;
    const hash = computeContentHash(csvContent);
    const existing = salesImports.find(s => s.fileHash === hash);
    if (existing) {
      setCsvError('Este arquivo já foi importado.');
      return;
    }

    const result = processSalesAndDeductStock(
      targetStoreId,
      csvPreviewRows,
      recipes,
      ingredientsMap,
      recipesMap,
      new Map(),
      'Dono Gestor'
    );

    const now = new Date().toISOString();
    const newImport: SalesImport = {
      id: `sales_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      storeId: targetStoreId,
      channel: csvChannel,
      periodStartDate: now.split('T')[0],
      periodEndDate: now.split('T')[0],
      fileHash: hash,
      totalGrossInCents: result.totalGrossInCents,
      totalNetInCents: result.totalNetInCents,
      totalOrdersCount: result.totalOrders,
      lines: result.parsedLines.map(p => ({
        externalProductName: p.externalProductName,
        mappedRecipeId: recipes.find(r => r.name.toLowerCase() === p.externalProductName.toLowerCase())?.id,
        quantity: p.quantity,
        salePriceInCents: p.salePriceInCents,
        totalGrossInCents: p.totalGrossInCents,
        discountsInCents: p.discountInCents,
        channelFeeInCents: p.feeInCents,
        netRevenueInCents: Math.max(0, p.totalGrossInCents - (p.discountInCents + p.feeInCents)),
      })),
      stockDeducted: result.stockMovements.length > 0,
      importedAt: now,
    };

    const newStockMovements = result.stockMovements.map(m => ({
      ...m,
      id: `mov_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: now,
    }));

    const newState = appendAuditLog(
      {
        ...database,
        salesImports: [newImport, ...database.salesImports],
        stockMovements: [...newStockMovements, ...database.stockMovements],
      },
      'IMPORT_SALES_CSV',
      'SalesImport',
      newImport.id,
      `Vendas importadas de '${csvChannel}' no total de ${formatCentsToCurrency(result.totalGrossInCents)}.`
    );

    onUpdateDatabase(newState);
    setIsCsvModalOpen(false);
    setCsvContent('');
    setCsvPreviewRows([]);
  };

  const handleDeleteSale = (saleId: string) => {
    const updated = salesImports.filter(s => s.id !== saleId);
    const newState = appendAuditLog(
      { ...database, salesImports: updated },
      'DELETE_SALE',
      'SalesImport',
      saleId,
      'Lançamento de venda removido.'
    );
    onUpdateDatabase(newState);
  };

  const filteredSales = salesImports.filter(
    s => activeStoreId === 'CONSOLIDATED' || s.storeId === activeStoreId
  );

  const totalGrossRevenue = useMemo(() => {
    return filteredSales.reduce((acc, curr) => acc + curr.totalGrossInCents, 0);
  }, [filteredSales]);

  const totalNetRevenue = useMemo(() => {
    return filteredSales.reduce((acc, curr) => acc + curr.totalNetInCents, 0);
  }, [filteredSales]);

  return (
    <div className="py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">
      {/* Header bar com botões rápidos */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-stone-900 tracking-tight">
            Vendas & Faturamento
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Lance vendas de pratos ou bebidas de forma manual e simples, ou registre o fechamento do caixa do dia.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCsvModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors cursor-pointer"
            title="Importar planilha se preferir"
          >
            <UploadCloud className="w-4 h-4 text-stone-500" />
            <span>Importar CSV (Opcional)</span>
          </button>
          <button
            onClick={() => {
              setSelectedRecipeId('');
              setCustomProductName('');
              setSaleQuantity('1');
              setSalePriceStr('');
              setFeeStr('0,00');
              setIsManualModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>+ Lançar Venda Manual</span>
          </button>
        </div>
      </div>

      {/* Resumo do Faturamento */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-stone-200/80 shadow-2xs">
          <span className="text-xs text-stone-500 font-medium">Total de Vendas Realizadas</span>
          <div className="text-xl font-bold font-mono text-stone-900 mt-1">
            {filteredSales.reduce((acc, curr) => acc + curr.totalOrdersCount, 0)} itens vendidos
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200/80 shadow-2xs">
          <span className="text-xs text-stone-500 font-medium">Faturamento Bruto</span>
          <div className="text-xl font-bold font-mono text-stone-900 mt-1">
            {formatCentsToCurrency(totalGrossRevenue)}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200/80 shadow-2xs">
          <span className="text-xs text-stone-500 font-medium">Faturamento Líquido (No Bolso)</span>
          <div className="text-xl font-bold font-mono text-emerald-700 mt-1">
            {formatCentsToCurrency(totalNetRevenue)}
          </div>
        </div>
      </div>

      {/* F08 Alerta de Receita Sem Custo */}
      {uncostedReport.totalUncostedRevenueInCents > 0 && (
        <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-800">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-amber-900">
                  F08 · Receita Sem Custo (Custos Ocultos)
                </h4>
                <span className="text-[10px] bg-amber-200/80 text-amber-900 font-mono font-bold px-1.5 py-0.5 rounded">
                  {uncostedReport.uncostedPercentage}% do faturamento
                </span>
              </div>
              <p className="text-xs text-amber-800 mt-0.5">
                {formatCentsToCurrency(uncostedReport.totalUncostedRevenueInCents)} em vendas veio de itens sem ficha técnica vinculada. O estoque não está sendo baixado para estes itens.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <HowWeCalculatedButton
              onClick={() => setSelectedExplanation({ title: 'Receita Sem Custo (F08)', explanation: uncostedReport.explanation })}
            />
            {mappingSuggestions.length > 0 && (
              <button
                onClick={() => setIsMappingModalOpen(true)}
                className="px-3 py-1.5 bg-amber-900 hover:bg-stone-900 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Mapear com 1 Clique (F43)</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* F25 Margem Líquida Real por Canal */}
      {channelReport.channels.length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200/80 p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-stone-100">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-600">
                F25 · Margem Líquida Real por Canal
              </span>
              <span className="text-xs text-stone-400">· {channelReport.channels.length} canais ativos</span>
            </div>
            <HowWeCalculatedButton
              onClick={() => setSelectedExplanation({ title: 'Margem por Canal (F25)', explanation: channelReport.explanation })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {channelReport.channels.map((ch) => (
              <div key={ch.channel} className="p-3 bg-stone-50 rounded-xl border border-stone-200/60 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-stone-900">{ch.channel}</span>
                  <span className={`font-mono font-bold ${ch.netMarginPercentage >= 30 ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {ch.netMarginPercentage}% margem
                  </span>
                </div>
                <div className="text-stone-500 flex justify-between text-[11px]">
                  <span>Faturado: {formatCentsToCurrency(ch.grossRevenueInCents)}</span>
                  <span>CMV: {formatCentsToCurrency(ch.cmvInCents)}</span>
                </div>
                <div className="text-stone-700 font-mono font-bold pt-1 border-t border-stone-200/40 flex justify-between">
                  <span>Sobra Limpa:</span>
                  <span className="text-emerald-800">{formatCentsToCurrency(ch.netMarginInCents)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {filteredSales.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="Nenhuma venda registrada ainda"
          description="Você pode lançar vendas uma a uma manualmente ou registrar o total de pratos vendidos no dia. O sistema calcula a receita e dá baixa automática nos insumos."
          actionLabel="+ Lançar Minha Primeira Venda"
          onAction={() => setIsManualModalOpen(true)}
          secondaryActionLabel="Ver Fichas Técnicas"
          onSecondaryAction={onNavigateToRecipes}
        />
      ) : (
        <div className="bg-white rounded-xl border border-stone-200/80 overflow-hidden shadow-2xs">
          <div className="p-4 border-b border-stone-100 flex items-center justify-between">
            <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
              Histórico de Vendas Lançadas
            </h3>
            <span className="text-xs text-stone-500">{filteredSales.length} lançamento(s)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50/60 text-stone-500 font-semibold">
                  <th className="py-3 px-4">Data</th>
                  <th className="py-3 px-4">Item Vendido</th>
                  <th className="py-3 px-4">Canal / Forma</th>
                  <th className="py-3 px-4 text-right">Qtd</th>
                  <th className="py-3 px-4 text-right">Valor Total</th>
                  <th className="py-3 px-4 text-center">Baixa no Estoque</th>
                  <th className="py-3 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredSales.map((sale) => {
                  const firstLine = sale.lines[0];
                  return (
                    <tr key={sale.id} className="hover:bg-stone-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono text-stone-600">
                        {sale.periodStartDate.split('-').reverse().join('/')}
                      </td>
                      <td className="py-3 px-4 font-semibold text-stone-900">
                        {firstLine ? firstLine.externalProductName : 'Venda'}
                        {sale.lines.length > 1 && ` (+${sale.lines.length - 1} outros)`}
                      </td>
                      <td className="py-3 px-4 text-stone-700">
                        {sale.channel}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-stone-900 font-medium">
                        {sale.totalOrdersCount}x
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-800">
                        {formatCentsToCurrency(sale.totalGrossInCents)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {sale.stockDeducted ? (
                          <span className="text-[11px] font-bold text-emerald-700 flex items-center justify-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Baixado</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-stone-400">Sem Ficha</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleDeleteSale(sale.id)}
                          className="p-1 text-stone-400 hover:text-rose-600 rounded cursor-pointer transition-colors"
                          title="Remover venda"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Lançamento Manual de Venda (Simples e Rápido) */}
      <Modal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        title="Lançar Venda Manual"
        subtitle="Rápido e direto: informe o que vendeu, a quantidade e o valor recebido."
      >
        <form onSubmit={handleSaveManualSale} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Prato ou Produto do Cardápio
            </label>
            {recipes.length > 0 ? (
              <select
                value={selectedRecipeId}
                onChange={(e) => handleSelectRecipe(e.target.value)}
                className="w-full text-xs px-3 py-2.5 rounded-lg border border-stone-300 bg-white focus:outline-none focus:ring-1 focus:ring-stone-900"
              >
                <option value="">Selecione um prato da Ficha Técnica (Recomendado)...</option>
                {recipes.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name} — Preço padrão: {formatCentsToCurrency(r.salePriceInCents)}
                  </option>
                ))}
              </select>
            ) : null}

            {!selectedRecipeId && (
              <div className="mt-2">
                <input
                  type="text"
                  placeholder="Ou digite o nome de um produto avulso (ex: Refrigerante Lata, Cafezinho)..."
                  value={customProductName}
                  onChange={(e) => setCustomProductName(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-900"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Quantidade Vendida *
              </label>
              <input
                type="number"
                min="1"
                required
                value={saleQuantity}
                onChange={(e) => handleQtyChange(e.target.value)}
                placeholder="1"
                className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-900 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Valor Total Recebido (R$) *
              </label>
              <input
                type="text"
                required
                value={salePriceStr}
                onChange={(e) => setSalePriceStr(e.target.value)}
                placeholder="Ex: 48,00"
                className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-900 font-mono text-emerald-800 font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Forma de Pagamento / Canal *
              </label>
              <select
                value={paymentChannel}
                onChange={(e) => setPaymentChannel(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 bg-white focus:outline-none focus:ring-1 focus:ring-stone-900"
              >
                <option value="Balcão / Dinheiro">Balcão / Dinheiro</option>
                <option value="PIX Direto">PIX Direto</option>
                <option value="Cartão de Débito">Cartão de Débito</option>
                <option value="Cartão de Crédito">Cartão de Crédito</option>
                <option value="iFood Delivery">iFood Delivery</option>
                <option value="WhatsApp / Entrega Própria">WhatsApp / Entrega Própria</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Data da Venda *
              </label>
              <input
                type="date"
                required
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-900 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Taxa ou Desconto (R$)
            </label>
            <input
              type="text"
              value={feeStr}
              onChange={(e) => setFeeStr(e.target.value)}
              placeholder="0,00"
              className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-900 font-mono"
            />
            <p className="text-[11px] text-stone-400 mt-0.5">
              Taxa de maquininha ou comissão de entrega descontada da sua receita líquida.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
            <button
              type="button"
              onClick={() => setIsManualModalOpen(false)}
              className="px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              Confirmar Venda
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Opcional: Importar CSV */}
      <Modal
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
        title="Importar Arquivo CSV (Opcional)"
        subtitle="Apenas se você já possui um relatório em planilha do PDV ou delivery."
      >
        <div className="space-y-4">
          {csvError && (
            <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
              {csvError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Canal de Origem
            </label>
            <input
              type="text"
              value={csvChannel}
              onChange={(e) => setCsvChannel(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Cole as linhas do CSV
            </label>
            <textarea
              rows={4}
              value={csvContent}
              onChange={(e) => handleParseCsv(e.target.value)}
              placeholder="produto;quantidade;valor_total..."
              className="w-full text-xs font-mono p-2.5 rounded-lg border border-stone-300"
            />
          </div>

          {csvPreviewRows.length > 0 && (
            <div className="text-xs text-stone-700 font-medium">
              ✔ {csvPreviewRows.length} itens identificados na planilha.
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
            <button
              type="button"
              onClick={() => setIsCsvModalOpen(false)}
              className="px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={csvPreviewRows.length === 0}
              onClick={handleConfirmCsvImport}
              className="px-4 py-2 text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 disabled:opacity-50 rounded-lg"
            >
              Importar Linhas
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Mapeamento Inteligente por Similaridade (F43) */}
      <Modal
        isOpen={isMappingModalOpen}
        onClose={() => setIsMappingModalOpen(false)}
        title="Mapeamento Inteligente de Vendas (F43)"
        subtitle="Algoritmo determinístico de Jaro-Winkler + Tokens para vincular itens externos às suas Fichas Técnicas."
        maxWidth="2xl"
      >
        <div className="space-y-4">
          <p className="text-xs text-stone-600 leading-relaxed">
            Ao vincular um produto à ficha técnica, o sistema passa a calcular o CMV real e deduzir automaticamente o estoque dos insumos a cada venda.
          </p>

          <div className="divide-y divide-stone-100 border border-stone-200 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
            {mappingSuggestions.map((item) => {
              const bestMatch = item.matches[0];
              return (
                <div key={item.externalName} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-stone-50 text-xs">
                  <div>
                    <span className="font-semibold text-stone-900 block">{item.externalName}</span>
                    {bestMatch ? (
                      <span className="text-[11px] text-stone-500 flex items-center gap-1.5 mt-0.5">
                        <span className={`px-1.5 py-0.2 rounded font-bold text-[10px] ${
                          bestMatch.confidenceTier === 'ALTA'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {bestMatch.confidenceTier} ({Math.round(bestMatch.score * 100)}%)
                        </span>
                        <span>Sugestão: <strong>{bestMatch.targetName}</strong></span>
                      </span>
                    ) : (
                      <span className="text-[11px] text-stone-400">Sem correspondência próxima</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {bestMatch ? (
                      <button
                        onClick={() => {
                          handleApplyMapping(item.externalName, bestMatch.targetId);
                        }}
                        className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg font-medium text-xs cursor-pointer flex items-center gap-1 shadow-xs"
                      >
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Vincular com 1 Clique</span>
                      </button>
                    ) : (
                      <select
                        onChange={(e) => {
                          if (e.target.value) handleApplyMapping(item.externalName, e.target.value);
                        }}
                        className="text-xs border border-stone-300 rounded p-1 bg-white font-medium"
                      >
                        <option value="">Vincular manualmente a...</option>
                        {recipes.map((r) => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-stone-100 flex justify-end">
            <button
              onClick={() => setIsMappingModalOpen(false)}
              className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium rounded-lg cursor-pointer"
            >
              Concluir Mapeamentos
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal "Como Calculamos" */}
      {selectedExplanation && (
        <ExplanationModal
          isOpen={true}
          onClose={() => setSelectedExplanation(null)}
          title={selectedExplanation.title}
          explanation={selectedExplanation.explanation}
        />
      )}
    </div>
  );
};
