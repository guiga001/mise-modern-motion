/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — Painel do Dono Detalhado com Períodos & 3 Tipos de Gráficos Nativos
 * Invariante: 100% de precisão matemática sem dependências externas frágeis.
 */

import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownLeft,
  Sparkles,
  ShoppingBag,
  ShoppingCart,
  Wallet,
  CheckCircle2,
  DollarSign,
  Plus,
  Layers,
  Calendar,
  BarChart3,
  LineChart,
  PieChart,
  Filter,
} from 'lucide-react';
import { MiseDatabaseState } from '../lib/storage';
import { Ingredient, Recipe } from '../domain/types';
import { calculateDRE } from '../domain/financial';
import { calculateRecipeCost } from '../domain/recipe';
import { calculateStockBalances } from '../domain/inventory';
import { calculateMenuEngineering } from '../domain/menu-engineering';
import { formatCentsToCurrency } from '../domain/units';
import {
  BarChartRevenueVsCost,
  LineChartCashFlow,
  DonutChartExpensesBreakdown,
  DailyBarData,
  DailyLineData,
  DonutSegment,
} from './DashboardCharts';
import { EmptyState } from './EmptyState';
import { TabKey } from './Navigation';
import { DataQualityCard } from './DataQualityCard';
import { ValueCenterCard } from './ValueCenterCard';
import { ThermometerCard } from './ThermometerCard';
import { MonthlyXRayModal } from './MonthlyXRayModal';
import { MonthlyClosingModal } from './MonthlyClosingModal';
import { ExplanationModal } from './ExplanationModal';
import { CostSimulatorModal } from './CostSimulatorModal';
import { NfeImportModal } from './NfeImportModal';
import { auditDataQuality } from '../domain/data-quality';
import { calculateUncostedRevenue } from '../domain/sales-intelligence';
import { calculateFefoExpirationRisk } from '../domain/inventory-intelligence';
import { calculateMarginReadjustment } from '../domain/cost-simulator';
import {
  calculateBusinessThermometer,
  evaluateMonthlyClosing,
  generateMonthlyXRayReport,
} from '../domain/governance-reports';
import { decomposeCmvVariance } from '../domain/cmv-decomposition';
import { appendAuditLog } from '../lib/storage';
import { DailyTask, ValueEvent, DomainExplanation } from '../domain/insights-types';
import { prioritizeDailyTasks } from '../domain/value-engine';
import { FileCode, Calculator } from 'lucide-react';

export type PeriodFilter = 'HOJE' | '7_DIAS' | '30_DIAS' | 'MES_ATUAL' | 'TUDO' | 'CUSTOM';

interface DashboardTabProps {
  database: MiseDatabaseState;
  onNavigate: (tab: TabKey, payload?: any) => void;
  onUpdateDatabase?: (newState: MiseDatabaseState) => void;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({ database, onNavigate, onUpdateDatabase }) => {
  const { activeStoreId, salesImports, stockMovements, payables, receivables, recipes, ingredients, stockLots, inventoryCounts } = database;

  // Modais de Inteligência
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [isNfeModalOpen, setIsNfeModalOpen] = useState(false);
  const [isXRayOpen, setIsXRayOpen] = useState(false);
  const [isClosingOpen, setIsClosingOpen] = useState(false);
  const [isExplanationOpen, setIsExplanationOpen] = useState(false);
  const [activeExplanation, setActiveExplanation] = useState<{ title: string; explanation: DomainExplanation<any> } | null>(null);

  // Estado do Filtro de Período
  const [period, setPeriod] = useState<PeriodFilter>('30_DIAS');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // 1. Calcular intervalo de datas do filtro
  const dateRange = useMemo(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const todayStr = today.toISOString().split('T')[0];

    if (period === 'HOJE') {
      return { start: todayStr, end: todayStr, label: 'Hoje' };
    }

    if (period === '7_DIAS') {
      const past = new Date(today);
      past.setDate(today.getDate() - 6);
      past.setHours(0, 0, 0, 0);
      return { start: past.toISOString().split('T')[0], end: todayStr, label: 'Últimos 7 dias' };
    }

    if (period === '30_DIAS') {
      const past = new Date(today);
      past.setDate(today.getDate() - 29);
      past.setHours(0, 0, 0, 0);
      return { start: past.toISOString().split('T')[0], end: todayStr, label: 'Últimos 30 dias' };
    }

    if (period === 'MES_ATUAL') {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      return {
        start: startOfMonth.toISOString().split('T')[0],
        end: todayStr,
        label: 'Mês Atual',
      };
    }

    if (period === 'CUSTOM' && customStartDate && customEndDate) {
      return {
        start: customStartDate,
        end: customEndDate,
        label: `${customStartDate.split('-').reverse().join('/')} a ${customEndDate.split('-').reverse().join('/')}`,
      };
    }

    return { start: '2020-01-01', end: '2030-12-31', label: 'Todo o Período' };
  }, [period, customStartDate, customEndDate]);

