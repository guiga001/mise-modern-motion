/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise Atendimento — Modal de Conexão WhatsApp via QR Code ou Código de Pareamento
 * Cada restaurante possui sessão própria, isolada e com conexão exclusiva.
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  QrCode,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  LogOut,
  ShieldCheck,
  Info,
  Clock,
  KeyRound,
  Copy,
  Check,
  HelpCircle,
} from 'lucide-react';
import { WhatsAppSessionInfo } from '../domain/atendimento-types';
import { atendimentoApi } from '../lib/atendimento-api';

interface WhatsAppConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  companyName: string;
  sessionInfo: WhatsAppSessionInfo;
  onSessionUpdated: (info: WhatsAppSessionInfo) => void;
}

export const WhatsAppConnectModal: React.FC<WhatsAppConnectModalProps> = ({
  isOpen,
  onClose,
  companyId,
  companyName,
  sessionInfo,
  onSessionUpdated,
}) => {
  const [connectTab, setConnectTab] = useState<'qr' | 'pairing_code'>('qr');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  // Polling e sincronização contínua enquanto o modal estiver aberto
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchLatest = async () => {
      try {
        const latest = await atendimentoApi.getSession(companyId);
        if (isMounted) {
          onSessionUpdated(latest);
        }
      } catch (err) {
        // Silencioso
      }
    };

    fetchLatest();

    // Se estiver aguardando scan ou iniciando, faz polling rápido a cada 1.5s
    const interval = setInterval(() => {
      fetchLatest();
    }, 1500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isOpen, companyId]);

  // Se abrir o modal na aba QR e não estiver conectado nem tiver QR ativo, gera automaticamente
  useEffect(() => {
    if (
      isOpen &&
      connectTab === 'qr' &&
      sessionInfo.status !== 'CONNECTED' &&
      !sessionInfo.qrCodeDataUrl &&
      !loading
    ) {
      handleStartConnect(false);
    }
  }, [isOpen, connectTab, sessionInfo.status, sessionInfo.qrCodeDataUrl]);

  if (!isOpen) return null;

  const handleStartConnect = async (forceNew = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await atendimentoApi.connectWhatsApp(companyId, forceNew);
      onSessionUpdated(res);
    } catch (err: any) {
      setError(err?.message || 'Falha ao iniciar conexão WhatsApp.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestPairingCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = phoneNumber.replace(/[^0-9]/g, '');
    if (!clean || clean.length < 10) {
      setError('Digite o número com DDD (ex: 11999998888 ou 5511999998888).');
      return;
    }

    setGeneratingCode(true);
    setError(null);
    try {
      // Se não tiver prefixo internacional 55 (Brasil), adiciona automaticamente
      const fullNumber = clean.startsWith('55') ? clean : `55${clean}`;
      const res = await atendimentoApi.requestPairingCode(companyId, fullNumber);
      onSessionUpdated(res.sessionInfo);
    } catch (err: any) {
      setError(err?.message || 'Falha ao solicitar código de pareamento do WhatsApp.');
    } finally {
      setGeneratingCode(false);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code.replace('-', ''));
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleDisconnect = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await atendimentoApi.disconnectWhatsApp(companyId);
      onSessionUpdated(res);
      setConfirmDisconnect(false);
    } catch (err: any) {
      setError(err?.message || 'Falha ao desconectar.');
    } finally {
      setLoading(false);
    }
  };

  const isConnected = sessionInfo.status === 'CONNECTED';
  const isAwaitingScan = sessionInfo.status === 'AWAITING_SCAN';
  const isConnecting = sessionInfo.status === 'CONNECTING' || sessionInfo.status === 'STARTING';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/70 backdrop-blur-xs">
      <div
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-neutral-950 text-orange-500 flex items-center justify-center shadow-xs">
              <QrCode className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-950 leading-tight">
                Conectar WhatsApp do Restaurante
              </h3>
              <p className="text-xs text-neutral-500">
                {companyName} · Sessão Exclusiva e Isolada
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* ESTADO: CONECTADO */}
          {isConnected && (
            <div className="text-center py-4 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 mx-auto flex items-center justify-center shadow-xs">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  WhatsApp Conectado com Sucesso
                </span>
                <h4 className="text-xl font-black text-neutral-950 mt-3 font-mono">
                  {sessionInfo.phoneNumber ? `+${sessionInfo.phoneNumber}` : 'Número Conectado'}
                </h4>
                {sessionInfo.profileName && (
                  <p className="text-xs text-neutral-500 mt-0.5">Perfil: {sessionInfo.profileName}</p>
                )}
                {sessionInfo.connectedAt && (
                  <p className="text-[11px] text-neutral-400 mt-1 font-mono">
                    Conectado em: {new Date(sessionInfo.connectedAt).toLocaleString('pt-BR')}
                  </p>
                )}
              </div>

              <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 text-left text-xs text-neutral-600 space-y-2">
                <div className="flex items-center gap-2 font-bold text-neutral-900">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Sessão 100% isolada e ativa</span>
                </div>
                <p>
                  Todas as mensagens enviadas e recebidas por este número são sincronizadas automaticamente na Caixa de
                  Entrada do MISE em tempo real.
                </p>
              </div>

              {!confirmDisconnect ? (
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => handleStartConnect(true)}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold text-white bg-neutral-950 hover:bg-neutral-900 transition-colors cursor-pointer shadow-xs"
                  >
                    <RefreshCw className={`w-4 h-4 text-orange-400 ${loading ? 'animate-spin' : ''}`} />
                    <span>{loading ? 'Gerando Novo QR Code...' : 'Trocar Aparelho / Gerar Novo QR Code'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDisconnect(true)}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Desconectar Este WhatsApp</span>
                  </button>
                </div>
              ) : (
                <div className="p-4 bg-rose-50/90 border border-rose-200 rounded-2xl space-y-3 text-left">
                  <div>
                    <p className="text-xs font-bold text-rose-900">
                      Deseja realmente desconectar este WhatsApp?
                    </p>
                    <p className="text-[11px] text-rose-700 mt-0.5">
                      O atendimento em tempo real ficará pausado até você reconectar. As mensagens salvas permanecerão no sistema.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmDisconnect(false)}
                      disabled={loading}
                      className="flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold bg-white text-neutral-700 border border-neutral-300 hover:bg-neutral-50 transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleDisconnect}
                      disabled={loading}
                      className="flex-1 py-2.5 px-3 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>{loading ? 'Desconectando...' : 'Confirmar Desconexão'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ESTADO NÃO CONECTADO: ABAS DE ESCOLHA (QR CODE OU CÓDIGO DE 8 DÍGITOS) */}
          {!isConnected && (
            <div>
              {/* Seletor de Método de Conexão */}
              <div className="flex rounded-xl bg-neutral-100 p-1 mb-4 border border-neutral-200">
                <button
                  type="button"
                  onClick={() => setConnectTab('qr')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    connectTab === 'qr'
                      ? 'bg-white text-neutral-950 shadow-xs'
                      : 'text-neutral-500 hover:text-neutral-900'
                  }`}
                >
                  <QrCode className="w-4 h-4 text-orange-600" />
                  <span>QR Code na Tela</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConnectTab('pairing_code')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    connectTab === 'pairing_code'
                      ? 'bg-white text-neutral-950 shadow-xs'
                      : 'text-neutral-500 hover:text-neutral-900'
                  }`}
                >
                  <KeyRound className="w-4 h-4 text-orange-600" />
                  <span>Código de 8 Dígitos</span>
                </button>
              </div>

              {/* ABA 1: QR CODE */}
              {connectTab === 'qr' && (
                <div className="space-y-4">
                  {/* Se tem QR Code pronto */}
                  {sessionInfo.qrCodeDataUrl ? (
                    <div className="space-y-4 text-center">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-orange-600 font-mono">
                          Escaneie com a Câmera do WhatsApp
                        </p>
                        <p className="text-xs text-neutral-500 mt-1">
                          WhatsApp &gt; Menu/Configurações &gt; Aparelhos conectados &gt; Conectar um aparelho
                        </p>
                      </div>

                      <div className="relative mx-auto w-64 h-64 p-3 bg-white rounded-2xl border-2 border-neutral-950 shadow-md flex items-center justify-center">
                        <img
                          src={sessionInfo.qrCodeDataUrl}
                          alt="QR Code WhatsApp MISE Atendimento"
                          className="w-full h-full object-contain"
                        />
                      </div>

                      <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-left text-xs text-neutral-600 space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-neutral-900">
                          <HelpCircle className="w-3.5 h-3.5 text-orange-600" />
                          <span>Se o WhatsApp disser "QR code inválido":</span>
                        </div>
                        <p className="text-[11px] text-neutral-500 leading-relaxed">
                          1. Clique no botão <strong>"Gerar Novo QR Code"</strong> abaixo para renovar o handshake.<br />
                          2. Ou mude para a aba <strong>"Código de 8 Dígitos"</strong> acima para conectar pelo número sem depender da câmera!
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleStartConnect(true)}
                          disabled={loading}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold text-neutral-800 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 transition-colors cursor-pointer"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                          <span>{loading ? 'Renovando...' : 'Gerar Novo QR Code'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={onClose}
                          className="px-4 py-2.5 rounded-xl text-xs font-bold text-neutral-600 hover:text-neutral-900 bg-white border border-neutral-200 hover:bg-neutral-50 transition-colors cursor-pointer"
                        >
                          Fechar
                        </button>
                      </div>
                    </div>
                  ) : isConnecting || loading ? (
                    <div className="text-center py-10 space-y-4">
                      <div className="w-12 h-12 rounded-2xl bg-neutral-950 text-orange-500 mx-auto flex items-center justify-center animate-pulse">
                        <RefreshCw className="w-6 h-6 animate-spin" />
                      </div>
                      <h4 className="text-sm font-bold text-neutral-900">
                        Gerando QR Code Oficial do WhatsApp...
                      </h4>
                      <p className="text-xs text-neutral-500 max-w-xs mx-auto">
                        Iniciando canal criptografado para o restaurante {companyName}. O código aparecerá em instantes.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-4 bg-orange-50/70 border border-orange-200 rounded-2xl flex items-start gap-3">
                        <Smartphone className="w-5 h-5 text-orange-600 mt-0.5 shrink-0" />
                        <div className="text-xs text-neutral-700 leading-relaxed">
                          <strong className="block text-neutral-950 font-bold mb-1">
                            Conexão Direta e Independente
                          </strong>
                          Gere o QR Code oficial para conectar o aparelho do seu restaurante com total segurança e criptografia de ponta a ponta.
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleStartConnect(true)}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl text-xs font-bold text-white bg-neutral-950 hover:bg-neutral-900 border border-neutral-950 hover:border-orange-500 shadow-sm transition-all cursor-pointer"
                      >
                        <QrCode className="w-4 h-4 text-orange-400" />
                        <span>{loading ? 'Gerando QR Code...' : 'Gerar QR Code Agora'}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ABA 2: CÓDIGO DE PAREAMENTO (SEM CÂMERA) */}
              {connectTab === 'pairing_code' && (
                <div className="space-y-4">
                  <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-2xl text-xs text-neutral-700 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-neutral-950">
                      <KeyRound className="w-4 h-4 text-orange-600" />
                      <span>Conectar sem precisar de Câmera</span>
                    </div>
                    <p className="text-neutral-500 text-[11px] leading-relaxed">
                      Informe o número de telefone do WhatsApp da sua empresa. Você receberá um código de 8 dígitos para digitar diretamente dentro do aplicativo WhatsApp do seu celular.
                    </p>
                  </div>

                  {sessionInfo.pairingCode ? (
                    <div className="p-5 bg-orange-50/60 border-2 border-orange-300 rounded-2xl text-center space-y-4">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-orange-700 font-mono">
                        Seu Código de Pareamento
                      </span>
                      <div className="flex items-center justify-center gap-2">
                        <div className="text-3xl font-black font-mono tracking-widest text-neutral-950 bg-white px-5 py-3 rounded-xl border border-orange-200 shadow-xs">
                          {sessionInfo.pairingCode}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyCode(sessionInfo.pairingCode || '')}
                          className="p-3 bg-white border border-neutral-200 rounded-xl hover:bg-neutral-50 text-neutral-700 cursor-pointer transition-colors"
                          title="Copiar Código"
                        >
                          {copiedCode ? <Check className="w-5 h-5 text-emerald-600" /> : <Copy className="w-5 h-5" />}
                        </button>
                      </div>

                      <div className="text-left bg-white p-3.5 rounded-xl border border-neutral-200 text-xs text-neutral-600 space-y-1.5">
                        <p className="font-bold text-neutral-950">Passo a passo no seu celular:</p>
                        <p>1. Abra o WhatsApp no celular</p>
                        <p>2. Toque em <strong>Configurações</strong> &gt; <strong>Aparelhos conectados</strong></p>
                        <p>3. Toque em <strong>Conectar um aparelho</strong></p>
                        <p>4. Na parte inferior da tela, toque em <strong>"Conectar com número de telefone em vez disso"</strong></p>
                        <p>5. Digite o código de 8 dígitos acima: <strong>{sessionInfo.pairingCode}</strong></p>
                      </div>

                      <div className="flex items-center justify-center gap-1.5 text-xs text-neutral-500 font-mono">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Aguardando você digitar o código no celular...</span>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleRequestPairingCode} className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-neutral-900 mb-1.5">
                          Número do WhatsApp do Restaurante (com DDD)
                        </label>
                        <input
                          type="tel"
                          placeholder="Ex: 11999998888 ou 5511999998888"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm font-mono focus:outline-hidden focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                        />
                        <p className="text-[11px] text-neutral-400 mt-1">
                          Apenas números. Se for do Brasil, o código 55 será incluído automaticamente.
                        </p>
                      </div>

                      <button
                        type="submit"
                        disabled={generatingCode || !phoneNumber.trim()}
                        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold text-white bg-neutral-950 hover:bg-neutral-900 border border-neutral-950 hover:border-orange-500 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                      >
                        <KeyRound className="w-4 h-4 text-orange-400" />
                        <span>{generatingCode ? 'Solicitando Código...' : 'Gerar Código de 8 Dígitos'}</span>
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Aviso Técnico Legal */}
          <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/80 text-[10px] text-neutral-500 leading-relaxed flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-neutral-400 shrink-0 mt-0.5" />
            <span>
              Arquitetura modular compatível com QR Code e Pairing Code (Baileys) e preparada para transição futura à WhatsApp Cloud API oficial. Respeite as boas práticas de envio para evitar restrições da Meta.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
