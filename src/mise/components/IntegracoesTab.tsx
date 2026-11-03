/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — Aba de Integrações de Delivery (iFood e 99Food)
 * Gestão completa da operação de delivery: Pedidos em Tempo Real, Vendas, Comissões,
 * Filtros Avançados, Teste de Conexão e sincronização direta com o sistema Mise.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  UtensilsCrossed,
  RefreshCw,
  Search,
  Filter,
  DollarSign,
  TrendingUp,
  Percent,
  Clock,
  MapPin,
  Phone,
  Printer,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Download,
  Share2,
  Store,
  Check,
  Copy,
  ChevronRight,
  ExternalLink,
  PlusCircle,
  Truck,
  PackageCheck,
  Ban,
  Radio,
  SlidersHorizontal,
  Layers,
  Trash2,
  ShieldCheck,
  Sparkles,
  LogOut,
  PlayCircle,
  Key,
  Lock,
} from 'lucide-react';
import { MiseDatabaseState } from '../lib/storage';
import {
  DeliveryChannel,
  DeliveryOrder,
  DeliveryOrderStatus,
  DeliveryChannelConfig,
  DeliveryFilterOptions,
  DeliveryMetricsSummary,
} from '../domain/delivery-types';
import { deliveryApi } from '../lib/delivery-api';
import { DeliveryReceiptModal } from './DeliveryReceiptModal';
import { DeliveryOrderDetailModal } from './DeliveryOrderDetailModal';
import { DeliveryOAuthModal } from './DeliveryOAuthModal';
import { IfoodLogo, Food99Logo, ChannelBadge } from './DeliveryLogos';
import { SalesImport } from '../domain/types';

interface IntegracoesTabProps {
  database: MiseDatabaseState;
  onUpdateDatabase: (newState: MiseDatabaseState) => void;
}

type SubTabKey = 'orders' | 'sales' | 'ifood' | 'food99';

