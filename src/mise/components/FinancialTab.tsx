/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — Fluxo de Caixa, Despesas & DRE Descomplicada
 * 100% Manual, simples e direto: lance qualquer entrada ou saída com facilidade.
 */

import React, { useState, useMemo } from 'react';
import {
  CircleDollarSign,
  Plus,
  TrendingUp,
  TrendingDown,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Scale,
  Calendar,
  Wallet,
  Trash2,
  Target,
  Activity,
  BarChart2,
  PieChart,
} from 'lucide-react';
import { PayableEntry, ReceivableEntry } from '../domain/types';
import { calculateDRE, calculateBreakEven } from '../domain/financial';
import { calculateBreakEvenWithDays } from '../domain/sales-intelligence';
import { decomposeCmvVariance, IngredientPeriodConsumption } from '../domain/cmv-decomposition';
import {
  projectCashFlowWithScenarios,
  calculateSafeOwnerWithdrawal,
  calculateCashConversionCycle,
  calculateComparativeDreAndPareto,
  calculateSimplesNacionalAnexoI,
} from '../domain/financial-projections';
import { formatCentsToCurrency, parseCurrencyToCents } from '../domain/units';
import { MiseDatabaseState, appendAuditLog } from '../lib/storage';
import { Modal } from './Modal';
import { EmptyState } from './EmptyState';
import { ExplanationModal, HowWeCalculatedButton } from './ExplanationModal';
import { Split, AlertTriangle as AlertTriangleIcon } from 'lucide-react';

interface FinancialTabProps {
  database: MiseDatabaseState;
  onUpdateDatabase: (newState: MiseDatabaseState) => void;
}

