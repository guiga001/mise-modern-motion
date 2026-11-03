/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — Comanda Térmica de Delivery Formatada para Impressão (80mm / 58mm ESC/POS)
 */

import React, { useState } from 'react';
import {
  Printer,
  X,
  Check,
  MapPin,
  Phone,
  User,
  Clock,
  Copy,
  Download,
  CheckCircle2,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { DeliveryOrder } from '../domain/delivery-types';
import { IfoodLogo, Food99Logo } from './DeliveryLogos';
import { printThermalReceipt, generateReceiptPlainText } from '../lib/thermal-printer';

interface DeliveryReceiptModalProps {
  order: DeliveryOrder;
  restaurantName: string;
  onClose: () => void;
}

export const DeliveryReceiptModal: React.FC<DeliveryReceiptModalProps> = ({
  order,
  restaurantName,
  onClose,
}) => {
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [printSuccess, setPrintSuccess] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string>('');

  const formatMoney = (cents: number) => {
    return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const channelLabel = order.channel === 'IFOOD' ? 'iFood Delivery' : '99Food Delivery';
  const logisticsLabel =
    order.logisticsType === 'MARKETPLACE_DELIVERY'
      ? order.channel === 'IFOOD'
        ? 'iFood Entrega (Parceiro)'
        : '99Food Entrega (Parceiro)'
      : 'Entrega Própria (Motoboy da Casa)';

  const orderDate = new Date(order.createdAt).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  const handlePrint = async () => {
    setIsPrinting(true);
    setFeedbackMessage('Enviando para a impressora...');
    try {
      const res = await printThermalReceipt(order, restaurantName);
      if (res.success) {
        setPrintSuccess(true);
        setFeedbackMessage('Comanda enviada à impressora com sucesso!');
        setTimeout(() => {
          setPrintSuccess(false);
          setFeedbackMessage('');
        }, 4000);
      } else {
        // Fallback nativo
        window.print();
      }
    } catch (e) {
      console.warn('Erro ao acionar impressora:', e);
      window.print();
    } finally {
      setIsPrinting(false);
    }
  };

  const handleCopyText = async () => {
    try {
      const text = generateReceiptPlainText(order, restaurantName);
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setFeedbackMessage('Texto da comanda copiado para a área de transferência!');
      setTimeout(() => {
        setCopied(false);
        setFeedbackMessage('');
      }, 3000);
    } catch (e) {
      console.error('Falha ao copiar texto:', e);
    }
  };

  const handleDownloadText = () => {
    try {
      const text = generateReceiptPlainText(order, restaurantName);
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `comanda_${order.channel.toLowerCase()}_${order.displayId.replace(/[^a-zA-Z0-9]/g, '')}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setFeedbackMessage('Arquivo .txt baixado!');
      setTimeout(() => setFeedbackMessage(''), 3000);
    } catch (e) {
      console.error('Falha ao baixar comanda:', e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-stone-200 overflow-hidden flex flex-col">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-200 bg-stone-50">
          <div className="flex items-center gap-2">
            {order.channel === 'IFOOD' ? (
              <IfoodLogo size="xs" />
            ) : (
              <Food99Logo size="xs" />
            )}
            <div>
              <h3 className="text-sm font-bold text-stone-900 leading-tight">
                Comanda de Impressão
              </h3>
              <span className="text-[11px] font-mono text-stone-500 font-semibold">
                {order.displayId} · 80mm ESC/POS
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={isPrinting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 disabled:opacity-50 rounded-lg cursor-pointer transition-colors shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{isPrinting ? 'Imprimindo...' : 'Imprimir'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feedback Alert Banner */}
        {feedbackMessage && (
          <div
            className={`px-4 py-2 text-xs flex items-center gap-2 transition-all ${
              printSuccess || copied
                ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-200'
                : 'bg-stone-100 text-stone-800 border-b border-stone-200'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{feedbackMessage}</span>
          </div>
        )}

        {/* Thermal Receipt Preview Area (Styled like 80mm thermal receipt paper) */}
        <div className="p-6 bg-stone-100 max-h-[70vh] overflow-y-auto">
          <div
            id="thermal-receipt"
            className="bg-white p-5 mx-auto max-w-xs shadow-md border border-dashed border-stone-300 font-mono text-xs text-stone-900 leading-tight"
          >
            {/* Header */}
            <div className="text-center pb-3 border-b border-dashed border-stone-400">
              <h2 className="text-base font-black uppercase tracking-wider">{restaurantName || 'MISE RESTAURANTE'}</h2>
              <p className="text-[11px] text-stone-600 mt-0.5">CONTROLE DE PRODUÇÃO & EXPEDIÇÃO</p>
              <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-stone-100 font-bold rounded text-xs border border-stone-300">
                {order.channel === 'IFOOD' ? (
                  <IfoodLogo size="xs" />
                ) : (
                  <Food99Logo size="xs" />
                )}
                <span>{channelLabel.toUpperCase()}</span>
              </div>
            </div>

            {/* Order Identifiers */}
            <div className="py-2.5 border-b border-dashed border-stone-400 flex justify-between items-center text-xs">
              <div>
                <span className="font-bold text-sm">{order.displayId}</span>
                <p className="text-[10px] text-stone-500 truncate max-w-[170px]">{order.externalOrderId}</p>
              </div>
              <div className="text-right text-[11px]">
                <div>{orderDate}</div>
                <div className="font-bold">{logisticsLabel}</div>
              </div>
            </div>

            {/* Customer Details */}
            <div className="py-2.5 border-b border-dashed border-stone-400 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-sm">
                <User className="w-3.5 h-3.5 inline text-stone-700" />
                <span>{order.customer.name}</span>
              </div>
              {order.customer.phone && (
                <div className="text-xs text-stone-700 flex items-center gap-1">
                  <Phone className="w-3 h-3 inline text-stone-500" />
                  <span>{order.customer.phone}</span>
                </div>
              )}
              <div className="text-xs pt-1">
                <div className="font-bold flex items-start gap-1">
                  <MapPin className="w-3.5 h-3.5 inline shrink-0 mt-0.5 text-stone-700" />
                  <span>
                    {order.customer.deliveryAddress.street}, {order.customer.deliveryAddress.number}
                    {order.customer.deliveryAddress.complement
                      ? ` (${order.customer.deliveryAddress.complement})`
                      : ''}
                  </span>
                </div>
                <div className="pl-4 text-[11px] text-stone-700">
                  {order.customer.deliveryAddress.neighborhood} - {order.customer.deliveryAddress.city}/
                  {order.customer.deliveryAddress.state}
                </div>
                {order.customer.deliveryAddress.reference && (
                  <div className="pl-4 text-[11px] text-stone-600 italic">
                    Ref: {order.customer.deliveryAddress.reference}
                  </div>
                )}
              </div>
            </div>

            {/* Items */}
            <div className="py-3 border-b border-dashed border-stone-400">
              <div className="text-[11px] font-bold pb-1.5 uppercase tracking-wider text-stone-600">
                ITENS DO PEDIDO
              </div>
              <div className="space-y-2.5">
                {order.items.map((item, idx) => (
                  <div key={idx} className="space-y-0.5">
                    <div className="flex justify-between items-start font-bold">
                      <span>
                        {item.quantity}x {item.name}
                      </span>
                      <span>{formatMoney(item.totalPriceInCents)}</span>
                    </div>
                    {item.options && item.options.length > 0 && (
                      <div className="pl-3 text-[11px] text-stone-600 space-y-0.5">
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
                      <div className="pl-3 text-[11px] font-bold text-amber-900 bg-amber-50 p-1 border-l-2 border-amber-600 mt-1">
                        OBS: {item.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            {order.notes && (
              <div className="py-2.5 border-b border-dashed border-stone-400 bg-stone-50 p-2 text-xs">
                <span className="font-bold">OBSERVAÇÕES DO CLIENTE:</span>
                <p className="mt-0.5 italic">{order.notes}</p>
              </div>
            )}

            {/* Totals */}
            <div className="py-3 border-b border-dashed border-stone-400 space-y-1 text-xs">
              <div className="flex justify-between text-stone-600">
                <span>Subtotal Itens:</span>
                <span>{formatMoney(order.financial.subtotalInCents)}</span>
              </div>
              {order.financial.deliveryFeeInCents > 0 && (
                <div className="flex justify-between text-stone-600">
                  <span>Taxa de Entrega:</span>
                  <span>{formatMoney(order.financial.deliveryFeeInCents)}</span>
                </div>
              )}
              {order.financial.discountInCents > 0 && (
                <div className="flex justify-between text-stone-600">
                  <span>Descontos / Cupom:</span>
                  <span>- {formatMoney(order.financial.discountInCents)}</span>
                </div>
              )}
              <div className="flex justify-between font-black text-sm pt-1 border-t border-dotted border-stone-300">
                <span>TOTAL A PAGAR:</span>
                <span>{formatMoney(order.financial.totalCustomerInCents)}</span>
              </div>
            </div>

            {/* Payment Info */}
            <div className="py-2.5 text-center text-xs">
              <div className="font-bold uppercase">
                PAGAMENTO:{' '}
                {order.financial.paidOnline
                  ? `PAGO ONLINE (${order.financial.paymentBrand || 'APP'})`
                  : 'PAGAR NA ENTREGA'}
              </div>
              <div className="text-[10px] text-stone-500 mt-1 flex items-center justify-center gap-1">
                <Clock className="w-3 h-3 inline" />
                <span>Tempo est. preparo: {order.estimatedPreparationMinutes} minutos</span>
              </div>
            </div>

            <div className="text-center pt-2 text-[10px] text-stone-400 border-t border-dashed border-stone-400">
              Impresso via Sistema Mise de Gestão
            </div>
          </div>
        </div>

        {/* Modal Footer with Actions */}
        <div className="px-5 py-3 border-t border-stone-200 bg-stone-50 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyText}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-stone-700 bg-white border border-stone-300 hover:bg-stone-100 rounded-xl cursor-pointer transition-colors shadow-2xs"
              title="Copiar texto puro formatado para enviar ou colar no bloco de notas"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-bold">Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-stone-500" />
                  <span>Copiar Texto</span>
                </>
              )}
            </button>
            <button
              onClick={handleDownloadText}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-stone-700 bg-white border border-stone-300 hover:bg-stone-100 rounded-xl cursor-pointer transition-colors shadow-2xs"
              title="Baixar comanda em arquivo .txt para impressoras de porta serial/spooler"
            >
              <Download className="w-3.5 h-3.5 text-stone-500" />
              <span>Baixar .TXT</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-200 rounded-xl cursor-pointer transition-colors"
            >
              Fechar
            </button>
            <button
              onClick={handlePrint}
              disabled={isPrinting}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl cursor-pointer transition-all shadow-sm ${
                printSuccess
                  ? 'bg-emerald-600 text-white'
                  : 'bg-stone-950 text-white hover:bg-stone-800'
              } disabled:opacity-50`}
            >
              {printSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                  <span>Comanda Enviada!</span>
                </>
              ) : (
                <>
                  <Printer className="w-4 h-4" />
                  <span>{isPrinting ? 'Enviando...' : 'Imprimir na Térmica'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