  // 2. Filtrar dados pelo período selecionado
  const filteredSales = useMemo(() => {
    return salesImports.filter(s => {
      const isStore = activeStoreId === 'CONSOLIDATED' || s.storeId === activeStoreId;
      const date = s.periodStartDate || s.importedAt.split('T')[0];
      const inRange = date >= dateRange.start && date <= dateRange.end;
      return isStore && inRange;
    });
  }, [salesImports, activeStoreId, dateRange]);

  const filteredMovements = useMemo(() => {
    return stockMovements.filter(m => {
      const isStore = activeStoreId === 'CONSOLIDATED' || m.storeId === activeStoreId;
      const date = m.createdAt.split('T')[0];
      const inRange = date >= dateRange.start && date <= dateRange.end;
      return isStore && inRange;
    });
  }, [stockMovements, activeStoreId, dateRange]);

  const filteredPayables = useMemo(() => {
    return payables.filter(p => {
      const isStore = activeStoreId === 'CONSOLIDATED' || p.storeId === activeStoreId;
      const date = p.paidDate || p.dueDate;
      const inRange = date >= dateRange.start && date <= dateRange.end;
      return isStore && inRange;
    });
  }, [payables, activeStoreId, dateRange]);

  const filteredReceivables = useMemo(() => {
    return receivables.filter(r => {
      const isStore = activeStoreId === 'CONSOLIDATED' || r.storeId === activeStoreId;
      const date = r.receivedDate || r.dueDate;
      const inRange = date >= dateRange.start && date <= dateRange.end;
      return isStore && inRange;
    });
  }, [receivables, activeStoreId, dateRange]);

  // 3. DRE do Período
  const dre = useMemo(() => {
    return calculateDRE(
      dateRange.label,
      activeStoreId,
      filteredSales,
      filteredMovements,
      filteredPayables,
      0,
      filteredReceivables
    );
  }, [dateRange.label, activeStoreId, filteredSales, filteredMovements, filteredPayables, filteredReceivables]);

  // 4. Saldos de Estoque e Alertas de Ruptura
  const stockBalances = useMemo(() => {
    if (activeStoreId === 'CONSOLIDATED') {
      const map = new Map();
      for (const st of database.stores) {
        const storeMap = calculateStockBalances(st.id, ingredients, stockMovements);
        storeMap.forEach((v, k) => {
          if (!map.has(k)) map.set(k, { ...v });
          else {
            const cur = map.get(k);
            cur.currentBalanceInBaseUnit += v.currentBalanceInBaseUnit;
            cur.totalValueInCents += v.totalValueInCents;
            cur.isBelowMinimum = cur.currentBalanceInBaseUnit < cur.minimumStock;
          }
        });
      }
      return map;
    }
    return calculateStockBalances(activeStoreId, ingredients, stockMovements);
  }, [activeStoreId, database.stores, ingredients, stockMovements]);

  // 5. Fichas Técnicas & Custos
  const recipeCostsMap = useMemo(() => {
    const ingMap = new Map(ingredients.map(i => [i.id, i]));
    const recMap = new Map(recipes.map(r => [r.id, r]));
    const costs = new Map();
    recipes.forEach(r => {
      try {
        costs.set(r.id, calculateRecipeCost(r, ingMap, recMap));
      } catch {
        // Ignora
      }
    });
    return costs;
  }, [ingredients, recipes]);

  // 6. Engenharia de Cardápio
  const menuEngineering = useMemo(() => {
    return calculateMenuEngineering(recipes, recipeCostsMap, filteredSales, activeStoreId);
  }, [recipes, recipeCostsMap, filteredSales, activeStoreId]);

  // 7. Preparação dos dados para os 3 Gráficos:

  // GRÁFICO 1: Barras (Faturamento vs CMV vs Lucro por Dia)
  const barChartData: DailyBarData[] = useMemo(() => {
    const dayMap = new Map<string, { rev: number; cmv: number; profit: number }>();

    // Vendas e entradas
    for (const s of filteredSales) {
      const d = s.periodStartDate || s.importedAt.split('T')[0];
      const cur = dayMap.get(d) || { rev: 0, cmv: 0, profit: 0 };
      cur.rev += s.totalNetInCents;
      dayMap.set(d, cur);
    }
    for (const r of filteredReceivables.filter(r => r.status === 'RECEIVED')) {
      const d = r.receivedDate || r.dueDate;
      const cur = dayMap.get(d) || { rev: 0, cmv: 0, profit: 0 };
      cur.rev += r.amountInCents;
      dayMap.set(d, cur);
    }

    // CMV por dia
    for (const m of filteredMovements) {
      if (m.type === 'SALES_CONSUMPTION' || m.type === 'WASTE') {
        const d = m.createdAt.split('T')[0];
        const cur = dayMap.get(d) || { rev: 0, cmv: 0, profit: 0 };
        cur.cmv += Math.abs(m.totalCostInCents);
        dayMap.set(d, cur);
      }
    }

    const sortedDates = Array.from(dayMap.keys()).sort();
    return sortedDates.map(d => {
      const val = dayMap.get(d)!;
      return {
        dateLabel: d.split('-').reverse().slice(0, 2).join('/'),
        grossRevenueInCents: val.rev,
        cmvInCents: val.cmv,
        netProfitInCents: val.rev - val.cmv,
      };
    });
  }, [filteredSales, filteredReceivables, filteredMovements]);