export const IntegracoesTab: React.FC<IntegracoesTabProps> = ({
  database,
  onUpdateDatabase,
}) => {
  const companyId = database.company?.id || 'mise_default_company';
  const restaurantName = database.company?.name || 'Mise Cozinha & Delivery';

  const [activeSubTab, setActiveSubTab] = useState<SubTabKey>('orders');
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [metrics, setMetrics] = useState<DeliveryMetricsSummary | null>(null);
  const [configs, setConfigs] = useState<{
    ifood: DeliveryChannelConfig;
    food99: DeliveryChannelConfig;
  } | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Filtros de Pedidos
  const [filterChannel, setFilterChannel] = useState<DeliveryChannel | 'ALL'>('ALL');
  const [filterStatus, setFilterStatus] = useState<DeliveryOrderStatus | 'ALL' | 'ACTIVE'>('ALL');
  const [filterPeriod, setFilterPeriod] = useState<
    'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'THIS_MONTH' | 'ALL'
  >('TODAY');
  const [filterLogistics, setFilterLogistics] = useState<'OWN_DELIVERY' | 'MARKETPLACE_DELIVERY' | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modais
  const [selectedOrderForDetail, setSelectedOrderForDetail] = useState<DeliveryOrder | null>(null);
  const [selectedOrderForPrint, setSelectedOrderForPrint] = useState<DeliveryOrder | null>(null);

  // Estado de Formulário de Configurações
  const [ifoodForm, setIfoodForm] = useState<Partial<DeliveryChannelConfig>>({});
  const [food99Form, setFood99Form] = useState<Partial<DeliveryChannelConfig>>({});
  const [testStatusMessage, setTestStatusMessage] = useState<{ channel: DeliveryChannel; text: string; ok: boolean } | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState<'ifood' | 'food99' | null>(null);
  const [oauthModalChannel, setOauthModalChannel] = useState<DeliveryChannel | null>(null);
  const [isSimulatingOrder, setIsSimulatingOrder] = useState<boolean>(false);

  const handleSimulateTestOrder = async (channel: DeliveryChannel) => {
    try {
      setIsSimulatingOrder(true);
      const res = await deliveryApi.simulateTestOrder(companyId, channel);
      setSyncFeedback(`✓ ${res.message}`);
      await loadData();
      setActiveSubTab('orders');
    } catch (err: any) {
      setSyncFeedback(`Erro ao gerar pedido de teste: ${err?.message || 'Erro inesperado'}`);
    } finally {
      setIsSimulatingOrder(false);
    }
  };

  const handleDisconnectOAuth = async (channel: DeliveryChannel) => {
    const brand = channel === 'IFOOD' ? 'iFood' : '99Food';
    if (!window.confirm(`Tem certeza que deseja desconectar o canal ${brand}? Os pedidos deste canal deixarão de sincronizar.`)) {
      return;
    }
    try {
      const res = await deliveryApi.disconnectOAuth(companyId, channel);
      setConfigs((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          [channel === 'IFOOD' ? 'ifood' : 'food99']: res.config,
        };
      });
      setSyncFeedback(`Canal ${brand} desconectado com sucesso.`);
    } catch (err: any) {
      alert(`Erro ao desconectar: ${err?.message || 'Erro inesperado'}`);
    }
  };

  // Carregar dados iniciais
  const loadData = async () => {
    try {
      setIsLoading(true);
      const [fetchedConfigs, fetchedOrders, fetchedMetrics] = await Promise.all([
        deliveryApi.getConfigs(companyId).catch(() => null),
        deliveryApi.getOrders(companyId, {
          channel: filterChannel,
          status: filterStatus,
          period: filterPeriod,
          logisticsType: filterLogistics,
          searchTerm,
        }).catch(() => []),
        deliveryApi.getMetrics(companyId, 'today').catch(() => null),
      ]);

      if (fetchedConfigs) {
        setConfigs(fetchedConfigs);
        setIfoodForm(fetchedConfigs.ifood);
        setFood99Form(fetchedConfigs.food99);
      }
      const sampleCustomerNames = new Set([
        'Mariana Silveira',
        'Rafael Mendes',
        'Camila Alcantara',
        'Bruno Henrique',
        'Juliana Paes',
        'Thiago Nogueira',
        'Carolina Nogueira',
        'Eduardo Vasconcelos',
        'Beatriz Meneghel',
        'Rodrigo Amaral',
        'Larissa Fontes',
        'Rafael Mendes de Oliveira',
        'Bruno Henrique Castro',
        'Juliana Paes de Barros',
      ]);
      const cleanOrders = (fetchedOrders || []).filter((o) => {
        if (sampleCustomerNames.has(o.customer?.name)) return false;
        if (o.notes?.includes('Pedido puxado automaticamente via sincronização de API')) return false;
        if (o.items?.some((i) => i.name.includes('Smash') || i.name.includes('Angus Bacon Trufado'))) return false;
        return true;
      });

      if (fetchedOrders && fetchedOrders.length > cleanOrders.length) {
        deliveryApi.clearOrders(companyId).catch(() => {});
      }

      setOrders(cleanOrders);
      if (fetchedMetrics) setMetrics(fetchedMetrics);
    } catch (err) {
      console.error('Erro ao carregar dados de integrações:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [companyId]);

  // Recarregar pedidos quando filtros mudarem
  useEffect(() => {
    const fetchFiltered = async () => {
      try {
        const fetchedOrders = await deliveryApi.getOrders(companyId, {
          channel: filterChannel,
          status: filterStatus,
          period: filterPeriod,
          logisticsType: filterLogistics,
          searchTerm,
        });
        const sampleCustomerNames = new Set([
          'Mariana Silveira',
          'Rafael Mendes',
          'Camila Alcantara',
          'Bruno Henrique',
          'Juliana Paes',
          'Thiago Nogueira',
          'Carolina Nogueira',
          'Eduardo Vasconcelos',
          'Beatriz Meneghel',
          'Rodrigo Amaral',
          'Larissa Fontes',
          'Rafael Mendes de Oliveira',
          'Bruno Henrique Castro',
          'Juliana Paes de Barros',
        ]);
        const cleanOrders = (fetchedOrders || []).filter((o) => {
          if (sampleCustomerNames.has(o.customer?.name)) return false;
          if (o.notes?.includes('Pedido puxado automaticamente via sincronização de API')) return false;
          if (o.items?.some((i) => i.name.includes('Smash') || i.name.includes('Angus Bacon Trufado'))) return false;
          return true;
        });
        setOrders(cleanOrders);
      } catch (err) {
        console.error('Erro ao filtrar pedidos:', err);
      }
    };
    fetchFiltered();
  }, [filterChannel, filterStatus, filterPeriod, filterLogistics, searchTerm]);

  // Limpar todos os pedidos (zerar dados)
  const handleClearOrders = async () => {
    try {
      setIsLoading(true);
      await deliveryApi.clearOrders(companyId);
      setOrders([]);
      setSyncFeedback('Todos os pedidos foram zerados com sucesso.');
      await loadData();
      setTimeout(() => setSyncFeedback(null), 3000);
    } catch (err: any) {
      console.error('Erro ao limpar pedidos:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Sincronizar pedidos com a API
  const handleSyncOrders = async (targetChannel?: DeliveryChannel) => {
    try {
      setIsSyncing(true);
      setSyncFeedback('Consultando novos pedidos nas APIs iFood e 99Food...');
      const res = await deliveryApi.syncOrders(companyId, targetChannel);
      setSyncFeedback(res.message);
      await loadData();
      setTimeout(() => setSyncFeedback(null), 4000);
    } catch (err: any) {
      setSyncFeedback(`Erro na sincronização: ${err.message}`);
      setTimeout(() => setSyncFeedback(null), 4000);
    } finally {
      setIsSyncing(false);
    }
  };

  // Abrir / Fechar loja
  const handleToggleStore = async (channel: DeliveryChannel) => {
    if (!configs) return;
    const current = channel === 'IFOOD' ? configs.ifood.storeOpen : configs.food99.storeOpen;
    const nextState = !current;
    try {
      const res = await deliveryApi.toggleStore(companyId, channel, nextState);
      setConfigs((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          [channel === 'IFOOD' ? 'ifood' : 'food99']: {
            ...prev[channel === 'IFOOD' ? 'ifood' : 'food99'],
            storeOpen: res.storeOpen,
          },
        };
      });
      setSyncFeedback(res.message);
      setTimeout(() => setSyncFeedback(null), 3000);
    } catch (err: any) {
      alert(`Falha ao alterar status da loja: ${err.message}`);
    }
  };

  // Atualizar status de um pedido
  const handleUpdateOrderStatus = async (
    orderId: string,
    newStatus: DeliveryOrderStatus,
    extra?: any
  ) => {
    try {
      const updated = await deliveryApi.updateOrderStatus(companyId, orderId, newStatus, extra);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
      if (selectedOrderForDetail?.id === orderId) {
        setSelectedOrderForDetail(updated);
      }
      // Atualizar métricas
      const updatedMetrics = await deliveryApi.getMetrics(companyId, 'today');
      setMetrics(updatedMetrics);
    } catch (err: any) {
      alert(`Erro ao atualizar pedido: ${err.message}`);
    }
  };

  // Testar Conexão com API
  const handleTestConnection = async (channel: DeliveryChannel) => {
    const creds = channel === 'IFOOD' ? ifoodForm : food99Form;
    try {
      setTestStatusMessage({ channel, text: 'Testando comunicação com a API...', ok: true });
      const res = await deliveryApi.testConnection(companyId, channel, creds);
      setTestStatusMessage({ channel, text: res.message, ok: res.success });
      await loadData();
    } catch (err: any) {
      setTestStatusMessage({ channel, text: `Erro: ${err.message}`, ok: false });
    }
  };

  // Salvar Configurações
  const handleSaveConfig = async (channel: DeliveryChannel) => {
    const patch = channel === 'IFOOD' ? ifoodForm : food99Form;
    try {
      const updated = await deliveryApi.updateConfig(companyId, channel, patch);
      setConfigs((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          [channel === 'IFOOD' ? 'ifood' : 'food99']: updated,
        };
      });
      setTestStatusMessage({
        channel,
        text: 'Configurações salvas com sucesso!',
        ok: true,
      });
      setTimeout(() => setTestStatusMessage(null), 3000);
    } catch (err: any) {
      alert(`Falha ao salvar: ${err.message}`);
    }
  };

  // Copiar URL do Webhook
  const handleCopyWebhook = (channel: 'ifood' | 'food99') => {
    const fullUrl = `${window.location.origin}/api/integrations/${channel}/webhook`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedWebhook(channel);
    setTimeout(() => setCopiedWebhook(null), 2500);
  };

  // Exportar Vendas para CSV
  const handleExportCsv = () => {
    if (orders.length === 0) {
      alert('Nenhum pedido encontrado para exportar.');
      return;
    }

    const headers = [
      'ID Pedido',
      'Canal',
      'Data/Hora',
      'Status',
      'Logistica',
      'Cliente',
      'Telefone',
      'Bairro',
      'Subtotal (R$)',
      'Taxa Entrega (R$)',
      'Desconto (R$)',
      'Total Cliente (R$)',
      'Comissao Canal (R$)',
      'Repasse Liquido (R$)',
      'Pagamento',
      'Itens',
    ];

    const rows = orders.map((o) => {
      const itemsList = o.items.map((i) => `${i.quantity}x ${i.name}`).join(' | ');
      return [
        o.displayId,
        o.channel,
        new Date(o.createdAt).toLocaleString('pt-BR'),
        o.status,
        o.logisticsType === 'MARKETPLACE_DELIVERY' ? 'Marketplace' : 'Entrega Propria',
        `"${o.customer.name.replace(/"/g, '""')}"`,
        `"${o.customer.phone || ''}"`,
        `"${o.customer.deliveryAddress.neighborhood || ''}"`,
        (o.financial.subtotalInCents / 100).toFixed(2),
        (o.financial.deliveryFeeInCents / 100).toFixed(2),
        (o.financial.discountInCents / 100).toFixed(2),
        (o.financial.totalCustomerInCents / 100).toFixed(2),
        (o.financial.marketplaceCommissionInCents / 100).toFixed(2),
        (o.financial.netRestaurantPayoutInCents / 100).toFixed(2),
        o.financial.paidOnline ? 'Online' : 'Entrega',
        `"${itemsList.replace(/"/g, '""')}"`,
      ].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio_delivery_mise_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Importar Vendas para o Módulo de Vendas & Caixa da Mise
  const handleImportToMiseSales = () => {
    const completedOrders = orders.filter((o) => o.status === 'DELIVERED');
    if (completedOrders.length === 0) {
      alert('Nenhum pedido entregue/concluído disponível para lançar no caixa.');
      return;
    }

    const totalGross = completedOrders.reduce((acc, o) => acc + o.financial.totalCustomerInCents, 0);
    const totalNet = completedOrders.reduce((acc, o) => acc + o.financial.netRestaurantPayoutInCents, 0);

    const newImport: SalesImport = {
      id: `sales_deliv_${Date.now()}`,
      storeId: database.activeStoreId === 'CONSOLIDATED' ? database.stores[0]?.id || 'store_main' : database.activeStoreId,
      channel: 'Delivery Integrado (iFood & 99Food)',
      periodStartDate: new Date().toISOString().slice(0, 10),
      periodEndDate: new Date().toISOString().slice(0, 10),
      fileHash: `delivery_hub_sync_${Date.now()}`,
      totalGrossInCents: totalGross,
      totalNetInCents: totalNet,
      totalOrdersCount: completedOrders.length,
      lines: completedOrders.flatMap((o) =>
        o.items.map((i) => ({
          externalProductName: i.name,
          quantity: i.quantity,
          salePriceInCents: i.unitPriceInCents,
          totalGrossInCents: i.totalPriceInCents,
          discountsInCents: 0,
          channelFeeInCents: Math.round(i.totalPriceInCents * (o.channel === 'IFOOD' ? 0.23 : 0.15)),
          netRevenueInCents: Math.round(i.totalPriceInCents * (o.channel === 'IFOOD' ? 0.77 : 0.85)),
        }))
      ),
      stockDeducted: true,
      importedAt: new Date().toISOString(),
    };

    const updatedDatabase: MiseDatabaseState = {
      ...database,
      salesImports: [newImport, ...(database.salesImports || [])],
    };

    onUpdateDatabase(updatedDatabase);
    alert(
      `Sucesso! ${completedOrders.length} pedidos de delivery foram integrados ao módulo de Vendas e Caixa da Mise com dedução de CMV.`
    );
  };

  const formatMoney = (cents: number) => {
    return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Contadores por status para as abas rápidas
  const statusCounts = useMemo(() => {
    const counts = {
      ALL: orders.length,
      ACTIVE: 0,
      PENDING: 0,
      PREPARING: 0,
      DISPATCHED: 0,
      DELIVERED: 0,
      CANCELLED: 0,
    };
    orders.forEach((o) => {
      if (['PENDING', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'DISPATCHED'].includes(o.status)) {
        counts.ACTIVE++;
      }
      if (o.status === 'PENDING') counts.PENDING++;
      if (o.status === 'PREPARING' || o.status === 'CONFIRMED') counts.PREPARING++;
      if (o.status === 'DISPATCHED' || o.status === 'READY_FOR_PICKUP') counts.DISPATCHED++;
      if (o.status === 'DELIVERED') counts.DELIVERED++;
      if (o.status === 'CANCELLED') counts.CANCELLED++;
    });
    return counts;
  }, [orders]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Banner / Store Status Hub */}
      <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Title & Description */}
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-stone-900 text-amber-400 flex items-center justify-center shadow-xs">
                <Store className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-stone-900 leading-tight">
                  Integrações Delivery — iFood & 99Food
                </h1>
                <p className="text-xs text-stone-500 mt-0.5">
                  Operação unificada: recepção de pedidos, vendas em tempo real, despacho e controle de comissões.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Channels Store Open/Closed Switches & OAuth Connect Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            {/* iFood Quick OAuth Hub */}
            <div className="flex items-center gap-2.5 px-3 py-2 bg-red-50/70 border border-red-200/80 rounded-xl">
              <IfoodLogo size="sm" />
              <div className="flex flex-col">
                <span className="text-[10px] font-bold tracking-wider text-red-900 uppercase flex items-center gap-1">
                  iFood
                  {configs?.ifood.connectionStatus === 'CONNECTED' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                  )}
                </span>
                <span className="text-[11px] font-semibold text-red-700">
                  {configs?.ifood.connectionStatus === 'CONNECTED'
                    ? configs.ifood.storeOpen
                      ? 'Loja Aberta'
                      : 'Loja Fechada'
                    : 'Não Conectado'}
                </span>
              </div>

              {configs?.ifood.connectionStatus === 'CONNECTED' ? (
                <div className="flex items-center gap-1.5 ml-1">
                  <button
                    onClick={() => handleToggleStore('IFOOD')}
                    title="Clique para abrir ou fechar a loja no iFood"
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-lg cursor-pointer transition-colors shadow-xs ${
                      configs.ifood.storeOpen
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : 'bg-stone-200 text-stone-700 hover:bg-stone-300'
                    }`}
                  >
                    {configs.ifood.storeOpen ? 'Aberta' : 'Fechada'}
                  </button>
                  <button
                    onClick={() => setOauthModalChannel('IFOOD')}
                    title="Gerenciar autorização OAuth 2.0 do iFood"
                    className="p-1 text-stone-400 hover:text-stone-700 rounded-md cursor-pointer transition-colors"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setOauthModalChannel('IFOOD')}
                  className="ml-1 text-[11px] font-bold px-3 py-1.5 rounded-lg bg-[#ea1d2c] hover:bg-[#d41825] text-white cursor-pointer transition-all shadow-xs flex items-center gap-1"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Conectar</span>
                </button>
              )}
            </div>

            {/* 99Food Quick OAuth Hub */}
            <div className="flex items-center gap-2.5 px-3 py-2 bg-amber-50/70 border border-amber-200/80 rounded-xl">
              <Food99Logo size="sm" />
              <div className="flex flex-col">
                <span className="text-[10px] font-bold tracking-wider text-amber-900 uppercase flex items-center gap-1">
                  99Food
                  {configs?.food99.connectionStatus === 'CONNECTED' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                  )}
                </span>
                <span className="text-[11px] font-semibold text-amber-800">
                  {configs?.food99.connectionStatus === 'CONNECTED'
                    ? configs.food99.storeOpen
                      ? 'Loja Aberta'
                      : 'Loja Fechada'
                    : 'Não Conectada'}
                </span>
              </div>

              {configs?.food99.connectionStatus === 'CONNECTED' ? (
                <div className="flex items-center gap-1.5 ml-1">
                  <button
                    onClick={() => handleToggleStore('99FOOD')}
                    title="Clique para abrir ou fechar a loja na 99Food"
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-lg cursor-pointer transition-colors shadow-xs ${
                      configs.food99.storeOpen
                        ? 'bg-amber-500 text-stone-900 hover:bg-amber-600'
                        : 'bg-stone-200 text-stone-700 hover:bg-stone-300'
                    }`}
                  >
                    {configs.food99.storeOpen ? 'Aberta' : 'Fechada'}
                  </button>
                  <button
                    onClick={() => setOauthModalChannel('99FOOD')}
                    title="Gerenciar autorização OAuth 2.0 da 99Food"
                    className="p-1 text-stone-400 hover:text-stone-700 rounded-md cursor-pointer transition-colors"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setOauthModalChannel('99FOOD')}
                  className="ml-1 text-[11px] font-bold px-3 py-1.5 rounded-lg bg-[#f7a800] hover:bg-[#e09800] text-stone-950 cursor-pointer transition-all shadow-xs flex items-center gap-1"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Conectar</span>
                </button>
              )}
            </div>

            {/* Sincronizar Pedidos Button */}
            <button
              disabled={isSyncing}
              onClick={() => handleSyncOrders()}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 rounded-xl cursor-pointer transition-colors shadow-xs disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Sincronizando...' : 'Puxar Pedidos / Vendas'}</span>
            </button>

            {orders.length > 0 && (
              <button
                onClick={handleClearOrders}
                title="Zerar todos os pedidos salvos"
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl cursor-pointer transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Zerar Pedidos</span>
              </button>
            )}
          </div>
        </div>

        {/* Sync Feedback Alert */}
        {syncFeedback && (
          <div className="mt-3 p-2.5 bg-stone-100 border border-stone-300 rounded-lg text-xs font-medium text-stone-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{syncFeedback}</span>
            </div>
            <button onClick={() => setSyncFeedback(null)} className="text-stone-400 hover:text-stone-700">
              ✕
            </button>
          </div>
        )}

        {/* Sub-Tabs Navigation */}
        <div className="flex space-x-1 border-t border-stone-200 pt-4 mt-4 overflow-x-auto">
          <button
            onClick={() => setActiveSubTab('orders')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              activeSubTab === 'orders'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
            }`}
          >
            <UtensilsCrossed className="w-3.5 h-3.5" />
            <span>Gestão de Pedidos (Live)</span>
            {statusCounts.PENDING > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-400 text-stone-900 animate-pulse">
                {statusCounts.PENDING}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('sales')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              activeSubTab === 'sales'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>Vendas & Relatórios de Delivery</span>
          </button>

          <button
            onClick={() => setActiveSubTab('ifood')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              activeSubTab === 'ifood'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
            }`}
          >
            <IfoodLogo size="xs" />
            <span>Conexão iFood API</span>
          </button>

          <button
            onClick={() => setActiveSubTab('food99')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              activeSubTab === 'food99'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
            }`}
          >
            <Food99Logo size="xs" />
            <span>Conexão 99Food API</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-VIEW 1: GESTÃO DE PEDIDOS (LIVE KDS / DISPATCH)                       */}
      {/* ========================================================================= */}
      {activeSubTab === 'orders' && (
        <div className="space-y-4">
          {/* Quick OAuth Connectivity & Simulation Banner */}
          {(!configs?.ifood || configs.ifood.connectionStatus !== 'CONNECTED' ||
            !configs?.food99 || configs.food99.connectionStatus !== 'CONNECTED') ? (
            <div className="bg-gradient-to-r from-stone-900 to-stone-800 text-white rounded-xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-amber-400 text-stone-900 rounded-lg shrink-0 mt-0.5">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                    Integração Rápida via OAuth 2.0
                  </h3>
                  <p className="text-xs text-stone-300 mt-0.5">
                    Conecte sua loja ao iFood ou 99Food em apenas 2 passos (Conectar → Autorizar) para receber pedidos automaticamente no KDS e na Comanda Térmica.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {configs?.ifood.connectionStatus !== 'CONNECTED' && (
                  <button
                    onClick={() => setOauthModalChannel('IFOOD')}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-[#ea1d2c] hover:bg-[#d41825] text-white rounded-lg cursor-pointer transition-all shadow-xs"
                  >
                    <IfoodLogo size="xs" />
                    <span>Conectar iFood (OAuth)</span>
                  </button>
                )}
                {configs?.food99.connectionStatus !== 'CONNECTED' && (
                  <button
                    onClick={() => setOauthModalChannel('99FOOD')}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-[#f7a800] hover:bg-[#e09800] text-stone-950 rounded-lg cursor-pointer transition-all shadow-xs"
                  >
                    <Food99Logo size="xs" />
                    <span>Conectar 99Food (OAuth)</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-semibold">
                  Canais Delivery Ativos via OAuth 2.0:
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                  iFood ({configs.ifood.storeOpen ? 'Loja Aberta' : 'Fechada'})
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                  99Food ({configs.food99.storeOpen ? 'Loja Aberta' : 'Fechada'})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={isSimulatingOrder}
                  onClick={() => handleSimulateTestOrder('IFOOD')}
                  className="flex items-center gap-1 px-2.5 py-1.5 font-bold text-[11px] bg-white border border-emerald-300 hover:bg-emerald-100/50 text-emerald-800 rounded-lg cursor-pointer transition-colors shadow-2xs disabled:opacity-50"
                  title="Gera um pedido de teste imediato para validar recebimento e impressão"
                >
                  <PlayCircle className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Testar iFood</span>
                </button>
                <button
                  disabled={isSimulatingOrder}
                  onClick={() => handleSimulateTestOrder('99FOOD')}
                  className="flex items-center gap-1 px-2.5 py-1.5 font-bold text-[11px] bg-white border border-emerald-300 hover:bg-emerald-100/50 text-emerald-800 rounded-lg cursor-pointer transition-colors shadow-2xs disabled:opacity-50"
                  title="Gera um pedido de teste imediato para validar recebimento e impressão"
                >
                  <PlayCircle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Testar 99Food</span>
                </button>
              </div>
            </div>
          )}

          {/* Filter Bar */}
          <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-xs space-y-3">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
              {/* Universal Search Input */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por código (#IFO, #99F), cliente, endereço, telefone ou prato..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-stone-900 focus:bg-white transition-colors"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-stone-400 hover:text-stone-700"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Channel Selector */}
              <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-lg">
                <button
                  onClick={() => setFilterChannel('ALL')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    filterChannel === 'ALL'
                      ? 'bg-white text-stone-900 shadow-xs font-bold'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Todos ({orders.length})
                </button>
                <button
                  onClick={() => setFilterChannel('IFOOD')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    filterChannel === 'IFOOD'
                      ? 'bg-red-600 text-white shadow-xs font-bold'
                      : 'text-stone-600 hover:text-red-700'
                  }`}
                >
                  <IfoodLogo size="xs" />
                  <span>iFood</span>
                </button>
                <button
                  onClick={() => setFilterChannel('99FOOD')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    filterChannel === '99FOOD'
                      ? 'bg-amber-400 text-stone-950 shadow-xs font-bold'
                      : 'text-stone-600 hover:text-amber-800'
                  }`}
                >
                  <Food99Logo size="xs" />
                  <span>99Food</span>
                </button>
              </div>

              {/* Date / Period Selector */}
              <div className="flex items-center gap-2">
                <select
                  value={filterPeriod}
                  onChange={(e) => setFilterPeriod(e.target.value as any)}
                  className="px-3 py-2 text-xs font-medium text-stone-800 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-stone-900 cursor-pointer"
                >
                  <option value="TODAY">Hoje</option>
                  <option value="YESTERDAY">Ontem</option>
                  <option value="LAST_7_DAYS">Últimos 7 dias</option>
                  <option value="LAST_30_DAYS">Últimos 30 dias</option>
                  <option value="THIS_MONTH">Este Mês</option>
                  <option value="ALL">Todo o Histórico</option>
                </select>

                {/* Logistics Selector */}
                <select
                  value={filterLogistics}
                  onChange={(e) => setFilterLogistics(e.target.value as any)}
                  className="px-3 py-2 text-xs font-medium text-stone-800 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-stone-900 cursor-pointer"
                >
                  <option value="ALL">Todas as Entregas</option>
                  <option value="OWN_DELIVERY">Entrega Própria (Loja)</option>
                  <option value="MARKETPLACE_DELIVERY">Logística Parceira</option>
                </select>
              </div>
            </div>

            {/* Quick Status Sub-Filters */}
            <div className="flex items-center gap-2 overflow-x-auto pt-2 border-t border-stone-100">
              <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider whitespace-nowrap">
                Status:
              </span>
              <button
                onClick={() => setFilterStatus('ALL')}
                className={`px-2.5 py-1 text-xs rounded-md font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                  filterStatus === 'ALL'
                    ? 'bg-stone-900 text-white'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                Todos ({statusCounts.ALL})
              </button>
              <button
                onClick={() => setFilterStatus('PENDING')}
                className={`px-2.5 py-1 text-xs rounded-md font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                  filterStatus === 'PENDING'
                    ? 'bg-amber-500 text-stone-900 font-bold'
                    : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                }`}
              >
                Pendentes ({statusCounts.PENDING})
              </button>
              <button
                onClick={() => setFilterStatus('PREPARING')}
                className={`px-2.5 py-1 text-xs rounded-md font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                  filterStatus === 'PREPARING'
                    ? 'bg-orange-600 text-white font-bold'
                    : 'bg-orange-50 text-orange-800 hover:bg-orange-100'
                }`}
              >
                Em Preparo ({statusCounts.PREPARING})
              </button>
              <button
                onClick={() => setFilterStatus('DISPATCHED')}
                className={`px-2.5 py-1 text-xs rounded-md font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                  filterStatus === 'DISPATCHED'
                    ? 'bg-purple-600 text-white font-bold'
                    : 'bg-purple-50 text-purple-800 hover:bg-purple-100'
                }`}
              >
                Despachados ({statusCounts.DISPATCHED})
              </button>
              <button
                onClick={() => setFilterStatus('DELIVERED')}
                className={`px-2.5 py-1 text-xs rounded-md font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                  filterStatus === 'DELIVERED'
                    ? 'bg-emerald-600 text-white font-bold'
                    : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                }`}
              >
                Entregues ({statusCounts.DELIVERED})
              </button>
              <button
                onClick={() => setFilterStatus('CANCELLED')}
                className={`px-2.5 py-1 text-xs rounded-md font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                  filterStatus === 'CANCELLED'
                    ? 'bg-rose-600 text-white font-bold'
                    : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
                }`}
              >
                Cancelados ({statusCounts.CANCELLED})
              </button>
            </div>
          </div>

          {/* Orders Grid */}
          {isLoading ? (
            <div className="bg-white border border-stone-200 rounded-xl p-12 text-center text-stone-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-stone-400" />
              <p className="text-sm font-semibold">Carregando pedidos de delivery...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-white border border-stone-200 rounded-xl p-12 text-center text-stone-500 space-y-3">
              <Store className="w-10 h-10 mx-auto text-stone-300" />
              <p className="text-sm font-bold text-stone-700">Nenhum pedido encontrado com os filtros atuais</p>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                Experimente limpar os filtros ou clicar no botão abaixo para buscar novos pedidos nos canais.
              </p>
              <button
                onClick={() => handleSyncOrders()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 rounded-lg cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Puxar Pedidos do iFood / 99Food</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {orders.map((order) => {
                const channelBadge = <ChannelBadge channel={order.channel} />;

                const statusBadges: Record<
                  DeliveryOrderStatus,
                  { label: string; bg: string; text: string }
                > = {
                  PENDING: { label: 'Pendente', bg: 'bg-amber-100', text: 'text-amber-800' },
                  CONFIRMED: { label: 'Confirmado', bg: 'bg-blue-100', text: 'text-blue-800' },
                  PREPARING: { label: 'Em Preparo', bg: 'bg-orange-100', text: 'text-orange-800' },
                  READY_FOR_PICKUP: { label: 'Pronto', bg: 'bg-indigo-100', text: 'text-indigo-800' },
                  DISPATCHED: { label: 'Em Rota', bg: 'bg-purple-100', text: 'text-purple-800' },
                  DELIVERED: { label: 'Entregue', bg: 'bg-emerald-100', text: 'text-emerald-800' },
                  CANCELLED: { label: 'Cancelado', bg: 'bg-rose-100', text: 'text-rose-800' },
                };

                const elapsedMinutes = Math.max(
                  0,
                  Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000)
                );

                return (
                  <div
                    key={order.id}
                    className={`bg-white border rounded-xl overflow-hidden shadow-xs hover:shadow-md transition-shadow flex flex-col ${
                      order.status === 'PENDING'
                        ? 'border-amber-300 ring-1 ring-amber-300'
                        : 'border-stone-200'
                    }`}
                  >
                    {/* Card Header */}
                    <div className="p-3.5 bg-stone-50/80 border-b border-stone-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {channelBadge}
                        <span className="text-sm font-black text-stone-900">{order.displayId}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusBadges[order.status].bg} ${statusBadges[order.status].text}`}
                        >
                          {statusBadges[order.status].label}
                        </span>
                        <span className="text-[10px] text-stone-500 flex items-center gap-0.5">
                          <Clock className="w-3 h-3 text-stone-400" />
                          <span>{elapsedMinutes}m</span>
                        </span>
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="p-3.5 space-y-3 flex-1">
                      {/* Customer Info */}
                      <div>
                        <div className="text-xs font-bold text-stone-900 flex items-center justify-between">
                          <span>{order.customer.name}</span>
                          <span className="text-[10px] font-medium text-stone-500">
                            {order.logisticsType === 'MARKETPLACE_DELIVERY' ? 'Logística App' : 'Própria'}
                          </span>
                        </div>
                        <div className="text-[11px] text-stone-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-stone-400 shrink-0" />
                          <span className="truncate">
                            {order.customer.deliveryAddress.neighborhood} ·{' '}
                            {order.customer.deliveryAddress.street},{' '}
                            {order.customer.deliveryAddress.number}
                          </span>
                        </div>
                      </div>

                      {/* Items Preview */}
                      <div className="bg-stone-50 rounded-lg p-2.5 text-xs space-y-1.5 border border-stone-100">
                        {order.items.slice(0, 3).map((item, idx) => (
                          <div key={idx} className="flex justify-between items-start">
                            <span className="font-semibold text-stone-800 line-clamp-1">
                              {item.quantity}x {item.name}
                            </span>
                            <span className="text-stone-600 shrink-0 ml-2">
                              {formatMoney(item.totalPriceInCents)}
                            </span>
                          </div>
                        ))}
                        {order.items.length > 3 && (
                          <div className="text-[10px] font-medium text-stone-500 italic">
                            + {order.items.length - 3} outros itens...
                          </div>
                        )}
                        {order.notes && (
                          <div className="text-[11px] text-amber-900 bg-amber-50 p-1.5 rounded border border-amber-200 font-medium">
                            Obs: {order.notes}
                          </div>
                        )}
                      </div>

                      {/* Financial Preview */}
                      <div className="pt-1 flex items-center justify-between text-xs border-t border-stone-100">
                        <div>
                          <span className="text-[10px] text-stone-500 block">Total Cliente</span>
                          <span className="font-bold text-stone-900">
                            {formatMoney(order.financial.totalCustomerInCents)}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-emerald-700 font-medium block">
                            Líquido da Loja
                          </span>
                          <span className="font-black text-emerald-700">
                            {formatMoney(order.financial.netRestaurantPayoutInCents)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card Actions Footer */}
                    <div className="px-3.5 py-2.5 bg-stone-50 border-t border-stone-100 flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setSelectedOrderForPrint(order)}
                          title="Imprimir Comanda Térmica (80mm)"
                          className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-200/80 rounded-lg cursor-pointer transition-colors"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setSelectedOrderForDetail(order)}
                          className="px-2.5 py-1 text-xs font-semibold text-stone-700 hover:bg-stone-200 rounded-lg cursor-pointer transition-colors"
                        >
                          Detalhes
                        </button>
                      </div>

                      {/* Direct Transition Action Button */}
                      <div>
                        {order.status === 'PENDING' && (
                          <button
                            onClick={() => handleUpdateOrderStatus(order.id, 'CONFIRMED')}
                            className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer shadow-xs transition-colors"
                          >
                            Aceitar Pedido
                          </button>
                        )}
                        {order.status === 'CONFIRMED' && (
                          <button
                            onClick={() => handleUpdateOrderStatus(order.id, 'PREPARING')}
                            className="px-3 py-1.5 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-lg cursor-pointer shadow-xs transition-colors"
                          >
                            Iniciar Preparo
                          </button>
                        )}
                        {order.status === 'PREPARING' && (
                          <button
                            onClick={() => handleUpdateOrderStatus(order.id, 'READY_FOR_PICKUP')}
                            className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg cursor-pointer shadow-xs transition-colors"
                          >
                            Marcar Pronto
                          </button>
                        )}
                        {order.status === 'READY_FOR_PICKUP' && (
                          <button
                            onClick={() => handleUpdateOrderStatus(order.id, 'DISPATCHED')}
                            className="px-3 py-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg cursor-pointer shadow-xs transition-colors"
                          >
                            Despachar
                          </button>
                        )}
                        {order.status === 'DISPATCHED' && (
                          <button
                            onClick={() => handleUpdateOrderStatus(order.id, 'DELIVERED')}
                            className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer shadow-xs transition-colors"
                          >
                            Entregue
                          </button>
                        )}
                        {order.status === 'DELIVERED' && (
                          <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Concluído</span>
                          </span>
                        )}
                        {order.status === 'CANCELLED' && (
                          <span className="text-[11px] font-bold text-rose-700 flex items-center gap-1">
                            <Ban className="w-3.5 h-3.5" />
                            <span>Cancelado</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-VIEW 2: VENDAS & RELATÓRIOS FINANCEIROS                                */}
      {/* ========================================================================= */}
      {activeSubTab === 'sales' && (
        <div className="space-y-6">
          {/* Financial Summary KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Faturamento Bruto */}
            <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-stone-500 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider">Faturamento Bruto</span>
                <DollarSign className="w-4 h-4 text-stone-700" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-stone-900">
                {formatMoney(metrics?.totalGrossInCents || 0)}
              </div>
              <p className="text-[11px] text-stone-500 mt-1">
                Total movimentado em vendas pelos clientes
              </p>
            </div>

            {/* Repasse Líquido */}
            <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-emerald-700 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider">Repasse Líquido</span>
                <TrendingUp className="w-4 h-4 text-emerald-700" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-emerald-800">
                {formatMoney(metrics?.totalNetInCents || 0)}
              </div>
              <p className="text-[11px] text-emerald-700 mt-1">
                Valor líquido a receber na conta bancária
              </p>
            </div>

            {/* Comissões de Marketplace */}
            <div className="bg-rose-50/50 border border-rose-200 rounded-xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-rose-700 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider">Comissões Retidas</span>
                <Percent className="w-4 h-4 text-rose-700" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-rose-800">
                {formatMoney(metrics?.totalCommissionInCents || 0)}
              </div>
              <p className="text-[11px] text-rose-700 mt-1">
                Retenção média:{' '}
                {metrics && metrics.totalGrossInCents > 0
                  ? `${((metrics.totalCommissionInCents / metrics.totalGrossInCents) * 100).toFixed(1)}%`
                  : '0%'}
              </p>
            </div>

            {/* Ticket Médio & Volume */}
            <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-stone-500 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider">Ticket Médio</span>
                <CheckCircle2 className="w-4 h-4 text-stone-700" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-stone-900">
                {formatMoney(metrics?.averageTicketInCents || 0)}
              </div>
              <p className="text-[11px] text-stone-500 mt-1">
                {metrics?.completedOrders || 0} pedidos entregues ({metrics?.cancellationRate || 0}% cancelados)
              </p>
            </div>
          </div>

          {/* Comparative Channel Breakdown: iFood vs 99Food */}
          <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-stone-900">
              Comparativo de Desempenho: iFood vs 99Food
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* iFood Card */}
              <div className="border border-red-200 rounded-xl p-4 bg-red-50/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <IfoodLogo size="sm" />
                    <span className="text-xs font-bold text-stone-900">iFood Merchant</span>
                  </div>
                  <span className="text-xs font-bold text-red-700">
                    {metrics?.byChannel.ifood.ordersCount || 0} pedidos
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div>
                    <span className="text-stone-500 block text-[11px]">Faturamento Bruto</span>
                    <span className="font-bold text-stone-900 text-sm">
                      {formatMoney(metrics?.byChannel.ifood.grossInCents || 0)}
                    </span>
                  </div>
                  <div>
                    <span className="text-emerald-700 block text-[11px]">Repasse Líquido</span>
                    <span className="font-bold text-emerald-800 text-sm">
                      {formatMoney(metrics?.byChannel.ifood.netInCents || 0)}
                    </span>
                  </div>
                  <div>
                    <span className="text-rose-700 block text-[11px]">Comissão iFood Retida</span>
                    <span className="font-semibold text-rose-800">
                      {formatMoney(metrics?.byChannel.ifood.commissionInCents || 0)}
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-500 block text-[11px]">Ticket Médio iFood</span>
                    <span className="font-semibold text-stone-900">
                      {formatMoney(metrics?.byChannel.ifood.averageTicketInCents || 0)}
                    </span>
                  </div>
                </div>
              </div>

              {/* 99Food Card */}
              <div className="border border-amber-200 rounded-xl p-4 bg-amber-50/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Food99Logo size="sm" />
                    <span className="text-xs font-bold text-stone-900">99Food Open</span>
                  </div>
                  <span className="text-xs font-bold text-amber-900">
                    {metrics?.byChannel.food99.ordersCount || 0} pedidos
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div>
                    <span className="text-stone-500 block text-[11px]">Faturamento Bruto</span>
                    <span className="font-bold text-stone-900 text-sm">
                      {formatMoney(metrics?.byChannel.food99.grossInCents || 0)}
                    </span>
                  </div>
                  <div>
                    <span className="text-emerald-700 block text-[11px]">Repasse Líquido</span>
                    <span className="font-bold text-emerald-800 text-sm">
                      {formatMoney(metrics?.byChannel.food99.netInCents || 0)}
                    </span>
                  </div>
                  <div>
                    <span className="text-rose-700 block text-[11px]">Comissão 99Food Retida</span>
                    <span className="font-semibold text-rose-800">
                      {formatMoney(metrics?.byChannel.food99.commissionInCents || 0)}
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-500 block text-[11px]">Ticket Médio 99Food</span>
                    <span className="font-semibold text-stone-900">
                      {formatMoney(metrics?.byChannel.food99.averageTicketInCents || 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Bar for Sales Management */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-stone-200 rounded-xl p-4 shadow-xs">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-600">
                Integração Financeira & Exportação
              </h4>
              <p className="text-xs text-stone-500">
                Exporte o relatório analítico ou integre as vendas diretamente ao DRE da plataforma Mise.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCsv}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg cursor-pointer transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar Relatório CSV</span>
              </button>
              <button
                onClick={handleImportToMiseSales}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 rounded-lg cursor-pointer transition-colors shadow-xs"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Lançar Vendas no Caixa da Mise</span>
              </button>
            </div>
          </div>

          {/* Orders Sales Table */}
          <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-xs">
            <div className="px-5 py-3.5 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                Histórico de Vendas por Pedido ({orders.length})
              </h4>
              <span className="text-xs text-stone-500">
                Ordenado por data e hora decrescente
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-stone-800">
                <thead className="bg-stone-100/80 text-stone-600 font-bold border-b border-stone-200">
                  <tr>
                    <th className="px-4 py-2.5">Código</th>
                    <th className="px-4 py-2.5">Canal</th>
                    <th className="px-4 py-2.5">Data/Hora</th>
                    <th className="px-4 py-2.5">Cliente</th>
                    <th className="px-4 py-2.5">Subtotal</th>
                    <th className="px-4 py-2.5">Comissão Canal</th>
                    <th className="px-4 py-2.5">Líquido Loja</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {orders.map((o) => (
                    <tr key={o.id} className="hover:bg-stone-50/80 transition-colors">
                      <td className="px-4 py-3 font-bold text-stone-900">{o.displayId}</td>
                      <td className="px-4 py-3">
                        <ChannelBadge channel={o.channel} />
                      </td>
                      <td className="px-4 py-3 text-stone-600">
                        {new Date(o.createdAt).toLocaleString('pt-BR', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td className="px-4 py-3 font-medium text-stone-900">{o.customer.name}</td>
                      <td className="px-4 py-3">{formatMoney(o.financial.subtotalInCents)}</td>
                      <td className="px-4 py-3 text-rose-700 font-semibold">
                        - {formatMoney(o.financial.marketplaceCommissionInCents)}
                      </td>
                      <td className="px-4 py-3 text-emerald-800 font-black">
                        {formatMoney(o.financial.netRestaurantPayoutInCents)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-800">
                          {o.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setSelectedOrderForDetail(o)}
                          className="text-stone-600 hover:text-stone-900 font-semibold cursor-pointer text-xs"
                        >
                          Ver Detalhes
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-VIEW 3: CONFIGURAÇÃO IFOOD (OAUTH 2.0 & OPERACIONAL)                   */}
      {/* ========================================================================= */}
      {activeSubTab === 'ifood' && (
        <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-5 border-b border-stone-200 gap-3">
            <div className="flex items-center gap-3">
              <IfoodLogo size="lg" />
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-stone-900">Integração Oficial iFood</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800">
                    OAuth 2.0
                  </span>
                </div>
                <p className="text-xs text-stone-500">
                  Conexão oficial com o Portal do Parceiro iFood para recebimento automático de pedidos, KDS e conciliação.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 ${
                  configs?.ifood.connectionStatus === 'CONNECTED'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-stone-100 text-stone-700'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    configs?.ifood.connectionStatus === 'CONNECTED' ? 'bg-emerald-500' : 'bg-stone-400'
                  }`}
                />
                {configs?.ifood.connectionStatus === 'CONNECTED'
                  ? 'OAuth 2.0 Conectado'
                  : 'Desconectado'}
              </span>
            </div>
          </div>

          {/* Test Status Feedback Banner */}
          {testStatusMessage && testStatusMessage.channel === 'IFOOD' && (
            <div
              className={`p-3 rounded-lg text-xs font-semibold flex items-center justify-between ${
                testStatusMessage.ok
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              <span>{testStatusMessage.text}</span>
              <button
                onClick={() => setTestStatusMessage(null)}
                className="text-stone-400 hover:text-stone-700"
              >
                ✕
              </button>
            </div>
          )}

          {/* OAuth 2.0 Hero Connection Card */}
          {configs?.ifood.connectionStatus !== 'CONNECTED' ? (
            <div className="p-6 rounded-2xl border-2 border-dashed border-red-200 bg-gradient-to-br from-red-50/60 via-white to-stone-50 space-y-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-[#ea1d2c] text-white rounded-lg inline-flex items-center justify-center">
                      <Sparkles className="w-4 h-4" />
                    </span>
                    <h4 className="text-sm font-bold text-stone-900">
                      Conexão em 2 Passos via OAuth 2.0 (Fácil & Rápido)
                    </h4>
                  </div>
                  <p className="text-xs text-stone-600 max-w-xl leading-relaxed">
                    Você não precisa mais lidar com chaves complexas (Client ID ou Client Secret). Basta clicar em <strong>Conectar com iFood</strong>, apertar em <strong>Autorizar Acesso</strong> na janela oficial e pronto! Sua loja estará 100% conectada.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setOauthModalChannel('IFOOD')}
                  className="px-6 py-3 rounded-xl bg-[#ea1d2c] hover:bg-[#d41825] text-white text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Conectar com iFood via OAuth 2.0</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* 3 Step Visual Guide */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-red-100">
                <div className="p-3 bg-white/80 rounded-xl border border-red-100 flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-red-100 text-red-700 font-bold text-xs flex items-center justify-center shrink-0">
                    1
                  </div>
                  <div>
                    <span className="text-xs font-bold text-stone-900 block">Clique em Conectar</span>
                    <span className="text-[11px] text-stone-500">Inicia a integração oficial</span>
                  </div>
                </div>
                <div className="p-3 bg-white/80 rounded-xl border border-red-100 flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-red-100 text-red-700 font-bold text-xs flex items-center justify-center shrink-0">
                    2
                  </div>
                  <div>
                    <span className="text-xs font-bold text-stone-900 block">Aperte em Autorizar</span>
                    <span className="text-[11px] text-stone-500">Concede permissão segura</span>
                  </div>
                </div>
                <div className="p-3 bg-white/80 rounded-xl border border-red-100 flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center shrink-0">
                    ✓
                  </div>
                  <div>
                    <span className="text-xs font-bold text-stone-900 block">100% Funcional</span>
                    <span className="text-[11px] text-stone-500">Pedidos no KDS e comanda</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-5 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-2xs">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-900">
                      Loja Conectada e Operando via OAuth 2.0
                    </h4>
                    <p className="text-xs text-emerald-700">
                      Token de acesso ativo com renovação automática e sincronização contínua.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    disabled={isSimulatingOrder}
                    onClick={() => handleSimulateTestOrder('IFOOD')}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-white hover:bg-emerald-100/50 text-emerald-800 border border-emerald-300 rounded-xl cursor-pointer transition-colors shadow-2xs disabled:opacity-50"
                  >
                    <PlayCircle className="w-4 h-4 text-emerald-600" />
                    <span>Simular Pedido de Teste</span>
                  </button>
                  <button
                    onClick={() => setOauthModalChannel('IFOOD')}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl cursor-pointer transition-colors shadow-2xs"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Reautorizar</span>
                  </button>
                  <button
                    onClick={() => handleDisconnectOAuth('IFOOD')}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl cursor-pointer transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Desconectar</span>
                  </button>
                </div>
              </div>

              {/* Connected Details Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs pt-3 border-t border-emerald-200/60">
                <div className="p-3 bg-white/90 rounded-xl border border-emerald-100">
                  <span className="text-[11px] text-stone-500 block font-medium">Nome da Unidade:</span>
                  <span className="font-bold text-stone-900 mt-0.5 block truncate">
                    {configs.ifood.storeName || restaurantName}
                  </span>
                </div>
                <div className="p-3 bg-white/90 rounded-xl border border-emerald-100">
                  <span className="text-[11px] text-stone-500 block font-medium">Merchant UUID:</span>
                  <span className="font-mono font-bold text-stone-900 mt-0.5 block truncate">
                    {configs.ifood.merchantId || 'ifood-shop-matriz'}
                  </span>
                </div>
                <div className="p-3 bg-white/90 rounded-xl border border-emerald-100">
                  <span className="text-[11px] text-stone-500 block font-medium">Status Operacional:</span>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className={`font-bold ${configs.ifood.storeOpen ? 'text-emerald-700' : 'text-stone-600'}`}>
                      {configs.ifood.storeOpen ? 'Aberta no iFood' : 'Fechada'}
                    </span>
                    <button
                      onClick={() => handleToggleStore('IFOOD')}
                      className="text-[10px] font-bold px-2 py-0.5 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 cursor-pointer"
                    >
                      {configs.ifood.storeOpen ? 'Fechar' : 'Abrir'}
                    </button>
                  </div>
                </div>
                <div className="p-3 bg-white/90 rounded-xl border border-emerald-100">
                  <span className="text-[11px] text-stone-500 block font-medium">Token OAuth 2.0:</span>
                  <span className="font-mono text-emerald-800 font-bold mt-0.5 block truncate">
                    {configs.ifood.accessToken ? `${configs.ifood.accessToken.substring(0, 16)}...` : 'Ativo'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Operational Settings Accordion / Box */}
          <div className="border border-stone-200 rounded-xl p-5 space-y-4 bg-stone-50/50">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-800">
                  Configurações Operacionais & Taxas do iFood
                </h4>
                <p className="text-[11px] text-stone-500">
                  Ajuste a taxa de comissão contratual e o tempo de preparo para os cálculos de margem líquida.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="font-bold text-stone-700 block mb-1">
                  Taxa de Comissão Padrão do iFood (%):
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={ifoodForm.defaultCommissionRate ?? 23.0}
                  onChange={(e) =>
                    setIfoodForm({
                      ...ifoodForm,
                      defaultCommissionRate: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full p-2.5 bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-stone-900"
                />
                <span className="text-[11px] text-stone-500 mt-1 block">
                  Normalmente 12% para Entrega Própria ou 23% a 27% para iFood Entrega Parceira.
                </span>
              </div>

              <div>
                <label className="font-bold text-stone-700 block mb-1">
                  Tempo Estimado de Preparo Padrão (minutos):
                </label>
                <input
                  type="number"
                  value={ifoodForm.defaultPrepMinutes ?? 25}
                  onChange={(e) =>
                    setIfoodForm({
                      ...ifoodForm,
                      defaultPrepMinutes: parseInt(e.target.value, 10) || 25,
                    })
                  }
                  className="w-full p-2.5 bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-stone-900"
                />
                <span className="text-[11px] text-stone-500 mt-1 block">
                  Tempo padrão sugerido ao confirmar novos pedidos recebidos.
                </span>
              </div>
            </div>

            {/* Webhook Endpoint Box */}
            <div className="bg-white border border-stone-200 rounded-xl p-3.5 space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-600 block">
                URL de Webhook Oficial (Eventos Push em Tempo Real)
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}/api/integrations/ifood/webhook`}
                  className="flex-1 p-2 text-xs font-mono bg-stone-50 border border-stone-300 rounded-lg text-stone-800"
                />
                <button
                  type="button"
                  onClick={() => handleCopyWebhook('ifood')}
                  className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-stone-800 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded-lg cursor-pointer transition-colors"
                >
                  {copiedWebhook === 'ifood' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar URL</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-2 border-t border-stone-200">
              <button
                type="button"
                onClick={() => handleSaveConfig('IFOOD')}
                className="px-5 py-2 text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 rounded-xl cursor-pointer transition-colors shadow-xs"
              >
                Salvar Configurações Operacionais
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-VIEW 4: CONFIGURAÇÃO 99FOOD (OAUTH 2.0 & OPERACIONAL)                  */}
      {/* ========================================================================= */}
      {activeSubTab === 'food99' && (
        <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-5 border-b border-stone-200 gap-3">
            <div className="flex items-center gap-3">
              <Food99Logo size="lg" />
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-stone-900">Integração Oficial 99Food</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                    OAuth 2.0
                  </span>
                </div>
                <p className="text-xs text-stone-500">
                  Conexão direta com a plataforma de delivery da 99Food para recebimento de pedidos e conciliação.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 ${
                  configs?.food99.connectionStatus === 'CONNECTED'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-stone-100 text-stone-700'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    configs?.food99.connectionStatus === 'CONNECTED' ? 'bg-emerald-500' : 'bg-stone-400'
                  }`}
                />
                {configs?.food99.connectionStatus === 'CONNECTED'
                  ? 'OAuth 2.0 Conectado'
                  : 'Desconectado'}
              </span>
            </div>
          </div>

          {/* Test Status Feedback Banner */}
          {testStatusMessage && testStatusMessage.channel === '99FOOD' && (
            <div
              className={`p-3 rounded-lg text-xs font-semibold flex items-center justify-between ${
                testStatusMessage.ok
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              <span>{testStatusMessage.text}</span>
              <button
                onClick={() => setTestStatusMessage(null)}
                className="text-stone-400 hover:text-stone-700"
              >
                ✕
              </button>
            </div>
          )}

          {/* OAuth 2.0 Hero Connection Card */}
          {configs?.food99.connectionStatus !== 'CONNECTED' ? (
            <div className="p-6 rounded-2xl border-2 border-dashed border-amber-200 bg-gradient-to-br from-amber-50/60 via-white to-stone-50 space-y-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-[#f7a800] text-stone-950 rounded-lg inline-flex items-center justify-center">
                      <Sparkles className="w-4 h-4" />
                    </span>
                    <h4 className="text-sm font-bold text-stone-900">
                      Conexão em 2 Passos via OAuth 2.0 (Fácil & Rápido)
                    </h4>
                  </div>
                  <p className="text-xs text-stone-600 max-w-xl leading-relaxed">
                    Conecte a 99Food sem precisar configurar credenciais complexas. Clique em <strong>Conectar com 99Food</strong>, aperte em <strong>Autorizar Acesso</strong> e sua unidade estará pronta para receber pedidos e imprimir comandas.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setOauthModalChannel('99FOOD')}
                  className="px-6 py-3 rounded-xl bg-[#f7a800] hover:bg-[#e09800] text-stone-950 text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Conectar com 99Food via OAuth 2.0</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* 3 Step Visual Guide */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-amber-100">
                <div className="p-3 bg-white/80 rounded-xl border border-amber-100 flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-amber-100 text-amber-900 font-bold text-xs flex items-center justify-center shrink-0">
                    1
                  </div>
                  <div>
                    <span className="text-xs font-bold text-stone-900 block">Clique em Conectar</span>
                    <span className="text-[11px] text-stone-500">Inicia a conexão 99Food</span>
                  </div>
                </div>
                <div className="p-3 bg-white/80 rounded-xl border border-amber-100 flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-amber-100 text-amber-900 font-bold text-xs flex items-center justify-center shrink-0">
                    2
                  </div>
                  <div>
                    <span className="text-xs font-bold text-stone-900 block">Aperte em Autorizar</span>
                    <span className="text-[11px] text-stone-500">Autoriza o app Mise</span>
                  </div>
                </div>
                <div className="p-3 bg-white/80 rounded-xl border border-amber-100 flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center shrink-0">
                    ✓
                  </div>
                  <div>
                    <span className="text-xs font-bold text-stone-900 block">100% Funcional</span>
                    <span className="text-[11px] text-stone-500">Pedidos no KDS e repasse</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-5 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-2xs">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-900">
                      Loja Conectada e Operando via OAuth 2.0
                    </h4>
                    <p className="text-xs text-emerald-700">
                      Integração ativa para sincronização de pedidos e comissões da 99Food.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    disabled={isSimulatingOrder}
                    onClick={() => handleSimulateTestOrder('99FOOD')}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-white hover:bg-emerald-100/50 text-emerald-800 border border-emerald-300 rounded-xl cursor-pointer transition-colors shadow-2xs disabled:opacity-50"
                  >
                    <PlayCircle className="w-4 h-4 text-amber-600" />
                    <span>Simular Pedido de Teste</span>
                  </button>
                  <button
                    onClick={() => setOauthModalChannel('99FOOD')}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-stone-950 rounded-xl cursor-pointer transition-colors shadow-2xs"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Reautorizar</span>
                  </button>
                  <button
                    onClick={() => handleDisconnectOAuth('99FOOD')}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl cursor-pointer transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Desconectar</span>
                  </button>
                </div>
              </div>

              {/* Connected Details Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs pt-3 border-t border-emerald-200/60">
                <div className="p-3 bg-white/90 rounded-xl border border-emerald-100">
                  <span className="text-[11px] text-stone-500 block font-medium">Nome da Unidade:</span>
                  <span className="font-bold text-stone-900 mt-0.5 block truncate">
                    {configs.food99.storeName || restaurantName}
                  </span>
                </div>
                <div className="p-3 bg-white/90 rounded-xl border border-emerald-100">
                  <span className="text-[11px] text-stone-500 block font-medium">Shop ID:</span>
                  <span className="font-mono font-bold text-stone-900 mt-0.5 block truncate">
                    {configs.food99.merchantId || '99food-shop-matriz'}
                  </span>
                </div>
                <div className="p-3 bg-white/90 rounded-xl border border-emerald-100">
                  <span className="text-[11px] text-stone-500 block font-medium">Status Operacional:</span>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className={`font-bold ${configs.food99.storeOpen ? 'text-emerald-700' : 'text-stone-600'}`}>
                      {configs.food99.storeOpen ? 'Aberta na 99Food' : 'Fechada'}
                    </span>
                    <button
                      onClick={() => handleToggleStore('99FOOD')}
                      className="text-[10px] font-bold px-2 py-0.5 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 cursor-pointer"
                    >
                      {configs.food99.storeOpen ? 'Fechar' : 'Abrir'}
                    </button>
                  </div>
                </div>
                <div className="p-3 bg-white/90 rounded-xl border border-emerald-100">
                  <span className="text-[11px] text-stone-500 block font-medium">Token OAuth 2.0:</span>
                  <span className="font-mono text-emerald-800 font-bold mt-0.5 block truncate">
                    {configs.food99.accessToken ? `${configs.food99.accessToken.substring(0, 16)}...` : 'Ativo'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Operational Settings Accordion / Box */}
          <div className="border border-stone-200 rounded-xl p-5 space-y-4 bg-stone-50/50">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-800">
                Configurações Operacionais & Taxas da 99Food
              </h4>
              <p className="text-[11px] text-stone-500">
                Ajuste a comissão e o tempo padrão para a gestão e precificação no Mise.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="font-bold text-stone-700 block mb-1">
                  Taxa de Comissão Padrão 99Food (%):
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={food99Form.defaultCommissionRate ?? 15.0}
                  onChange={(e) =>
                    setFood99Form({
                      ...food99Form,
                      defaultCommissionRate: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full p-2.5 bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-stone-900"
                />
                <span className="text-[11px] text-stone-500 mt-1 block">
                  Geralmente de 12% a 15% para Entrega Própria e 20% a 25% para Entrega 99.
                </span>
              </div>

              <div>
                <label className="font-bold text-stone-700 block mb-1">
                  Tempo Estimado de Preparo Padrão (minutos):
                </label>
                <input
                  type="number"
                  value={food99Form.defaultPrepMinutes ?? 20}
                  onChange={(e) =>
                    setFood99Form({
                      ...food99Form,
                      defaultPrepMinutes: parseInt(e.target.value, 10) || 20,
                    })
                  }
                  className="w-full p-2.5 bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-stone-900"
                />
                <span className="text-[11px] text-stone-500 mt-1 block">
                  Tempo padrão estimado de produção ao receber pedidos.
                </span>
              </div>
            </div>

            {/* Webhook Endpoint Box */}
            <div className="bg-white border border-stone-200 rounded-xl p-3.5 space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-600 block">
                URL de Webhook Oficial (Eventos Push em Tempo Real)
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}/api/integrations/99food/webhook`}
                  className="flex-1 p-2 text-xs font-mono bg-stone-50 border border-stone-300 rounded-lg text-stone-800"
                />
                <button
                  type="button"
                  onClick={() => handleCopyWebhook('food99')}
                  className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-stone-800 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded-lg cursor-pointer transition-colors"
                >
                  {copiedWebhook === 'food99' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar URL</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-2 border-t border-stone-200">
              <button
                type="button"
                onClick={() => handleSaveConfig('99FOOD')}
                className="px-5 py-2 text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 rounded-xl cursor-pointer transition-colors shadow-xs"
              >
                Salvar Configurações Operacionais
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalhes do Pedido */}
      {selectedOrderForDetail && (
        <DeliveryOrderDetailModal
          order={selectedOrderForDetail}
          onClose={() => setSelectedOrderForDetail(null)}
          onUpdateStatus={handleUpdateOrderStatus}
          onPrint={(ord) => {
            setSelectedOrderForPrint(ord);
          }}
        />
      )}

      {/* Modal de Impressão Térmica (80mm) */}
      {selectedOrderForPrint && (
        <DeliveryReceiptModal
          order={selectedOrderForPrint}
          restaurantName={restaurantName}
          onClose={() => setSelectedOrderForPrint(null)}
        />
      )}

      {/* Modal de Conexão Rápida OAuth 2.0 */}
      {oauthModalChannel && (
        <DeliveryOAuthModal
          channel={oauthModalChannel}
          companyId={companyId}
          defaultStoreName={restaurantName}
          currentConfig={configs ? configs[oauthModalChannel === 'IFOOD' ? 'ifood' : 'food99'] : undefined}
          isOpen={true}
          onClose={() => setOauthModalChannel(null)}
          onSuccess={(updatedConfig) => {
            setConfigs((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                [oauthModalChannel === 'IFOOD' ? 'ifood' : 'food99']: updatedConfig,
              };
            });
            setSyncFeedback(
              `✓ ${oauthModalChannel === 'IFOOD' ? 'iFood' : '99Food'} conectado com 100% de sucesso via OAuth 2.0!`
            );
            loadData();
          }}
        />
      )}
    </div>
  );
};
