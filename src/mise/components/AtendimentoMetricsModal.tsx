/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise Atendimento — Painel de Indicadores de Atendimento
 * Métricas em tempo real calculadas deterministicamente sobre o histórico de conversas.
 */

import React, { useState } from 'react';
import { X, BarChart3, Clock, CheckCircle2, MessageSquare, AlertCircle, HelpCircle } from 'lucide-react';
import { AtendimentoMetrics } from '../domain/atendimento-types';

interface AtendimentoMetricsModalProps {
  metrics: AtendimentoMetrics | null;
  isOpen: boolean;
  onClose: () => void;
}

export const AtendimentoMetricsModal: React.FC<AtendimentoMetricsModalProps> = ({
  metrics,
  isOpen,
  onClose,
}) => {
  const [showFormulaModal, setShowFormulaModal] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col border border-stone-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-stone-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900">Métricas do Atendimento</h2>
              <p className="text-xs text-stone-500">
                Indicadores de volume, tempo de resposta e produtividade da equipe
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFormulaModal(true)}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-stone-600 hover:text-stone-900 hover:bg-stone-200/60 rounded-lg border border-stone-200 transition-colors cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5 text-stone-500" />
              <span>Como calculamos</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {!metrics ? (
            <div className="text-center py-12 text-stone-400 text-sm">
              Carregando indicadores do atendimento...
            </div>
          ) : (
            <>
              {/* Top Key KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 bg-stone-50 rounded-xl border border-stone-200">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                      Total Conversas
                    </span>
                    <MessageSquare className="w-4 h-4 text-stone-400" />
                  </div>
                  <div className="mt-2 text-2xl font-black text-stone-900">
                    {metrics.totalConversations}
                  </div>
                  <div className="text-[10px] text-stone-500 mt-0.5">
                    Clientes únicos atendidos
                  </div>
                </div>

                <div className="p-4 bg-orange-50/50 rounded-xl border border-orange-200/60">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-orange-700">
                      Abertas / Em Fila
                    </span>
                    <AlertCircle className="w-4 h-4 text-orange-500" />
                  </div>
                  <div className="mt-2 text-2xl font-black text-orange-900">
                    {metrics.openConversations}
                  </div>
                  <div className="text-[10px] text-orange-700/80 mt-0.5">
                    Aguardando resposta inicial
                  </div>
                </div>

                <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-200/60">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">
                      Em Andamento
                    </span>
                    <Clock className="w-4 h-4 text-blue-500" />
                  </div>
                  <div className="mt-2 text-2xl font-black text-blue-900">
                    {metrics.inProgressConversations}
                  </div>
                  <div className="text-[10px] text-blue-700/80 mt-0.5">
                    Atendimento em curso
                  </div>
                </div>

                <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200/60">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
                      Resolvidas
                    </span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="mt-2 text-2xl font-black text-emerald-900">
                    {metrics.resolvedConversations}
                  </div>
                  <div className="text-[10px] text-emerald-700/80 mt-0.5">
                    Finalizadas com sucesso
                  </div>
                </div>
              </div>

              {/* Time to respond & unread badge */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-xs">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-orange-600" />
                    <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                      Tempo Médio de Primeira Resposta
                    </h3>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-stone-900">
                      {metrics.averageFirstResponseTimeMinutes > 0
                        ? `${metrics.averageFirstResponseTimeMinutes} min`
                        : '< 1 min'}
                    </span>
                    <span className="text-xs text-stone-500">desde a mensagem do cliente</span>
                  </div>
                  <p className="text-xs text-stone-500 mt-2">
                    Um tempo de resposta abaixo de 5 minutos reduz o abandono de pedidos em delivery em até 40%.
                  </p>
                </div>

                <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-xs">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="w-4 h-4 text-stone-700" />
                    <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                      Mensagens Pendentes de Leitura
                    </h3>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-stone-900">
                      {metrics.unreadMessagesCount}
                    </span>
                    <span className="text-xs text-stone-500">mensagens acumuladas na caixa</span>
                  </div>
                  <p className="text-xs text-stone-500 mt-2">
                    Monitore para evitar clientes esperando por confirmação de pagamento ou entrega.
                  </p>
                </div>
              </div>

              {/* Breakdown by Attendant & Breakdown by Tag */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Attendants */}
                <div className="p-4 bg-stone-50 rounded-xl border border-stone-200">
                  <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider mb-3">
                    Conversas por Atendente
                  </h3>
                  {metrics.conversationsByAttendant.length === 0 ? (
                    <p className="text-xs text-stone-400">Nenhum atendimento atribuído ainda.</p>
                  ) : (
                    <div className="space-y-2">
                      {metrics.conversationsByAttendant.map((att) => (
                        <div
                          key={att.userId}
                          className="flex items-center justify-between p-2 bg-white rounded-lg border border-stone-200 text-xs"
                        >
                          <span className="font-semibold text-stone-800">{att.userName}</span>
                          <span className="px-2 py-0.5 bg-stone-100 rounded font-bold text-stone-700">
                            {att.count} {att.count === 1 ? 'conversa' : 'conversas'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Tags */}
                <div className="p-4 bg-stone-50 rounded-xl border border-stone-200">
                  <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider mb-3">
                    Conversas por Etiqueta
                  </h3>
                  {metrics.conversationsByTag.length === 0 ? (
                    <p className="text-xs text-stone-400">Nenhuma etiqueta atribuída a conversas.</p>
                  ) : (
                    <div className="space-y-2">
                      {metrics.conversationsByTag.map((tg) => (
                        <div
                          key={tg.tagId}
                          className="flex items-center justify-between p-2 bg-white rounded-lg border border-stone-200 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: tg.color }}
                            />
                            <span className="font-semibold text-stone-800">{tg.tagName}</span>
                          </div>
                          <span className="px-2 py-0.5 bg-stone-100 rounded font-bold text-stone-700">
                            {tg.count}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-stone-100 bg-stone-50 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-200 rounded-lg transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>

      {/* Como Calculamos Modal */}
      {showFormulaModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-orange-600" />
                Como calculamos as métricas
              </h3>
              <button
                onClick={() => setShowFormulaModal(false)}
                className="text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-stone-600 space-y-3 leading-relaxed">
              <p>
                <strong>1. Volume de conversas:</strong> Contabiliza o número de contatos únicos que iniciaram conversa com o WhatsApp da empresa.
              </p>
              <p>
                <strong>2. Tempo Médio de Primeira Resposta:</strong> Para cada conversa onde o primeiro contato foi do cliente, calculamos a diferença exata em minutos entre a primeira mensagem recebida (<code className="bg-stone-100 px-1 font-mono">t1</code>) e a primeira resposta enviada pelo estabelecimento (<code className="bg-stone-100 px-1 font-mono">t2</code>).
              </p>
              <div className="p-2 bg-stone-100 rounded-lg font-mono text-[11px] text-stone-800">
                TMPR = Σ(t2 - t1) / N_conversas_respondidas
              </div>
              <p>
                <strong>3. Distribuição por Atendente:</strong> Filtra conversas pelo campo <code className="bg-stone-100 px-1 font-mono">assignedUserId</code> para auditoria de carga de trabalho individual.
              </p>
              <p className="text-[11px] text-stone-500 italic">
                Cálculo 100% determinístico e auditável, sem estimativas estatísticas ou suposições.
              </p>
            </div>

            <button
              onClick={() => setShowFormulaModal(false)}
              className="w-full py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