  // GRÁFICO 2: Linha/Área (Evolução Contínua do Saldo de Caixa)
  const lineChartData: DailyLineData[] = useMemo(() => {
    const dayDeltaMap = new Map<string, number>();

    for (const s of filteredSales) {
      const d = s.periodStartDate || s.importedAt.split('T')[0];
      dayDeltaMap.set(d, (dayDeltaMap.get(d) || 0) + s.totalNetInCents);
    }
    for (const r of filteredReceivables.filter(r => r.status === 'RECEIVED')) {
      const d = r.receivedDate || r.dueDate;
      dayDeltaMap.set(d, (dayDeltaMap.get(d) || 0) + r.amountInCents);
    }
    for (const p of filteredPayables.filter(p => p.status === 'PAID')) {
      const d = p.paidDate || p.dueDate;
      dayDeltaMap.set(d, (dayDeltaMap.get(d) || 0) - p.amountInCents);
    }

    const sortedDates = Array.from(dayDeltaMap.keys()).sort();
    let rolling = 0;
    return sortedDates.map(d => {
      rolling += dayDeltaMap.get(d)!;
      return {
        dateLabel: d.split('-').reverse().slice(0, 2).join('/'),
        balanceInCents: rolling,
      };
    });
  }, [filteredSales, filteredReceivables, filteredPayables]);

  // GRÁFICO 3: Rosca (Donut) - Destino de Cada Real Gasto
  const donutSegments: DonutSegment[] = useMemo(() => {
    let rentInCents = 0;
    let utilitiesInCents = 0;
    let laborInCents = 0;
    let otherInCents = 0;

    for (const p of filteredPayables.filter(p => p.status !== 'CANCELLED')) {
      if (p.category === 'ALUGUEL') rentInCents += p.amountInCents;
      else if (p.category === 'ENERGIA_AGUA') utilitiesInCents += p.amountInCents;
      else if (p.category === 'FOLHA_MÃO_DE_OBRA') laborInCents += p.amountInCents;
      else if (p.category !== 'FORNECEDOR') otherInCents += p.amountInCents;
    }

    return [
      { label: 'Insumos & Matérias-Primas (CMV)', amountInCents: dre.cmvInCents, color: '#f59e0b' },
      { label: 'Aluguel do Ponto', amountInCents: rentInCents, color: '#3b82f6' },
      { label: 'Energia, Gás & Água', amountInCents: utilitiesInCents, color: '#8b5cf6' },
      { label: 'Salários & Mão de Obra', amountInCents: laborInCents, color: '#ec4899' },
      { label: 'Outras Despesas Operacionais', amountInCents: otherInCents, color: '#64748b' },
      { label: 'Lucro Líquido Retido', amountInCents: Math.max(0, dre.netOperatingResultInCents), color: '#059669' },
    ];
  }, [dre, filteredPayables]);

  // Métricas de apoio
  const totalOrders = filteredSales.reduce((sum, s) => sum + s.totalOrdersCount, 0);
  const averageTicketInCents = totalOrders > 0 ? Math.round(dre.grossRevenueInCents / totalOrders) : 0;

  // Alertas
  const lowStockCount = useMemo(() => {
    let count = 0;
    stockBalances.forEach(item => {
      if (item.isBelowMinimum) count++;
    });
    return count;
  }, [stockBalances]);

  const pendingBillsCount = useMemo(() => {
    return payables.filter(p => p.status === 'PENDING' && (activeStoreId === 'CONSOLIDATED' || p.storeId === activeStoreId)).length;
  }, [payables, activeStoreId]);

  // F51 Qualidade dos dados
  const dataQuality = useMemo(() => {
    return auditDataQuality(ingredients, recipes, salesImports, inventoryCounts || []);
  }, [ingredients, recipes, salesImports, inventoryCounts]);

  // F08 Receita sem custo
  const uncostedReport = useMemo(() => {
    const recMap = new Map<string, Recipe>(recipes.map(r => [r.id, r]));
    return calculateUncostedRevenue(filteredSales, recMap, database.productNameToRecipeIdMap || {});
  }, [filteredSales, recipes, database.productNameToRecipeIdMap]);