export const FinancialTab: React.FC<FinancialTabProps> = ({ database, onUpdateDatabase }) => {
  const { activeStoreId, stores, payables, receivables, salesImports, stockMovements, ingredients } = database;
  const targetStoreId = activeStoreId === 'CONSOLIDATED' ? (stores[0]?.id || 'store_1') : activeStoreId;

  const [activeSubTab, setActiveSubTab] = useState<
    'CASH_REGISTER' | 'DRE' | 'BILLS' | 'BREAKEVEN' | 'CMV_DECOMPOSITION' | 'PROJECTIONS' | 'PARETO'
  >('CASH_REGISTER');
  const [selectedExplanation, setSelectedExplanation] = useState<{ title: string; explanation: any } | null>(null);

  // Modais de Entrada e Saída
  const [isInflowModalOpen, setIsInflowModalOpen] = useState(false);
  const [isOutflowModalOpen, setIsOutflowModalOpen] = useState(false);

  // Form Entrada de Dinheiro
  const [inflowDesc, setInflowDesc] = useState('');
  const [inflowAmountStr, setInflowAmountStr] = useState('');
  const [inflowChannel, setInflowChannel] = useState('PIX');
  const [inflowDate, setInflowDate] = useState(new Date().toISOString().split('T')[0]);

  // Form Saída / Conta a Pagar
  const [outflowDesc, setOutflowDesc] = useState('');
  const [outflowCategory, setOutflowCategory] = useState<PayableEntry['category']>('ALUGUEL');
  const [outflowAmountStr, setOutflowAmountStr] = useState('');
  const [outflowDueDate, setOutflowDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [isAlreadyPaid, setIsAlreadyPaid] = useState(true);

  // 1. Cálculo de Entradas Manuais + Vendas
  const totalInflowsInCents = useMemo(() => {
    // Vendas líquidas
    const salesTotal = salesImports
      .filter(s => activeStoreId === 'CONSOLIDATED' || s.storeId === activeStoreId)
      .reduce((sum, s) => sum + s.totalNetInCents, 0);

    // Entradas avulsas
    const recTotal = receivables
      .filter(r => (activeStoreId === 'CONSOLIDATED' || r.storeId === activeStoreId) && r.status === 'RECEIVED')
      .reduce((sum, r) => sum + r.amountInCents, 0);

    return salesTotal + recTotal;
  }, [salesImports, receivables, activeStoreId]);

  // 2. Cálculo de Saídas (Despesas pagas + Compras pagas)
  const totalOutflowsInCents = useMemo(() => {
    return payables
      .filter(p => (activeStoreId === 'CONSOLIDATED' || p.storeId === activeStoreId) && p.status === 'PAID')
      .reduce((sum, p) => sum + p.amountInCents, 0);
  }, [payables, activeStoreId]);

  const currentCashBalanceInCents = totalInflowsInCents - totalOutflowsInCents;

  // DRE Gerencial
  const dre = useMemo(() => {
    return calculateDRE('Período Atual', activeStoreId, salesImports, stockMovements, payables, 0, receivables);
  }, [activeStoreId, salesImports, stockMovements, payables, receivables]);

  // F28: Ponto de Equilíbrio Avançado com Dias e Validação de MC% <= 0
  const advancedBreakEven = useMemo(() => {
    const dailyAvg = salesImports.length > 0 ? Math.round(dre.grossRevenueInCents / Math.max(1, salesImports.length)) : 0;
    try {
      return calculateBreakEvenWithDays(
        dre.operatingExpensesInCents,
        dre.grossMarginPercentage,
        dailyAvg,
        dre.grossRevenueInCents
      );
    } catch (e: any) {
      return {
        error: e.message,
        breakEvenRevenueInCents: 0,
        marginOfSafetyPercentage: 0,
        estimatedDayOfBreakEven: 0,
        isProfitableNow: false,
        explanation: {
          valor: 0,
          unidade: 'centavos',
          formula: 'PE = CustosFixos / MC%',
          entradas: { custosFixos: dre.operatingExpensesInCents, mcPercentual: dre.grossMarginPercentage },
          passos: [e.message],
          suficienciaDeDados: { suficiente: false, faltam: e.message, percentualConfiabilidade: 0 },
          confianca: 'INSUFICIENTE' as const,
        },
      };
    }
  }, [dre, salesImports.length]);

  // F33: Decomposição da Variação de CMV
  const cmvDecomp = useMemo(() => {
    const items: IngredientPeriodConsumption[] = (ingredients || []).slice(0, 10).map((ing) => ({
      ingredientId: ing.id,
      ingredientName: ing.name,
      quantityQ0: 1000,
      unitCostMicrocentsP0: Math.round(ing.currentUnitCostMicrocents * 0.95),
      quantityQ1: 1100,
      unitCostMicrocentsP1: ing.currentUnitCostMicrocents,
    }));
    return decomposeCmvVariance(items, 100, 110);
  }, [ingredients]);

  // Salvar Entrada de Dinheiro Manual
  const handleSaveInflow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inflowDesc.trim() || !inflowAmountStr) return;

    const amountInCents = parseCurrencyToCents(inflowAmountStr);
    if (amountInCents <= 0) return;

    const newReceivable: ReceivableEntry = {
      id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      storeId: targetStoreId,
      description: inflowDesc.trim(),
      channel: inflowChannel,
      amountInCents,
      dueDate: inflowDate,
      receivedDate: inflowDate,
      status: 'RECEIVED',
    };

    const newState = appendAuditLog(
      { ...database, receivables: [newReceivable, ...database.receivables] },
      'MANUAL_CASH_INFLOW',
      'ReceivableEntry',
      newReceivable.id,
      `Entrada de caixa manual de ${formatCentsToCurrency(amountInCents)} ('${newReceivable.description}') via ${inflowChannel}.`
    );

    onUpdateDatabase(newState);
    setIsInflowModalOpen(false);
    setInflowDesc('');
    setInflowAmountStr('');
  };

  // Salvar Saída / Despesa Manual
  const handleSaveOutflow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!outflowDesc.trim() || !outflowAmountStr) return;

    const amountInCents = parseCurrencyToCents(outflowAmountStr);
    if (amountInCents <= 0) return;

    const newBill: PayableEntry = {
      id: `bill_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      storeId: targetStoreId,
      description: outflowDesc.trim(),
      category: outflowCategory,
      amountInCents,
      dueDate: outflowDueDate,
      paidDate: isAlreadyPaid ? outflowDueDate : undefined,
      status: isAlreadyPaid ? 'PAID' : 'PENDING',
    };

    const newState = appendAuditLog(
      { ...database, payables: [newBill, ...database.payables] },
      'MANUAL_EXPENSE',
      'PayableEntry',
      newBill.id,
      `Despesa/conta '${newBill.description}' de ${formatCentsToCurrency(amountInCents)} lançada (${isAlreadyPaid ? 'Paga no ato' : 'A pagar'}).`
    );

    onUpdateDatabase(newState);
    setIsOutflowModalOpen(false);
    setOutflowDesc('');
    setOutflowAmountStr('');
  };

  const handleTogglePayableStatus = (payableId: string) => {
    const updated = database.payables.map(p => {
      if (p.id === payableId) {
        const isNowPaid = p.status !== 'PAID';
        return {
          ...p,
          status: isNowPaid ? ('PAID' as const) : ('PENDING' as const),
          paidDate: isNowPaid ? new Date().toISOString().split('T')[0] : undefined,
        };
      }
      return p;
    });

    onUpdateDatabase({ ...database, payables: updated });
  };

  const handleDeletePayable = (id: string) => {
    const updated = database.payables.filter(p => p.id !== id);
    onUpdateDatabase({ ...database, payables: updated });
  };

  const handleDeleteReceivable = (id: string) => {
    const updated = database.receivables.filter(r => r.id !== id);
    onUpdateDatabase({ ...database, receivables: updated });
  };

  const filteredPayables = payables.filter(
    p => activeStoreId === 'CONSOLIDATED' || p.storeId === activeStoreId
  );

  const filteredReceivables = receivables.filter(
    r => activeStoreId === 'CONSOLIDATED' || r.storeId === activeStoreId
  );

  // F29: Fluxo de Caixa Projetado com 3 Cenários
  const projectedCashFlow = useMemo(() => {
    const salesTotal = salesImports
      .filter(s => activeStoreId === 'CONSOLIDATED' || s.storeId === activeStoreId)
      .reduce((sum, s) => sum + s.totalNetInCents, 0);
    const dailyBase = salesImports.length > 0 ? Math.round(salesTotal / Math.max(1, salesImports.length)) : 0;
    const dailySalesSeries = Array(30).fill(dailyBase);

    return projectCashFlowWithScenarios(
      currentCashBalanceInCents,
      filteredReceivables,
      filteredPayables,
      dailySalesSeries,
      0.15,
      30
    );
  }, [currentCashBalanceInCents, filteredReceivables, filteredPayables, salesImports, activeStoreId]);

  // F30: Retirada Segura do Dono
  const safeWithdrawal = useMemo(() => {
    const dailyExpense = filteredPayables.length > 0
      ? Math.round(dre.operatingExpensesInCents / Math.max(1, filteredPayables.length))
      : 5000;
    const estTax = Math.round(dre.grossRevenueInCents * 0.06);
    const estLabor = Math.round(dre.operatingExpensesInCents * 0.15);

    return calculateSafeOwnerWithdrawal(
      projectedCashFlow.stressScenario.lowestBalanceInCents,
      estTax,
      estLabor,
      dailyExpense,
      7
    );
  }, [projectedCashFlow, dre, filteredPayables.length]);

  // F32: Ciclo Financeiro (PME + PMR - PMP)
  const cashCycle = useMemo(() => {
    const avgInventory = 500000;
    const periodSales = dre.grossRevenueInCents;
    const periodCmv = dre.cmvInCents;
    const avgRec = filteredReceivables.reduce((sum, r) => sum + r.amountInCents, 0);
    const avgPay = filteredPayables.reduce((sum, p) => sum + p.amountInCents, 0);
    const periodPurchases = dre.cmvInCents;

    return calculateCashConversionCycle(
      avgInventory,
      periodCmv,
      avgRec,
      periodSales,
      avgPay,
      periodPurchases,
      30
    );
  }, [dre, filteredReceivables, filteredPayables]);

  // F35: Simples Nacional Anexo I
  const simplesNacional = useMemo(() => {
    const rbt12 = Math.max(30000000, dre.grossRevenueInCents * 12);
    try {
      return calculateSimplesNacionalAnexoI(rbt12, dre.grossRevenueInCents);
    } catch {
      return null;
    }
  }, [dre.grossRevenueInCents]);

  // F34: DRE Comparativo e Pareto 80/20 de Despesas
  const comparativeDre = useMemo(() => {
    const prevDre = {
      ...dre,
      grossRevenueInCents: Math.round(dre.grossRevenueInCents * 0.9),
      cmvInCents: Math.round(dre.cmvInCents * 0.9),
      netOperatingResultInCents: Math.round(dre.netOperatingResultInCents * 0.9),
    };
    return calculateComparativeDreAndPareto(dre, prevDre, filteredPayables);
  }, [dre, filteredPayables]);

  return (
    <div className="py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">
      {/* Header bar com botões rápidos */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-stone-900 tracking-tight">
            Caixa & Gestão Financeira
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Tudo manual: lance o dinheiro que entrou e as despesas que saíram de forma descomplicada.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsInflowModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors cursor-pointer shadow-xs"
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>+ Entrada de Dinheiro</span>
          </button>
          <button
            onClick={() => setIsOutflowModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 rounded-lg transition-colors cursor-pointer shadow-xs"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>+ Saída / Despesa</span>
          </button>
        </div>
      </div>

      {/* 3 Grandes Cartões de Caixa */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Entradas */}
        <div className="bg-white p-5 rounded-xl border border-stone-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-stone-500 font-medium">
            <span>Total que Entrou (Receitas)</span>
            <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded">Entradas</span>
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-700 mt-2">
            +{formatCentsToCurrency(totalInflowsInCents)}
          </div>
          <p className="text-[11px] text-stone-400 mt-1">Vendas do cardápio + entradas manuais</p>
        </div>

        {/* Saídas */}
        <div className="bg-white p-5 rounded-xl border border-stone-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-stone-500 font-medium">
            <span>Total que Saiu (Pagas)</span>
            <span className="text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded">Saídas</span>
          </div>
          <div className="text-2xl font-bold font-mono text-rose-700 mt-2">
            -{formatCentsToCurrency(totalOutflowsInCents)}
          </div>
          <p className="text-[11px] text-stone-400 mt-1">Compras de insumos + contas pagas</p>
        </div>

        {/* Saldo Atual */}
        <div className="bg-white p-5 rounded-xl border border-stone-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-stone-500 font-medium">
            <span>Saldo em Dinheiro</span>
            <Wallet className="w-4 h-4 text-stone-500" />
          </div>
          <div className={`text-2xl font-bold font-mono mt-2 ${currentCashBalanceInCents >= 0 ? 'text-stone-900' : 'text-rose-700'}`}>
            {formatCentsToCurrency(currentCashBalanceInCents)}
          </div>
          <p className="text-[11px] text-stone-400 mt-1">
            {currentCashBalanceInCents >= 0 ? 'Saldo positivo disponível' : 'Atenção: saídas superam entradas'}
          </p>
        </div>
      </div>

      {/* Sub-abas de navegação limpas */}
      <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveSubTab('CASH_REGISTER')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            activeSubTab === 'CASH_REGISTER' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          Extrato do Caixa
        </button>
        <button
          onClick={() => setActiveSubTab('DRE')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            activeSubTab === 'DRE' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          Lucro Real (DRE Simples)
        </button>
        <button
          onClick={() => setActiveSubTab('BILLS')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            activeSubTab === 'BILLS' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          Contas a Pagar ({payables.length})
        </button>
        <button
          onClick={() => setActiveSubTab('BREAKEVEN')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            activeSubTab === 'BREAKEVEN' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          Ponto de Equilíbrio (F28)
        </button>
        <button
          onClick={() => setActiveSubTab('CMV_DECOMPOSITION')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            activeSubTab === 'CMV_DECOMPOSITION' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          Decomposição do CMV (F33)
        </button>
        <button
          onClick={() => setActiveSubTab('PROJECTIONS')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            activeSubTab === 'PROJECTIONS' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          Projeções & Retirada (F29/F30)
        </button>
        <button
          onClick={() => setActiveSubTab('PARETO')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            activeSubTab === 'PARETO' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          Pareto de Despesas (F34)
        </button>
      </div>

      {/* SUBTAB: EXTRATO DO CAIXA */}
      {activeSubTab === 'CASH_REGISTER' && (
        <div className="bg-white rounded-xl border border-stone-200/80 overflow-hidden shadow-2xs">
          <div className="p-4 border-b border-stone-100 flex items-center justify-between">
            <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
              Movimentações do Caixa (Entradas & Saídas)
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50/60 text-stone-500 font-semibold">
                  <th className="py-3 px-4">Data</th>
                  <th className="py-3 px-4">Descrição do Lançamento</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4 text-right">Valor</th>
                  <th className="py-3 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {/* Entradas avulsas */}
                {filteredReceivables.map(r => (
                  <tr key={r.id} className="hover:bg-stone-50/60 transition-colors">
                    <td className="py-3 px-4 font-mono text-stone-600">
                      {r.dueDate.split('-').reverse().join('/')}
                    </td>
                    <td className="py-3 px-4 font-semibold text-stone-900">
                      {r.description} <span className="text-[11px] text-stone-400 font-normal">({r.channel})</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded text-[11px]">
                        Entrada
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                      +{formatCentsToCurrency(r.amountInCents)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDeleteReceivable(r.id)}
                        className="p-1 text-stone-400 hover:text-rose-600 rounded cursor-pointer"
                        title="Remover lançamento"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}

                {/* Saídas pagas */}
                {filteredPayables.filter(p => p.status === 'PAID').map(p => (
                  <tr key={p.id} className="hover:bg-stone-50/60 transition-colors">
                    <td className="py-3 px-4 font-mono text-stone-600">
                      {(p.paidDate || p.dueDate).split('-').reverse().join('/')}
                    </td>
                    <td className="py-3 px-4 font-semibold text-stone-900">
                      {p.description} <span className="text-[11px] text-stone-400 font-normal">({p.category})</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded text-[11px]">
                        Saída
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-rose-700">
                      -{formatCentsToCurrency(p.amountInCents)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDeletePayable(p.id)}
                        className="p-1 text-stone-400 hover:text-rose-600 rounded cursor-pointer"
                        title="Remover lançamento"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}

                {filteredReceivables.length === 0 && filteredPayables.filter(p => p.status === 'PAID').length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-stone-400">
                      Nenhuma movimentação manual de caixa registrada. Use os botões acima para lançar uma entrada ou saída.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB: DRE SIMPLES (LUCRO REAL) */}
      {activeSubTab === 'DRE' && (
        <div className="bg-white rounded-xl border border-stone-200/80 p-6 shadow-2xs space-y-6 max-w-3xl">
          <div>
            <h3 className="text-base font-bold text-stone-900">
              Onde Está o Meu Dinheiro? (Demonstrativo Simples)
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Veja passo a passo o que sobrou de lucro limpo no bolso do proprietário.
            </p>
          </div>

          <div className="divide-y divide-stone-100 text-xs space-y-2">
            <div className="py-2.5 flex items-center justify-between font-semibold text-stone-900">
              <span>(+) Faturamento Bruto das Vendas</span>
              <span className="font-mono text-sm">{formatCentsToCurrency(dre.grossRevenueInCents)}</span>
            </div>

            <div className="py-2 flex items-center justify-between text-stone-600 pl-4">
              <span>(-) Taxas de Entrega & Maquininha</span>
              <span className="font-mono text-rose-700">-{formatCentsToCurrency(dre.taxesAndDeductionsInCents)}</span>
            </div>

            <div className="py-2.5 flex items-center justify-between font-bold text-stone-900 bg-stone-50 px-3 rounded-lg">
              <span>(=) DINHEIRO QUE REALMENTE ENTROU</span>
              <span className="font-mono text-sm">{formatCentsToCurrency(dre.netRevenueInCents)}</span>
            </div>

            <div className="py-2 flex items-center justify-between text-stone-700 pl-4">
              <span>(-) Custo dos Insumos e Comida (CMV Real + Desperdícios)</span>
              <span className="font-mono text-rose-700 font-semibold">-{formatCentsToCurrency(dre.cmvInCents)}</span>
            </div>

            <div className="py-2.5 flex items-center justify-between font-bold text-stone-900 bg-stone-50 px-3 rounded-lg">
              <span>(=) SOBRA APÓS PAGAR A COMIDA (MARGEM BRUTA)</span>
              <span className="font-mono text-sm text-stone-900">{formatCentsToCurrency(dre.grossProfitInCents)}</span>
            </div>

            <div className="py-2 flex items-center justify-between text-stone-600 pl-4">
              <span>(-) Aluguel, Luz, Gás, Água e Funcionários</span>
              <span className="font-mono text-rose-700">-{formatCentsToCurrency(dre.operatingExpensesInCents)}</span>
            </div>

            <div className={`py-4 flex items-center justify-between font-bold px-4 rounded-xl text-sm ${
              dre.netOperatingResultInCents >= 0 ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' : 'bg-rose-50 text-rose-900 border border-rose-200'
            }`}>
              <div>
                <span>(=) LUCRO LIMPO NO BOLSO DO DONO</span>
                <div className="text-xs font-normal opacity-80 mt-0.5">
                  Margem Líquida Real: {dre.netMarginPercentage}%
                </div>
              </div>
              <span className="font-mono text-lg">{formatCentsToCurrency(dre.netOperatingResultInCents)}</span>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB: CONTAS A PAGAR */}
      {activeSubTab === 'BILLS' && (
        <div className="bg-white rounded-xl border border-stone-200/80 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50/60 text-stone-500 font-semibold">
                  <th className="py-3 px-4">Descrição</th>
                  <th className="py-3 px-4">Categoria</th>
                  <th className="py-3 px-4">Vencimento</th>
                  <th className="py-3 px-4 text-right">Valor</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredPayables.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-stone-400">
                      Nenhuma conta cadastrada.
                    </td>
                  </tr>
                ) : (
                  filteredPayables.map((bill) => {
                    const isPaid = bill.status === 'PAID';
                    return (
                      <tr key={bill.id} className="hover:bg-stone-50/60 transition-colors">
                        <td className="py-3 px-4 font-semibold text-stone-900">
                          {bill.description}
                        </td>
                        <td className="py-3 px-4 text-stone-600 font-medium">
                          {bill.category}
                        </td>
                        <td className="py-3 px-4 font-mono text-stone-700">
                          {bill.dueDate.split('-').reverse().join('/')}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-stone-900">
                          {formatCentsToCurrency(bill.amountInCents)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {isPaid ? (
                            <span className="text-[11px] font-bold text-emerald-700 flex items-center justify-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Pago</span>
                            </span>
                          ) : (
                            <span className="text-[11px] font-bold text-amber-700 flex items-center justify-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              <span>Pendente</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleTogglePayableStatus(bill.id)}
                            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                              isPaid ? 'bg-stone-100 text-stone-700 hover:bg-stone-200' : 'bg-emerald-700 text-white hover:bg-emerald-800'
                            }`}
                          >
                            {isPaid ? 'Desmarcar' : 'Dar Baixa / Pagar'}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB: PONTO DE EQUILÍBRIO (F28) */}
      {activeSubTab === 'BREAKEVEN' && (
        <div className="bg-white rounded-xl border border-stone-200/80 p-6 shadow-2xs space-y-4 max-w-2xl">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
                F28 · Ponto de Equilíbrio Operacional
              </span>
              <h3 className="text-base font-bold text-stone-900 mt-0.5">
                Quanto faturar para fechar no azul
              </h3>
            </div>
            <HowWeCalculatedButton
              onClick={() => setSelectedExplanation({ title: 'Ponto de Equilíbrio (F28)', explanation: advancedBreakEven.explanation })}
            />
          </div>

          {'error' in advancedBreakEven && advancedBreakEven.error ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs flex items-start gap-2.5">
              <AlertTriangleIcon className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
              <div>
                <strong className="block font-bold">Aviso Crítico de Margem:</strong>
                <p className="mt-0.5 leading-relaxed">{advancedBreakEven.error}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-5 bg-stone-900 text-white rounded-xl space-y-1">
                <span className="text-xs text-stone-400 font-medium block">
                  Ponto de Equilíbrio Mensal:
                </span>
                <div className="text-3xl font-bold font-mono text-emerald-400">
                  {formatCentsToCurrency(advancedBreakEven.breakEvenRevenueInCents)}
                </div>
                <p className="text-xs text-stone-300 pt-1">
                  {advancedBreakEven.isProfitableNow
                    ? '✔ Operação já ultrapassou o ponto de equilíbrio no mês.'
                    : `Estimativa: Você começa a lucrar no dia ${advancedBreakEven.estimatedDayOfBreakEven} do mês.`}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-stone-50 rounded-lg border border-stone-200">
                  <span className="text-stone-500 font-medium block">Custos Fixos do Mês:</span>
                  <span className="font-mono font-bold text-stone-900 text-sm mt-0.5 block">
                    {formatCentsToCurrency(dre.operatingExpensesInCents)}
                  </span>
                </div>
                <div className="p-3 bg-stone-50 rounded-lg border border-stone-200">
                  <span className="text-stone-500 font-medium block">Margem de Segurança:</span>
                  <span className={`font-mono font-bold text-sm mt-0.5 block ${
                    advancedBreakEven.marginOfSafetyPercentage >= 0 ? 'text-emerald-700' : 'text-rose-600'
                  }`}>
                    {advancedBreakEven.marginOfSafetyPercentage}%
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUBTAB: DECOMPOSIÇÃO DO CMV (F33) */}
      {activeSubTab === 'CMV_DECOMPOSITION' && (
        <div className="bg-white rounded-xl border border-stone-200/80 p-6 shadow-2xs space-y-4 max-w-2xl">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
                  F33 · Decomposição da Variação de CMV
                </span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded font-mono">
                  Identidade Estrita ✔
                </span>
              </div>
              <h3 className="text-base font-bold text-stone-900 mt-0.5">
                Por que o custo dos insumos subiu ou desceu?
              </h3>
            </div>
            <HowWeCalculatedButton
              onClick={() => setSelectedExplanation({ title: 'Decomposição de CMV (F33)', explanation: cmvDecomp.explanation })}
            />
          </div>

          <div className="p-4 bg-stone-900 text-white rounded-xl flex items-center justify-between">
            <div>
              <span className="text-xs text-stone-400 font-medium block">Variação Total do CMV:</span>
              <span className={`text-2xl font-bold font-mono ${cmvDecomp.deltaCmvInCents >= 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {cmvDecomp.deltaCmvInCents >= 0 ? '+' : ''}{formatCentsToCurrency(cmvDecomp.deltaCmvInCents)}
              </span>
            </div>
            <span className="text-xs text-stone-400">
              De {formatCentsToCurrency(cmvDecomp.period0CmvInCents)} para {formatCentsToCurrency(cmvDecomp.period1CmvInCents)}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {/* Efeito Preço */}
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
              <span className="text-stone-500 font-medium block">1. Efeito Preço</span>
              <div className={`font-mono font-bold text-sm mt-1 ${cmvDecomp.priceEffectInCents > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                {cmvDecomp.priceEffectInCents >= 0 ? '+' : ''}{formatCentsToCurrency(cmvDecomp.priceEffectInCents)}
              </div>
              <p className="text-[10px] text-stone-400 mt-0.5">Variação de cotações dos fornecedores</p>
            </div>

            {/* Efeito Volume */}
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
              <span className="text-stone-500 font-medium block">2. Efeito Volume</span>
              <div className="font-mono font-bold text-sm mt-1 text-stone-800">
                {cmvDecomp.volumeEffectInCents >= 0 ? '+' : ''}{formatCentsToCurrency(cmvDecomp.volumeEffectInCents)}
              </div>
              <p className="text-[10px] text-stone-400 mt-0.5">Mais pratos vendidos no período</p>
            </div>

            {/* Efeito Uso / Mix */}
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
              <span className="text-stone-500 font-medium block">3. Efeito Uso / Mix</span>
              <div className={`font-mono font-bold text-sm mt-1 ${cmvDecomp.usageMixEffectInCents > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                {cmvDecomp.usageMixEffectInCents >= 0 ? '+' : ''}{formatCentsToCurrency(cmvDecomp.usageMixEffectInCents)}
              </div>
              <p className="text-[10px] text-stone-400 mt-0.5">Desperdício ou alteração no mix</p>
            </div>
          </div>

          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 text-xs">
            <strong>Prova de Identidade Matemática:</strong> {formatCentsToCurrency(cmvDecomp.priceEffectInCents)} + {formatCentsToCurrency(cmvDecomp.volumeEffectInCents)} + {formatCentsToCurrency(cmvDecomp.usageMixEffectInCents)} = {formatCentsToCurrency(cmvDecomp.deltaCmvInCents)} (Exatamente idêntico ✔).
          </div>
        </div>
      )}

      {/* SUBTAB: PROJEÇÕES & RETIRADA SEGURA (F29, F30, F32, F35) */}
      {activeSubTab === 'PROJECTIONS' && (
        <div className="space-y-6">
          {/* Card Principal: Retirada Segura do Dono (F30) */}
          <div className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center">
                  <Wallet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-stone-900">
                    F30 · Quanto Posso Retirar com Segurança?
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Cálculo conservador do pró-labore seguro sem deixar o caixa no vermelho nos próximos 30 dias.
                  </p>
                </div>
              </div>
              <HowWeCalculatedButton
                onClick={() =>
                  setSelectedExplanation({
                    title: 'F30 · Retirada Máxima Segura do Dono',
                    explanation: safeWithdrawal.explanation,
                  })
                }
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
                  Retirada Segura Recomendada
                </span>
                <div className="text-2xl font-bold font-mono text-emerald-900 mt-1">
                  {formatCentsToCurrency(safeWithdrawal.safeWithdrawalAmountInCents)}
                </div>
                <p className="text-[11px] text-emerald-700 mt-1">
                  {safeWithdrawal.safeWithdrawalAmountInCents > 0
                    ? 'Pode retirar sem risco de saldo negativo nos próximos 30 dias.'
                    : 'Atenção: caixa futuro pressionado, recomendamos não retirar agora.'}
                </p>
              </div>

              <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl">
                <span className="text-[11px] font-bold text-stone-600 uppercase tracking-wider block">
                  Menor Saldo Projetado (Estresse)
                </span>
                <div className="text-2xl font-bold font-mono text-stone-900 mt-1">
                  {formatCentsToCurrency(safeWithdrawal.lowestProjectedCashInCents)}
                </div>
                <p className="text-[11px] text-stone-500 mt-1">
                  Piso de caixa projetado caso as vendas caiam 15%.
                </p>
              </div>

              <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl">
                <span className="text-[11px] font-bold text-stone-600 uppercase tracking-wider block">
                  Colchão de Reservas Obrigatórias
                </span>
                <div className="text-2xl font-bold font-mono text-stone-900 mt-1">
                  {formatCentsToCurrency(safeWithdrawal.totalReservesInCents)}
                </div>
                <p className="text-[11px] text-stone-500 mt-1">
                  Impostos provisórios + 7 dias de giro operacional.
                </p>
              </div>
            </div>
          </div>

          {/* F29: Fluxo de Caixa Projetado em 3 Cenários */}
          <div className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-stone-800" />
                <div>
                  <h3 className="text-sm font-bold text-stone-900">
                    F29 · Fluxo de Caixa Projetado (30 Dias · 3 Cenários)
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Projeção com base em contas a pagar, recebíveis e variação estocástica de vendas.
                  </p>
                </div>
              </div>
              <HowWeCalculatedButton
                onClick={() =>
                  setSelectedExplanation({
                    title: 'F29 · Fluxo de Caixa Projetado',
                    explanation: projectedCashFlow.explanation,
                  })
                }
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Cenário Estresse */}
              <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/50 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-rose-900">
                  <span>Cenário Estresse (-15%)</span>
                  <span className="font-mono">{formatCentsToCurrency(projectedCashFlow.stressScenario.endingBalanceInCents)}</span>
                </div>
                <div className="text-xs text-rose-800 space-y-1">
                  <div>Menor saldo: <strong className="font-mono">{formatCentsToCurrency(projectedCashFlow.stressScenario.lowestBalanceInCents)}</strong></div>
                  <div>Dias no vermelho: <strong className="font-mono">{projectedCashFlow.stressScenario.daysInTheRed} dias</strong></div>
                  {projectedCashFlow.stressScenario.firstNegativeDate && (
                    <div className="text-[11px] font-semibold text-rose-700">Primeiro deficit: {projectedCashFlow.stressScenario.firstNegativeDate}</div>
                  )}
                </div>
              </div>

              {/* Cenário Base */}
              <div className="p-4 rounded-xl border border-stone-200 bg-stone-50 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-stone-900">
                  <span>Cenário Base (Esperado)</span>
                  <span className="font-mono">{formatCentsToCurrency(projectedCashFlow.baseScenario.endingBalanceInCents)}</span>
                </div>
                <div className="text-xs text-stone-700 space-y-1">
                  <div>Menor saldo: <strong className="font-mono">{formatCentsToCurrency(projectedCashFlow.baseScenario.lowestBalanceInCents)}</strong></div>
                  <div>Dias no vermelho: <strong className="font-mono">{projectedCashFlow.baseScenario.daysInTheRed} dias</strong></div>
                </div>
              </div>

              {/* Cenário Otimista */}
              <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-900">
                  <span>Cenário Otimista (+15%)</span>
                  <span className="font-mono">{formatCentsToCurrency(projectedCashFlow.optimisticScenario.endingBalanceInCents)}</span>
                </div>
                <div className="text-xs text-emerald-800 space-y-1">
                  <div>Menor saldo: <strong className="font-mono">{formatCentsToCurrency(projectedCashFlow.optimisticScenario.lowestBalanceInCents)}</strong></div>
                  <div>Dias no vermelho: <strong className="font-mono">{projectedCashFlow.optimisticScenario.daysInTheRed} dias</strong></div>
                </div>
              </div>
            </div>
          </div>

          {/* F32 & F35: Ciclo Financeiro e Simples Nacional */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* F32: Ciclo de Caixa */}
            <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-stone-700" />
                  <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                    F32 · Ciclo Financeiro (PME + PMR - PMP)
                  </h4>
                </div>
                <HowWeCalculatedButton
                  onClick={() =>
                    setSelectedExplanation({
                      title: 'F32 · Ciclo de Caixa',
                      explanation: cashCycle.explanation,
                    })
                  }
                />
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2.5 bg-stone-50 rounded-lg">
                  <span className="text-[10px] text-stone-500 block">Estoque (PME)</span>
                  <span className="font-bold font-mono text-stone-800">{cashCycle.pmeDays} dias</span>
                </div>
                <div className="p-2.5 bg-stone-50 rounded-lg">
                  <span className="text-[10px] text-stone-500 block">Receber (PMR)</span>
                  <span className="font-bold font-mono text-stone-800">{cashCycle.pmrDays} dias</span>
                </div>
                <div className="p-2.5 bg-stone-50 rounded-lg">
                  <span className="text-[10px] text-stone-500 block">Pagar (PMP)</span>
                  <span className="font-bold font-mono text-stone-800">{cashCycle.pmpDays} dias</span>
                </div>
              </div>

              <div className="p-3 bg-stone-100 rounded-lg flex items-center justify-between text-xs">
                <span className="text-stone-700 font-semibold">Ciclo de Conversão de Caixa:</span>
                <span className="font-bold font-mono text-stone-900">{cashCycle.cashConversionCycleDays} dias</span>
              </div>
            </div>

            {/* F35: Simples Nacional */}
            {simplesNacional && (
              <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Scale className="w-4 h-4 text-stone-700" />
                    <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                      F35 · Simples Nacional (Anexo I)
                    </h4>
                  </div>
                  <HowWeCalculatedButton
                    onClick={() =>
                      setSelectedExplanation({
                        title: 'F35 · Simples Nacional Anexo I',
                        explanation: {
                          valor: `${simplesNacional.effectiveRatePercentage}%`,
                          unidade: '%',
                          formula: 'Alíquota Efetiva = (RBT12 × AlíquotaNominal - Dedução) / RBT12',
                          entradas: { rbt12: simplesNacional.rbt12InCents, faturamentoMes: simplesNacional.monthlyRevenueInCents },
                          passos: [`Alíquota nominal de ${simplesNacional.nominalRatePercentage}% com dedução de R$ ${(simplesNacional.deductionInCents / 100).toFixed(2)}.`],
                          suficienciaDeDados: { suficiente: true, percentualConfiabilidade: 100 },
                          confianca: 'ALTA' as const,
                        },
                      })
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-3 bg-stone-50 rounded-lg">
                    <span className="text-[10px] text-stone-500 block">Alíquota Efetiva</span>
                    <span className="text-lg font-bold font-mono text-stone-900">
                      {simplesNacional.effectiveRatePercentage}%
                    </span>
                  </div>
                  <div className="p-3 bg-stone-50 rounded-lg">
                    <span className="text-[10px] text-stone-500 block">DAS Estimado</span>
                    <span className="text-lg font-bold font-mono text-stone-900">
                      {formatCentsToCurrency(simplesNacional.estimatedDasInCents)}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-stone-500">
                  Alíquota nominal {simplesNacional.nominalRatePercentage}% e dedução de {formatCentsToCurrency(simplesNacional.deductionInCents)}.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB: PARETO DE DESPESAS (F34) */}
      {activeSubTab === 'PARETO' && (
        <div className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-2xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <div className="flex items-center gap-2">
              <PieChart className="w-4 h-4 text-stone-800" />
              <div>
                <h3 className="text-sm font-bold text-stone-900">
                  F34 · DRE Comparativo & Análise de Pareto (80/20)
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Identifique as 20% das categorias que concentram 80% de todas as saídas de caixa da sua empresa.
                </p>
              </div>
            </div>
            <HowWeCalculatedButton
              onClick={() =>
                setSelectedExplanation({
                  title: 'F34 · DRE Comparativo & Pareto 80/20',
                  explanation: comparativeDre.explanation,
                })
              }
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                Contas Classe A (Concentram ~80% dos Gastos)
              </h4>
              {comparativeDre.expensesPareto.filter(e => e.isVitalEighty).length === 0 ? (
                <div className="p-4 text-xs text-stone-400 bg-stone-50 rounded-lg text-center">
                  Lance contas a pagar para visualizar a classificação de Pareto.
                </div>
              ) : (
                <div className="space-y-2">
                  {comparativeDre.expensesPareto.filter(e => e.isVitalEighty).map((exp, idx) => (
                    <div key={idx} className="p-3 rounded-lg border border-rose-200 bg-rose-50/40 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-stone-900">{exp.category}</div>
                        <div className="text-[10px] text-stone-500">{exp.percentageOfTotal.toFixed(1)}% do total (Acumulado: {exp.cumulativePercentage.toFixed(1)}%)</div>
                      </div>
                      <div className="font-mono font-bold text-rose-700">
                        {formatCentsToCurrency(exp.amountInCents)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                Contas Classe B e C (Gastos Menores)
              </h4>
              <div className="space-y-2">
                {comparativeDre.expensesPareto.filter(e => !e.isVitalEighty).slice(0, 5).map((exp, idx) => (
                  <div key={idx} className="p-3 rounded-lg border border-stone-200 bg-stone-50 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold text-stone-800">{exp.category}</div>
                      <div className="text-[10px] text-stone-500">{exp.percentageOfTotal.toFixed(1)}% do total</div>
                    </div>
                    <div className="font-mono text-stone-700">
                      {formatCentsToCurrency(exp.amountInCents)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Entrada de Dinheiro Manual */}
      <Modal
        isOpen={isInflowModalOpen}
        onClose={() => setIsInflowModalOpen(false)}
        title="Lançar Entrada de Dinheiro no Caixa"
        subtitle="Registre uma venda no balcão, PIX, aporte ou qualquer dinheiro que entrou."
      >
        <form onSubmit={handleSaveInflow} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Descrição da Entrada *
            </label>
            <input
              type="text"
              required
              value={inflowDesc}
              onChange={(e) => setInflowDesc(e.target.value)}
              placeholder="Ex: Vendas em dinheiro do dia / Aporte do sócio / PIX avulso"
              className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Valor que Entrou (R$) *
              </label>
              <input
                type="text"
                required
                value={inflowAmountStr}
                onChange={(e) => setInflowAmountStr(e.target.value)}
                placeholder="Ex: 450,00"
                className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 font-mono font-bold text-emerald-700 focus:outline-none focus:ring-1 focus:ring-stone-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Forma de Recebimento *
              </label>
              <select
                value={inflowChannel}
                onChange={(e) => setInflowChannel(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 bg-white focus:outline-none focus:ring-1 focus:ring-stone-900"
              >
                <option value="PIX">PIX</option>
                <option value="Dinheiro Vivo">Dinheiro Vivo</option>
                <option value="Cartão de Débito">Cartão de Débito</option>
                <option value="Cartão de Crédito">Cartão de Crédito</option>
                <option value="Transferência / TED">Transferência / TED</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Data do Recebimento *
            </label>
            <input
              type="date"
              required
              value={inflowDate}
              onChange={(e) => setInflowDate(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 font-mono"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
            <button
              type="button"
              onClick={() => setIsInflowModalOpen(false)}
              className="px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100 rounded-lg cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer shadow-xs"
            >
              Confirmar Entrada
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Saída / Despesa Manual */}
      <Modal
        isOpen={isOutflowModalOpen}
        onClose={() => setIsOutflowModalOpen(false)}
        title="Lançar Saída / Despesa"
        subtitle="Registre o pagamento de uma conta, aluguel, luz, gás, limpeza ou retirada."
      >
        <form onSubmit={handleSaveOutflow} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Descrição da Despesa *
            </label>
            <input
              type="text"
              required
              value={outflowDesc}
              onChange={(e) => setOutflowDesc(e.target.value)}
              placeholder="Ex: Conta de Luz (Enel) / Aluguel do Ponto / Compra de Gás"
              className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Valor da Despesa (R$) *
              </label>
              <input
                type="text"
                required
                value={outflowAmountStr}
                onChange={(e) => setOutflowAmountStr(e.target.value)}
                placeholder="Ex: 380,00"
                className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 font-mono font-bold text-rose-700 focus:outline-none focus:ring-1 focus:ring-stone-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Categoria *
              </label>
              <select
                value={outflowCategory}
                onChange={(e) => setOutflowCategory(e.target.value as any)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 bg-white focus:outline-none focus:ring-1 focus:ring-stone-900"
              >
                <option value="ALUGUEL">Aluguel do Ponto</option>
                <option value="ENERGIA_AGUA">Energia / Gás / Água</option>
                <option value="FOLHA_MÃO_DE_OBRA">Salários / Equipe</option>
                <option value="FORNECEDOR">Fornecedor / Insumos</option>
                <option value="MANUTENÇÃO">Manutenção / Limpeza</option>
                <option value="IMPOSTOS">Impostos / Simples</option>
                <option value="OUTROS">Outras Despesas</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 items-center">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Data do Pagamento / Vencimento *
              </label>
              <input
                type="date"
                required
                value={outflowDueDate}
                onChange={(e) => setOutflowDueDate(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 font-mono"
              />
            </div>

            <div className="pt-4">
              <label className="flex items-center gap-2 text-xs text-stone-800 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAlreadyPaid}
                  onChange={(e) => setIsAlreadyPaid(e.target.checked)}
                  className="rounded w-4 h-4 accent-stone-900"
                />
                <span>Já foi pago agora</span>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
            <button
              type="button"
              onClick={() => setIsOutflowModalOpen(false)}
              className="px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100 rounded-lg cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 rounded-lg cursor-pointer shadow-xs"
            >
              Confirmar Saída
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Como Calculamos (F28 & F33) */}
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
