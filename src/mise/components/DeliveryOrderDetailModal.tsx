/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — Modal de Detalhes e Gestão Operacional do Pedido Delivery
 */

import React, { useState } from 'react';
import {
  X,
  Printer,
  Clock,
  MapPin,
  Phone,
  User,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  DollarSign,
  UtensilsCrossed,
  Truck,
  PackageCheck,
  Ban,
} from 'lucide-react';
import { DeliveryOrder, DeliveryOrderStatus } from '../domain/delivery-types';
import { IfoodLogo, Food99Logo } from './DeliveryLogos';

interface DeliveryOrderDetailModalProps {
  order: DeliveryOrder;
  onClose: () => void;
  onUpdateStatus: (orderId: string, status: DeliveryOrderStatus, extra?: any) => Promise<void>;
  onPrint: (order: DeliveryOrder) => void;
}

export const DeliveryOrderDetailModal: React.FC<DeliveryOrderDetailModalProps> = ({
  order,
  onClose,
  onUpdateStatus,
  onPrint,
}) => {
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('Produto esgotado no estoque da loja');
  const [driverNameInput, setDriverNameInput] = useState(order.driver?.name || '');
  const [isUpdating, setIsUpdating] = useState(false);

  const formatMoney = (cents: number) => {
    return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const isIfood = order.channel === 'IFOOD';
  const channelBadgeClass = isIfood
    ? 'bg-red-50 text-red-700 border-red-200'
    : 'bg-amber-50 text-amber-750 border-amber-200';

  const statusMap: Record<DeliveryOrderStatus, { label: string; bg: string; text: string }> = {
    PENDING: { label: 'Pendente / Aguardando Aceite', bg: 'bg-amber-100', text: 'text-amber-800' },
    CONFIRMED: { label: 'Confirmado pela Loja', bg: 'bg-blue-100', text: 'text-blue-800' },
    PREPARING: { label: 'Em Preparo na Cozinha', bg: 'bg-orange-100', text: 'text-orange-800' },
    READY_FOR_PICKUP: { label: 'Pronto p/ Despacho', bg: 'bg-indigo-100', text: 'text-indigo-800' },
    DISPATCHED: { label: 'Saiu para Entrega (Em Rota)', bg: 'bg-purple-100', text: 'text-purple-800' },
    DELIVERED: { label: 'Entregue / Concluído', bg: 'bg-emerald-100', text: 'text-emerald-800' },
    CANCELLED: { label: 'Cancelado', bg: 'bg-rose-100', text: 'text-rose-800' },
  };

  const handleStatusChange = async (newStatus: DeliveryOrderStatus, extra?: any) => {
    try {
      setIsUpdating(true);
      await onUpdateStatus(order.id, newStatus, extra);
      if (newStatus === 'CANCELLED') {
        setCancelModalOpen(false);
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const fullAddressString = `${order.customer.deliveryAddress.street}, ${order.customer.deliveryAddress.number}, ${order.customer.deliveryAddress.neighborhood}, ${order.customer.deliveryAddress.city} - ${order.customer.deliveryAddress.state}`;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddressString)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-stone-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 bg-stone-50">
          <div className="flex items-center gap-3">
            {order.channel === 'IFOOD' ? (
              <IfoodLogo size="md" />
            ) : (
              <Food99Logo size="md" />
            )}
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-stone-900">{order.displayId}</h2>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${statusMap[order.status].bg} ${statusMap[order.status].text}`}
                >
                  {statusMap[order.status].label}
                </span>
              </div>
              <p className="text-xs text-stone-500">
                Criado em {new Date(order.createdAt).toLocaleString('pt-BR')} · ID Marketplace:{' '}
                <span className="font-mono text-[11px] text-stone-600">{order.externalOrderId}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onPrint(order)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-stone-700 bg-white hover:bg-stone-100 rounded-lg border border-stone-200 cursor-pointer transition-colors shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-stone-800">
          {/* Action Banner for pending / active states */}
          {order.status === 'PENDING' && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-amber-900">Novo pedido aguardando confirmação</p>
                  <p className="text-xs text-amber-700">
                    Confirme o pedido para que o cliente e o entregador sejam avisados.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  disabled={isUpdating}
                  onClick={() => handleStatusChange('CONFIRMED', { prepMinutes: 25 })}
                  className="flex-1 sm:flex-none px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer transition-colors shadow-xs"
                >
                  Confirmar (+25 min)
                </button>
                <button
                  disabled={isUpdating}
                  onClick={() => setCancelModalOpen(true)}
                  className="px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg cursor-pointer transition-colors"
                >
                  Recusar
                </button>
              </div>
            </div>
          )}

          {/* Quick status progress pipeline */}
          <div className="bg-stone-50 border border-stone-200 rounded-xl p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-3">
              Etapas do Pedido
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                disabled={isUpdating || order.status === 'CANCELLED'}
                onClick={() => handleStatusChange('PREPARING')}
                className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                  order.status === 'PREPARING'
                    ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-400'
                    : ['CONFIRMED', 'PENDING'].includes(order.status)
                    ? 'border-stone-200 bg-white hover:border-orange-300'
                    : 'border-stone-200 bg-stone-100 opacity-60'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-stone-900">
                  <UtensilsCrossed className="w-3.5 h-3.5 text-orange-600" />
                  <span>Em Preparo</span>
                </div>
                <span className="text-[10px] text-stone-500 mt-1 block">Cozinha produzindo</span>
              </button>

              <button
                disabled={isUpdating || order.status === 'CANCELLED'}
                onClick={() => handleStatusChange('READY_FOR_PICKUP')}
                className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                  order.status === 'READY_FOR_PICKUP'
                    ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-400'
                    : ['CONFIRMED', 'PREPARING'].includes(order.status)
                    ? 'border-stone-200 bg-white hover:border-indigo-300'
                    : 'border-stone-200 bg-stone-100 opacity-60'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-stone-900">
                  <PackageCheck className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Pronto</span>
                </div>
                <span className="text-[10px] text-stone-500 mt-1 block">Aguardando retirada</span>
              </button>

              <button
                disabled={isUpdating || order.status === 'CANCELLED'}
                onClick={() => handleStatusChange('DISPATCHED')}
                className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                  order.status === 'DISPATCHED'
                    ? 'border-purple-500 bg-purple-50 ring-1 ring-purple-400'
                    : ['READY_FOR_PICKUP', 'PREPARING', 'CONFIRMED'].includes(order.status)
                    ? 'border-stone-200 bg-white hover:border-purple-300'
                    : 'border-stone-200 bg-stone-100 opacity-60'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-stone-900">
                  <Truck className="w-3.5 h-3.5 text-purple-600" />
                  <span>Despachado</span>
                </div>
                <span className="text-[10px] text-stone-500 mt-1 block">Em rota de entrega</span>
              </button>

              <button
                disabled={isUpdating || order.status === 'CANCELLED' || order.status === 'DELIVERED'}
                onClick={() => handleStatusChange('DELIVERED')}
                className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                  order.status === 'DELIVERED'
                    ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-400'
                    : 'border-stone-200 bg-white hover:border-emerald-300'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-stone-900">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Concluído</span>
                </div>
                <span className="text-[10px] text-stone-500 mt-1 block">Entregue ao cliente</span>
              </button>
            </div>
          </div>

          {/* Customer & Delivery Logistics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Customer Box */}
            <div className="border border-stone-200 rounded-xl p-4 bg-white space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                <span>Dados do Cliente</span>
              </h4>
              <div className="text-sm font-bold text-stone-900">{order.customer.name}</div>
              {order.customer.phone && (
                <div className="text-xs text-stone-600 flex items-center gap-1.5">
                  <Phone className="w-3 h-3 text-stone-400" />
                  <span>{order.customer.phone}</span>
                </div>
              )}
              <div className="pt-2 border-t border-stone-100">
                <div className="text-xs font-semibold text-stone-800 flex items-start gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p>
                      {order.customer.deliveryAddress.street}, {order.customer.deliveryAddress.number}
                      {order.customer.deliveryAddress.complement
                        ? ` - ${order.customer.deliveryAddress.complement}`
                        : ''}
                    </p>
                    <p className="text-stone-500 text-[11px]">
                      {order.customer.deliveryAddress.neighborhood} · {order.customer.deliveryAddress.city}/
                      {order.customer.deliveryAddress.state} · CEP{' '}
                      {order.customer.deliveryAddress.postalCode || 'Não informado'}
                    </p>
                    {order.customer.deliveryAddress.reference && (
                      <p className="text-stone-500 text-[11px] italic mt-0.5">
                        Ref: {order.customer.deliveryAddress.reference}
                      </p>
                    )}
                  </div>
                </div>
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-sky-600 hover:text-sky-800"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Abrir no Google Maps</span>
                </a>
              </div>
            </div>

            {/* Logistics & Driver Box */}
            <div className="border border-stone-200 rounded-xl p-4 bg-white space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5" />
                <span>Logística & Entregador</span>
              </h4>
              <div className="inline-block px-2.5 py-1 text-xs font-bold rounded-md bg-stone-100 text-stone-800 border border-stone-200">
                {order.logisticsType === 'MARKETPLACE_DELIVERY'
                  ? isIfood
                    ? 'Logística iFood Entrega (Frota Parceira)'
                    : 'Logística 99Food Entrega (Frota Parceira)'
                  : 'Entrega Própria da Loja (Motoboy Mise)'}
              </div>

              <div className="text-xs space-y-1 pt-1">
                <p className="text-stone-600">
                  <span className="font-semibold text-stone-900">Entregador:</span>{' '}
                  {order.driver?.name || 'Aguardando atribuição pelo marketplace'}
                </p>
                {order.driver?.phone && (
                  <p className="text-stone-600">
                    <span className="font-semibold text-stone-900">Contato:</span> {order.driver.phone}
                  </p>
                )}
                <div className="pt-2">
                  <label className="text-[11px] font-medium text-stone-500 block mb-1">
                    Atribuir / Atualizar Motoboy:
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="Nome do entregador..."
                      value={driverNameInput}
                      onChange={(e) => setDriverNameInput(e.target.value)}
                      className="flex-1 px-2.5 py-1 text-xs border border-stone-200 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-900"
                    />
                    <button
                      onClick={() => handleStatusChange(order.status, { driverName: driverNameInput })}
                      className="px-2.5 py-1 text-xs font-semibold bg-stone-800 text-white rounded-md hover:bg-stone-700 cursor-pointer"
                    >
                      Salvar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Items Breakdown */}
          <div className="border border-stone-200 rounded-xl p-4 bg-white">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-3 flex items-center gap-1.5">
              <UtensilsCrossed className="w-3.5 h-3.5" />
              <span>Itens Solicitados ({order.items.length})</span>
            </h4>
            <div className="divide-y divide-stone-100">
              {order.items.map((item, idx) => (
                <div key={idx} className="py-2.5 first:pt-0 last:pb-0">
                  <div className="flex justify-between items-start text-sm">
                    <span className="font-bold text-stone-900">
                      {item.quantity}x {item.name}
                    </span>
                    <span className="font-semibold text-stone-900">
                      {formatMoney(item.totalPriceInCents)}
                    </span>
                  </div>
                  {item.options && item.options.length > 0 && (
                    <div className="pl-4 text-xs text-stone-600 mt-1 space-y-0.5">
                      {item.options.map((opt, oIdx) => (
                        <div key={oIdx} className="flex justify-between">
                          <span>+ {opt.name}</span>
                          {opt.unitPriceInCents > 0 && (
                            <span>{formatMoney(opt.unitPriceInCents * opt.quantity)}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {item.notes && (
                    <div className="pl-4 mt-1.5 text-xs text-amber-800 bg-amber-50 p-1.5 rounded-md border-l-2 border-amber-600 font-medium">
                      Obs: {item.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {order.notes && (
              <div className="mt-3 p-2.5 bg-stone-50 rounded-lg border border-stone-200 text-xs">
                <span className="font-bold text-stone-700">Observações gerais do pedido:</span>
                <p className="text-stone-800 italic mt-0.5">{order.notes}</p>
              </div>
            )}
          </div>

          {/* Financial Breakdown (Gross, Channel Fees, Net Payout) */}
          <div className="border border-stone-200 rounded-xl p-4 bg-stone-50 space-y-2 text-xs">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-600 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-stone-700" />
              <span>Composição Financeira & Comissões</span>
            </h4>
            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-stone-600">
                <span>Subtotal dos Itens:</span>
                <span className="font-semibold">{formatMoney(order.financial.subtotalInCents)}</span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span>Taxa de Entrega:</span>
                <span className="font-semibold">{formatMoney(order.financial.deliveryFeeInCents)}</span>
              </div>
              {order.financial.discountInCents > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Descontos / Cupons da Loja:</span>
                  <span className="font-semibold">- {formatMoney(order.financial.discountInCents)}</span>
                </div>
              )}
              <div className="flex justify-between text-stone-900 font-bold text-sm pt-1 border-t border-stone-200">
                <span>Total Pago pelo Cliente:</span>
                <span>{formatMoney(order.financial.totalCustomerInCents)}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-stone-200 space-y-1">
              <div className="flex justify-between text-rose-700">
                <span>Comissão retida pelo {order.channel === 'IFOOD' ? 'iFood' : '99Food'}:</span>
                <span className="font-bold">
                  - {formatMoney(order.financial.marketplaceCommissionInCents)}
                </span>
              </div>
              <div className="flex justify-between text-emerald-800 font-black text-sm pt-1 bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                <span>Repasse Líquido Estimado para a Loja:</span>
                <span>{formatMoney(order.financial.netRestaurantPayoutInCents)}</span>
              </div>
            </div>

            <div className="pt-1 text-[11px] text-stone-500">
              Forma de Pagamento:{' '}
              <span className="font-bold text-stone-800">
                {order.financial.paidOnline
                  ? `Online via App (${order.financial.paymentBrand || order.financial.paymentMethod})`
                  : 'Presencial na entrega'}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-stone-200 bg-stone-50 flex items-center justify-between gap-3">
          <div>
            {order.status !== 'CANCELLED' && order.status !== 'DELIVERED' && (
              <button
                onClick={() => setCancelModalOpen(true)}
                className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-800 cursor-pointer"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>Cancelar Pedido</span>
              </button>
            )}
            {order.status === 'CANCELLED' && (
              <span className="text-xs text-rose-600 font-bold">
                Motivo: {order.cancellationReason || 'Cancelado'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-200 rounded-lg cursor-pointer transition-colors"
            >
              Fechar
            </button>
            {order.status === 'PENDING' && (
              <button
                disabled={isUpdating}
                onClick={() => handleStatusChange('CONFIRMED', { prepMinutes: 25 })}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer transition-colors shadow-xs"
              >
                Confirmar Pedido
              </button>
            )}
            {order.status === 'CONFIRMED' && (
              <button
                disabled={isUpdating}
                onClick={() => handleStatusChange('PREPARING')}
                className="px-4 py-2 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-lg cursor-pointer transition-colors shadow-xs"
              >
                Iniciar Preparo
              </button>
            )}
            {order.status === 'PREPARING' && (
              <button
                disabled={isUpdating}
                onClick={() => handleStatusChange('READY_FOR_PICKUP')}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg cursor-pointer transition-colors shadow-xs"
              >
                Marcar Pronto p/ Despacho
              </button>
            )}
            {order.status === 'READY_FOR_PICKUP' && (
              <button
                disabled={isUpdating}
                onClick={() => handleStatusChange('DISPATCHED')}
                className="px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg cursor-pointer transition-colors shadow-xs"
              >
                Despachar Pedido
              </button>
            )}
            {order.status === 'DISPATCHED' && (
              <button
                disabled={isUpdating}
                onClick={() => handleStatusChange('DELIVERED')}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer transition-colors shadow-xs"
              >
                Finalizar Entrega
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Cancellation confirmation sub-modal */}
      {cancelModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5 border border-stone-200 space-y-4">
            <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
              <Ban className="w-5 h-5" />
              <span>Confirmar Cancelamento</span>
            </div>
            <p className="text-xs text-stone-600">
              Tem certeza que deseja cancelar o pedido <strong>{order.displayId}</strong>? O marketplace
              será notificado.
            </p>
            <div>
              <label className="text-xs font-semibold text-stone-700 block mb-1">
                Motivo do cancelamento:
              </label>
              <select
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full p-2 text-xs border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-stone-900"
              >
                <option value="Produto esgotado no estoque da loja">Produto esgotado no estoque</option>
                <option value="Restaurante com capacidade excedida no momento">
                  Capacidade de preparo excedida
                </option>
                <option value="Cliente solicitou cancelamento por erro de endereço">
                  Solicitação do cliente
                </option>
                <option value="Fora da área de cobertura de entrega">Fora da área de entrega</option>
                <option value="Outro motivo operacional">Outro motivo operacional</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setCancelModalOpen(false)}
                className="px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-100 rounded-lg cursor-pointer"
              >
                Voltar
              </button>
              <button
                disabled={isUpdating}
                onClick={() => handleStatusChange('CANCELLED', { reason: cancelReason })}
                className="px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer"
              >
                Sim, Cancelar Pedido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