  // F14 Risco FEFO
  const fefoReport = useMemo(() => {
    const ingMap = new Map<string, Ingredient>(ingredients.map(i => [i.id, i]));
    const dailyMap: Record<string, number> = {};
    for (const s of filteredSales) {
      for (const line of s.lines) {
        if (line.mappedRecipeId) {
          const rec = recipes.find(r => r.id === line.mappedRecipeId);
          if (rec) {
            for (const rl of rec.lines) {
              if (rl.ingredientId) {
                dailyMap[rl.ingredientId] = (dailyMap[rl.ingredientId] || 0) + (rl.quantityInBaseUnit * rl.correctionFactor * line.quantity) / 30;
              }
            }
          }
        }
      }
    }
    return calculateFefoExpirationRisk(stockLots || [], ingMap, dailyMap);
  }, [stockLots, ingredients, filteredSales, recipes]);

  // F49 Tarefas diárias priorizadas por R$ em jogo
  const dynamicTasks: DailyTask[] = useMemo(() => {
    const list: DailyTask[] = [];

    if (uncostedReport.totalUncostedRevenueInCents > 0) {
      list.push({
        id: 'task_uncosted',
        code: 'F08_UNCOSTED',
        title: 'Mapear itens vendidos sem ficha técnica',
        description: `${formatCentsToCurrency(uncostedReport.totalUncostedRevenueInCents)} (${uncostedReport.uncostedPercentage}%) da sua receita está sem custo apurado.`,
        amountInPlayInCents: uncostedReport.totalUncostedRevenueInCents,
        actionLabel: 'Mapear Itens',
        actionTab: 'sales',
        explanation: uncostedReport.explanation,
        completed: false,
      });
    }

    if (fefoReport.totalAmountAtRiskInCents > 0) {
      list.push({
        id: 'task_fefo',
        code: 'F14_FEFO',
        title: 'Promover lotes próximos ao vencimento',
        description: `${fefoReport.items.length} lote(s) correm risco de vencer antes do consumo total pela demanda.`,
        amountInPlayInCents: fefoReport.totalAmountAtRiskInCents,
        urgencyDays: fefoReport.items[0]?.daysRemaining,
        actionLabel: 'Ver Lotes',
        actionTab: 'inventory',
        explanation: fefoReport.explanation,
        completed: false,
      });
    }

    if (lowStockCount > 0) {
      list.push({
        id: 'task_stock',
        code: 'F10_RUPTURE',
        title: 'Repor insumos com risco de ruptura',
        description: `${lowStockCount} insumo(s) estão abaixo do estoque mínimo de segurança.`,
        amountInPlayInCents: lowStockCount * 25000,
        actionLabel: 'Fazer Pedido',
        actionTab: 'purchases',
        explanation: {
          valor: lowStockCount * 25000,
          unidade: 'centavos',
          formula: 'RiscoRuptura = Saldo < EstoqueMínimo',
          entradas: { insumosAbaixoMinimo: lowStockCount },
          passos: [`${lowStockCount} insumos com saldo inferior à quantidade de segurança configurada.`],
          suficienciaDeDados: { suficiente: true, percentualConfiabilidade: 100 },
          confianca: 'ALTA',
        },
        completed: false,
      });
    }

    const stored = database.dailyTasks || [];
    const merged = [...list];
    for (const st of stored) {
      if (!merged.some(m => m.id === st.id)) {
        merged.push(st);
      }
    }

    return prioritizeDailyTasks(merged);
  }, [uncostedReport, fefoReport, lowStockCount, database.dailyTasks]);

  // Eventos de valor para F48
  const valueEvents: ValueEvent[] = useMemo(() => {
    const list: ValueEvent[] = [...(database.valueEvents || [])];

    if (uncostedReport.totalUncostedRevenueInCents > 0 && !list.some(e => e.id === 'val_uncosted')) {
      list.push({
        id: 'val_uncosted',
        type: 'IDENTIFICADO',
        category: 'REAJUSTE_PRECO',
        title: 'Recuperação de margem às cegas',
        description: 'Vendas sem ficha técnica identificadas para precificação correta.',
        amountInCents: uncostedReport.totalUncostedRevenueInCents,
        minutesSaved: 15,
        createdAt: new Date().toISOString(),
        explanation: uncostedReport.explanation,
      });
    }

    if (fefoReport.totalAmountAtRiskInCents > 0 && !list.some(e => e.id === 'val_fefo')) {
      list.push({
        id: 'val_fefo',
        type: 'IDENTIFICADO',
        category: 'PERDA_EVITADA',
        title: 'Prevenção de descarte de lotes',
        description: 'Lotes monitorados por FEFO antes da data de validade.',
        amountInCents: fefoReport.totalAmountAtRiskInCents,
        minutesSaved: 20,
        createdAt: new Date().toISOString(),
        explanation: fefoReport.explanation,
      });
    }

    const totalImportsCount = salesImports.length + stockMovements.filter(m => m.type === 'PURCHASE_RECEIPT').length;
    if (totalImportsCount > 0 && !list.some(e => e.id === 'val_automation_time')) {
      list.push({
        id: 'val_automation_time',
        type: 'REALIZADO',
        category: 'TEMPO_ECONOMIZADO',
        title: 'Automações de Importação & Baixa',
        description: `${totalImportsCount} lançamentos integrados e calculados automaticamente.`,
        amountInCents: 0,
        minutesSaved: totalImportsCount * 15,
        createdAt: new Date().toISOString(),
        explanation: {
          valor: totalImportsCount * 15,
          unidade: 'minutos',
          formula: 'Minutos = LançamentosAutomatizados × 15 min',
          entradas: { totalLançamentos: totalImportsCount },
          passos: [`${totalImportsCount} operações registradas sem digitação manual de cada ingrediente.`],
          suficienciaDeDados: { suficiente: true, percentualConfiabilidade: 100 },
          confianca: 'ALTA',
        },
      });
    }

    return list;
  }, [database.valueEvents, uncostedReport, fefoReport, salesImports.length, stockMovements]);

  const handleCompleteTask = (task: DailyTask) => {
    const updatedTasks = (database.dailyTasks || []).map(t =>
      t.id === task.id ? { ...t, completed: true } : t
    );
    if (!updatedTasks.some(t => t.id === task.id)) {
      updatedTasks.push({ ...task, completed: true });
    }

    const newEvent: ValueEvent = {
      id: `realized_${Date.now()}`,
      type: 'REALIZADO',
      category: 'PERDA_EVITADA',
      title: `Ação Concluída: ${task.title}`,
      description: task.description,
      amountInCents: task.amountInPlayInCents,
      minutesSaved: 20,
      createdAt: new Date().toISOString(),
      explanation: task.explanation,
    };

    const newState: MiseDatabaseState = {
      ...database,
      dailyTasks: updatedTasks,
      valueEvents: [...(database.valueEvents || []), newEvent],
    };

    if (onUpdateDatabase) {
      onUpdateDatabase(newState);
    }
  };

  // Mapear volume mensal de receitas para o simulador
  const monthlySalesVolume = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of filteredSales) {
      for (const line of s.lines) {
        if (line.mappedRecipeId) {
          map[line.mappedRecipeId] = (map[line.mappedRecipeId] || 0) + line.quantity;
        }
      }
    }
    return map;
  }, [filteredSales]);

  // Termômetro do Negócio (F50)
  const thermometerResult = useMemo(() => {
    const actualCmvPct = dre.cmvPercentage || 0;
    const targetCmvPct = 32;
    let marginOfSafetyPct = 25;
    const breakEven = dre.grossMarginPercentage > 0
      ? Math.round((dre.operatingExpensesInCents * 100) / dre.grossMarginPercentage)
      : 0;
    if (dre.grossRevenueInCents > 0 && breakEven > 0) {
      marginOfSafetyPct = Math.max(0, Math.min(100, Math.round(((dre.grossRevenueInCents - breakEven) / dre.grossRevenueInCents) * 100)));
    }
    const totalDailyExpense = filteredPayables.length > 0 ? (dre.operatingExpensesInCents / Math.max(1, filteredPayables.length)) : 10000;
    const endingCash = lineChartData.length > 0 ? (lineChartData[lineChartData.length - 1]?.balanceInCents || 0) : 0;
    const cashRunwayDays = totalDailyExpense > 0 ? Math.max(1, Math.min(90, Math.round(Math.max(0, endingCash) / totalDailyExpense))) : 30;

    return calculateBusinessThermometer(
      actualCmvPct,
      targetCmvPct,
      marginOfSafetyPct,
      cashRunwayDays,
      2.5,
      0.8
    );
  }, [dre, filteredPayables.length, lineChartData]);

  // Fechamento Mensal Guiado (F46)
  const currentMonthYear = useMemo(() => {
    return dateRange.end.substring(0, 7);
  }, [dateRange.end]);

  const isCurrentPeriodLocked = useMemo(() => {
    return (database.lockedPeriods || []).includes(currentMonthYear);
  }, [database.lockedPeriods, currentMonthYear]);

  const closingResult = useMemo(() => {
    const salesDatesInMonth = new Set(
      filteredSales
        .map(s => s.periodStartDate || s.importedAt.split('T')[0])
        .filter(d => d.startsWith(currentMonthYear))
    );
    const unclassifiedPayables = filteredPayables.filter(p => !p.category || p.category === 'OUTROS').length;
    const monthCounts = (inventoryCounts || []).filter(c => c.date.startsWith(currentMonthYear)).length;
    const uncostedPct = uncostedReport.uncostedPercentage;

    return evaluateMonthlyClosing(
      currentMonthYear,
      salesDatesInMonth.size,
      30,
      unclassifiedPayables,
      monthCounts,
      uncostedPct,
      isCurrentPeriodLocked
    );
  }, [filteredSales, currentMonthYear, filteredPayables, inventoryCounts, uncostedReport.uncostedPercentage, isCurrentPeriodLocked]);

  // F52 Relatório Raio-X do Mês
  const xrayReport = useMemo(() => {
    const cmvDecomp = decomposeCmvVariance([], 0, 0);
    return generateMonthlyXRayReport(
      dateRange.label,
      dre,
      cmvDecomp,
      thermometerResult.overallScore,
      dynamicTasks,
      valueEvents
    );
  }, [dateRange.label, dre, thermometerResult.overallScore, dynamicTasks, valueEvents]);

  const handleLockPeriod = (monthYear: string) => {
    if (!onUpdateDatabase) return;
    const existing = database.lockedPeriods || [];
    if (!existing.includes(monthYear)) {
      const updatedState = {
        ...database,
        lockedPeriods: [...existing, monthYear],
      };
      const loggedState = appendAuditLog(
        updatedState,
        'LOCK_PERIOD',
        'FinancialPeriod',
        monthYear,
        `Período ${monthYear} travado para fechamento e auditoria contábil.`
      );
      onUpdateDatabase(loggedState);
    }
  };

  const handleUnlockPeriod = (monthYear: string, reason: string) => {
    if (!onUpdateDatabase) return;
    const existing = database.lockedPeriods || [];
    const updatedState = {
      ...database,
      lockedPeriods: existing.filter(p => p !== monthYear),
    };
    const loggedState = appendAuditLog(
      updatedState,
      'UNLOCK_PERIOD',
      'FinancialPeriod',
      monthYear,
      `Período ${monthYear} destravado com justificativa: ${reason}`
    );
    onUpdateDatabase(loggedState);
  };

  return (
    <div className="py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">
      {/* Central de Valor e Fila Faça Hoje (F48, F49) */}
      <ValueCenterCard
        tasks={dynamicTasks}
        events={valueEvents}
        onCompleteTask={handleCompleteTask}
        onNavigateTab={(tab) => onNavigate(tab)}
      />

      {/* Termômetro do Negócio (F50) */}
      <ThermometerCard
        thermometer={thermometerResult}
        onOpenXRay={() => setIsXRayOpen(true)}
        onOpenClosing={() => setIsClosingOpen(true)}
        onOpenExplanation={() => {
          setActiveExplanation({
            title: 'F50 · Termômetro do Negócio',
            explanation: thermometerResult.explanation,
          });
          setIsExplanationOpen(true);
        }}
      />

      {/* Auditoria de Qualidade dos Dados (F51) */}
      <DataQualityCard report={dataQuality} onNavigateTab={onNavigate} />
      {/* Top Header & Seletor de Períodos */}
      <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
              Painel do Proprietário
            </span>
            <h2 className="text-xl font-bold text-stone-900 tracking-tight mt-0.5">
              Inteligência Financeira & Operacional
            </h2>
          </div>

          {/* Botões do Seletor de Período */}
          <div className="flex flex-wrap items-center gap-1.5 bg-stone-100 p-1 rounded-xl">
            {(
              [
                { key: 'HOJE', label: 'Hoje' },
                { key: '7_DIAS', label: '7 Dias' },
                { key: '30_DIAS', label: '30 Dias' },
                { key: 'MES_ATUAL', label: 'Mês Atual' },
                { key: 'TUDO', label: 'Tudo' },
                { key: 'CUSTOM', label: 'Personalizado' },
              ] as const
            ).map(opt => (
              <button
                key={opt.key}
                onClick={() => setPeriod(opt.key)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  period === opt.key
                    ? 'bg-white text-stone-900 shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Input de datas quando 'CUSTOM' está selecionado */}
        {period === 'CUSTOM' && (
          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-stone-100 text-xs">
            <span className="text-stone-600 font-medium">Filtrar de:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-stone-300 font-mono"
            />
            <span className="text-stone-600 font-medium">até:</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-stone-300 font-mono"
            />
          </div>
        )}

        {/* Barra de Ações Rápidas (100% Manual + Inteligência) */}
        <div className="pt-2 border-t border-stone-100 grid grid-cols-2 sm:grid-cols-6 gap-2.5">
          <button
            onClick={() => onNavigate('sales')}
            className="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 transition-colors font-bold text-xs cursor-pointer"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-emerald-700 stroke-[2.2]" />
            <span>+ Venda</span>
          </button>

          <button
            onClick={() => onNavigate('purchases')}
            className="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 transition-colors font-bold text-xs cursor-pointer"
          >
            <ShoppingCart className="w-3.5 h-3.5 text-blue-700 stroke-[2.2]" />
            <span>+ Compra</span>
          </button>

          <button
            onClick={() => onNavigate('financial')}
            className="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 transition-colors font-bold text-xs cursor-pointer"
          >
            <ArrowDownLeft className="w-3.5 h-3.5 text-amber-700 stroke-[2.2]" />
            <span>+ Caixa</span>
          </button>

          <button
            onClick={() => onNavigate('financial')}
            className="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-900 border border-stone-300 transition-colors font-bold text-xs cursor-pointer"
          >
            <ArrowUpRight className="w-3.5 h-3.5 text-stone-700 stroke-[2.2]" />
            <span>+ Despesa</span>
          </button>

          <button
            onClick={() => setIsSimulatorOpen(true)}
            className="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 transition-colors font-bold text-xs cursor-pointer"
          >
            <Calculator className="w-3.5 h-3.5 text-purple-700 stroke-[2.2]" />
            <span>Simulador "E se?"</span>
          </button>

          <button
            onClick={() => setIsNfeModalOpen(true)}
            className="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-200 transition-colors font-bold text-xs cursor-pointer"
          >
            <FileCode className="w-3.5 h-3.5 text-teal-700 stroke-[2.2]" />
            <span>XML NF-e (F44)</span>
          </button>
        </div>
      </div>

      {/* Cartões Chave de Desempenho no Período */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Faturamento Bruto & Líquido */}
        <div className="bg-white p-5 rounded-xl border border-stone-200/80 shadow-2xs">
          <span className="text-xs font-semibold text-stone-500">Faturamento no Período</span>
          <div className="mt-2 text-xl sm:text-2xl font-bold text-stone-900 font-mono">
            {formatCentsToCurrency(dre.grossRevenueInCents)}
          </div>
          <div className="mt-1 text-[11px] text-stone-500 flex items-center justify-between">
            <span>Líquido: {formatCentsToCurrency(dre.netRevenueInCents)}</span>
            <span className="font-mono">{totalOrders} vendas</span>
          </div>
        </div>

        {/* CMV Real */}
        <div className="bg-white p-5 rounded-xl border border-stone-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500">Custo dos Insumos (CMV)</span>
            <span className={`text-xs font-bold font-mono ${dre.cmvPercentage <= 35 ? 'text-emerald-700' : 'text-rose-700'}`}>
              {dre.cmvPercentage.toFixed(1)}%
            </span>
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-bold text-stone-800 font-mono">
            {formatCentsToCurrency(dre.cmvInCents)}
          </div>
          <p className="mt-1 text-[11px] text-stone-400">
            {dre.cmvPercentage <= 35 ? '✔ Margem de insumo sob controle' : 'Atenção aos custos de compras'}
          </p>
        </div>

        {/* Despesas Fixas */}
        <div className="bg-white p-5 rounded-xl border border-stone-200/80 shadow-2xs">
          <span className="text-xs font-semibold text-stone-500">Contas & Despesas Fixas</span>
          <div className="mt-2 text-xl sm:text-2xl font-bold text-stone-800 font-mono">
            {formatCentsToCurrency(dre.operatingExpensesInCents)}
          </div>
          <p className="mt-1 text-[11px] text-stone-400">
            Aluguel, equipe, luz, gás, água
          </p>
        </div>

        {/* Lucro Limpo no Bolso */}
        <div className={`p-5 rounded-xl border shadow-2xs ${
          dre.netOperatingResultInCents >= 0 ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950' : 'bg-rose-50/70 border-rose-200 text-rose-950'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider">Lucro Real no Bolso</span>
            <span className="text-xs font-mono font-bold">{dre.netMarginPercentage.toFixed(1)}%</span>
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-bold font-mono">
            {formatCentsToCurrency(dre.netOperatingResultInCents)}
          </div>
          <p className="mt-1 text-[11px] opacity-80">
            {dre.netOperatingResultInCents >= 0 ? 'Resultado operacional positivo' : 'Prejuízo no período'}
          </p>
        </div>
      </div>

      {/* OS TRÊS GRÁFICOS SOLICITADOS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* GRÁFICO 1: BARRAS - FATURAMENTO vs CMV vs LUCRO */}
        <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-stone-900">
                1. Faturamento vs Custo de Insumos vs Lucro
              </h3>
            </div>
            <span className="text-[11px] text-stone-500">Gráfico de Barras</span>
          </div>
          <BarChartRevenueVsCost data={barChartData} />
        </div>

        {/* GRÁFICO 2: LINHA - EVOLUÇÃO CONTÍNUA DO FLUXO DE CAIXA */}
        <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <div className="flex items-center gap-2">
              <LineChart className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-stone-900">
                2. Evolução do Saldo do Caixa
              </h3>
            </div>
            <span className="text-[11px] text-stone-500">Gráfico de Linha & Área</span>
          </div>
          <LineChartCashFlow data={lineChartData} />
        </div>
      </div>

      {/* GRÁFICO 3: ROSCA (DONUT) - ONDE FOI PARAR O DINHEIRO */}
      <div className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <PieChart className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-bold text-stone-900">
              3. Destino do Dinheiro: Composição de Custos & Despesas
            </h3>
          </div>
          <span className="text-[11px] text-stone-500">Gráfico de Rosca (Donut)</span>
        </div>
        <DonutChartExpensesBreakdown
          segments={donutSegments}
          totalRevenueInCents={dre.grossRevenueInCents}
        />
      </div>

      {/* Engenharia de Cardápio: Quais pratos dão mais lucro no período */}
      <div className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-bold text-stone-900">
              Ranking de Lucratividade dos Pratos ({dateRange.label})
            </h3>
          </div>
          <button
            onClick={() => onNavigate('recipes')}
            className="text-xs font-semibold text-stone-700 hover:text-stone-900 underline cursor-pointer"
          >
            Ver Fichas Técnicas
          </button>
        </div>

        {menuEngineering.length === 0 ? (
          <div className="py-6 text-center text-xs text-stone-400">
            Cadastre fichas técnicas na aba "Fichas & Cardápio" e lance vendas para ver o ranking de lucratividade de cada prato.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {menuEngineering.slice(0, 4).map((item) => (
              <div key={item.recipeId} className="p-3.5 rounded-lg border border-stone-100 bg-stone-50/60 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-stone-900">{item.name}</div>
                  <div className="text-[11px] text-stone-500 mt-0.5">
                    Vendeu: {item.salesVolume}x · Custo por porção: {formatCentsToCurrency(item.unitCmvInCents)} · Lucro: {formatCentsToCurrency(item.unitContributionMarginInCents)}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono font-bold text-emerald-700">
                    {item.marginPercentage}% margem
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Alertas Operacionais */}
      {(lowStockCount > 0 || pendingBillsCount > 0) && (
        <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-800">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-amber-900">Pontos de Atenção na Operação</h4>
              <p className="text-xs text-amber-800 mt-0.5">
                {lowStockCount > 0 && `${lowStockCount} insumo(s) acabando no estoque. `}
                {pendingBillsCount > 0 && `${pendingBillsCount} conta(s) a pagar pendentes.`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {lowStockCount > 0 && (
              <button
                onClick={() => onNavigate('inventory')}
                className="px-3 py-1.5 text-xs font-bold text-amber-900 bg-amber-200/80 hover:bg-amber-200 rounded-lg transition-colors cursor-pointer"
              >
                Ver Estoque
              </button>
            )}
            {pendingBillsCount > 0 && (
              <button
                onClick={() => onNavigate('financial')}
                className="px-3 py-1.5 text-xs font-bold text-amber-900 bg-amber-200/80 hover:bg-amber-200 rounded-lg transition-colors cursor-pointer"
              >
                Ver Contas
              </button>
            )}
          </div>
        </div>
      )}

      {/* Modais de Inteligência Onda 1 */}
      {isSimulatorOpen && (
        <CostSimulatorModal
          isOpen={isSimulatorOpen}
          onClose={() => setIsSimulatorOpen(false)}
          ingredients={ingredients}
          recipes={recipes}
          monthlySalesVolume={monthlySalesVolume}
        />
      )}

      {isNfeModalOpen && (
        <NfeImportModal
          isOpen={isNfeModalOpen}
          onClose={() => setIsNfeModalOpen(false)}
          database={database}
          onImportSuccess={(newState) => {
            if (onUpdateDatabase) onUpdateDatabase(newState);
          }}
        />
      )}

      {/* F52 Relatório Raio-X do Mês */}
      {isXRayOpen && (
        <MonthlyXRayModal
          isOpen={isXRayOpen}
          onClose={() => setIsXRayOpen(false)}
          report={xrayReport}
        />
      )}

      {/* F46 Fechamento Mensal Guiado */}
      {isClosingOpen && (
        <MonthlyClosingModal
          isOpen={isClosingOpen}
          onClose={() => setIsClosingOpen(false)}
          closingData={closingResult}
          onLockPeriod={handleLockPeriod}
          onUnlockPeriod={handleUnlockPeriod}
          onOpenExplanation={() => {
            setActiveExplanation({
              title: 'F46 · Fechamento Mensal Guiado',
              explanation: closingResult.explanation,
            });
            setIsExplanationOpen(true);
          }}
        />
      )}

      {/* Modal Universal Como Calculamos */}
      {isExplanationOpen && activeExplanation && (
        <ExplanationModal
          isOpen={isExplanationOpen}
          onClose={() => {
            setIsExplanationOpen(false);
            setActiveExplanation(null);
          }}
          title={activeExplanation.title}
          explanation={activeExplanation.explanation}
        />
      )}
    </div>
  );
};
