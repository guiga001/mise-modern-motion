/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise Atendimento — Central de Conversas e Atendimento via WhatsApp
 * Caixa de entrada profissional com 3 colunas, SSE em tempo real e isolamento por empresa.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  QrCode,
  Search,
  Send,
  UserCheck,
  Tag as TagIcon,
  Plus,
  BarChart3,
  Zap,
  Phone,
  Clock,
  CheckCheck,
  Check,
  FileText,
  Lock,
  ChevronRight,
  Filter,
  RefreshCw,
  MoreVertical,
  X,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Smartphone,
  Eye,
  EyeOff,
  UserPlus,
} from 'lucide-react';
import { MiseDatabaseState } from '../lib/storage';
import {
  WhatsAppSessionInfo,
  WhatsAppConversation,
  WhatsAppMessage,
  AtendimentoTag,
  QuickReply,
  InternalNote,
  AtendimentoMetrics,
  ConversationStatus,
} from '../domain/atendimento-types';
import { atendimentoApi } from '../lib/atendimento-api';
import { WhatsAppConnectModal } from './WhatsAppConnectModal';
import { QuickRepliesModal } from './QuickRepliesModal';
import { AtendimentoMetricsModal } from './AtendimentoMetricsModal';

interface AtendimentoTabProps {
  database: MiseDatabaseState;
  onUpdateDatabase?: (newState: MiseDatabaseState) => void;
}

export const AtendimentoTab: React.FC<AtendimentoTabProps> = ({
  database,
}) => {
  const companyId = database.company?.id || 'default_restaurant';
  const companyName = database.company?.name || 'Mise Restaurante';
  const activeUser = database.users.find((u) => u.id === database.activeUserId);

  // States
  const [session, setSession] = useState<WhatsAppSessionInfo | null>(null);
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<WhatsAppConversation | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [tags, setTags] = useState<AtendimentoTag[]>([]);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [metrics, setMetrics] = useState<AtendimentoMetrics | null>(null);

  // Modals
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isQuickRepliesModalOpen, setIsQuickRepliesModalOpen] = useState(false);
  const [isMetricsModalOpen, setIsMetricsModalOpen] = useState(false);
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [showRightSidebar, setShowRightSidebar] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<ConversationStatus | 'ALL'>('ALL');
  const [attendantFilter, setAttendantFilter] = useState<string>('ALL');
  const [tagFilter, setTagFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Composer
  const [inputText, setInputText] = useState('');
  const [isInternalNoteMode, setIsInternalNoteMode] = useState(false);
  const [showQuickReplySuggest, setShowQuickReplySuggest] = useState(false);
  const [suggestFilter, setSuggestFilter] = useState('');
  const [sending, setSending] = useState(false);

  // New Chat Form
  const [newChatPhone, setNewChatPhone] = useState('');
  const [newChatName, setNewChatName] = useState('');
  const [newChatInitialMsg, setNewChatInitialMsg] = useState('');

  // Inline Tag Creator
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#f97316');
  const [actionError, setActionError] = useState<string | null>(null);

  // Messages auto-scroll
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedConversationRef = useRef<WhatsAppConversation | null>(null);
  selectedConversationRef.current = selectedConversation;

  // 1. Initial Load & Periodic Refresh
  const reloadData = async () => {
    try {
      const [sess, convs, tgs, qrs, met] = await Promise.all([
        atendimentoApi.getSession(companyId).catch(() => null),
        atendimentoApi.getConversations(companyId, {
          status: statusFilter,
          assignedUserId: attendantFilter !== 'ALL' ? attendantFilter : undefined,
          tagId: tagFilter !== 'ALL' ? tagFilter : undefined,
          search: searchQuery || undefined,
        }).catch(() => []),
        atendimentoApi.getTags(companyId).catch(() => []),
        atendimentoApi.getQuickReplies(companyId).catch(() => []),
        atendimentoApi.getMetrics(companyId).catch(() => null),
      ]);

      if (sess) setSession(sess);
      setConversations(convs);
      setTags(tgs);
      setQuickReplies(qrs);
      if (met) setMetrics(met);

      // Sincroniza a conversa ativa usando a ref atual para evitar sobreposição por closures antigas
      const currentId = selectedConversationRef.current?.id;
      if (currentId) {
        const found = convs.find((c) => c.id === currentId);
        if (found) setSelectedConversation(found);
      }
    } catch (err) {
      console.error('Erro ao carregar dados do Atendimento:', err);
    }
  };

  useEffect(() => {
    reloadData();
  }, [companyId, statusFilter, attendantFilter, tagFilter, searchQuery]);

  // 2. Real-time SSE Subscription estável por empresa
  useEffect(() => {
    const unsubscribe = atendimentoApi.subscribeEvents(companyId, (event) => {
      if (event.type === 'session_status' || event.type === 'SESSION_UPDATE') {
        setSession(event.data);
      } else if (event.type === 'new_message' || event.type === 'MESSAGE_NEW') {
        const newMsg: WhatsAppMessage = event.data;
        // Se pertencer à conversa atualmente aberta, anexa à lista sem esperar polling
        if (selectedConversationRef.current?.id === newMsg.conversationId) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          atendimentoApi.markAsRead(companyId, newMsg.conversationId).catch(() => {});
        }
        reloadData();
      } else if (
        event.type === 'conversation_updated' ||
        event.type === 'CONVERSATION_UPDATE' ||
        event.type === 'CONVERSATION_NEW'
      ) {
        reloadData();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [companyId]);

  // 3. Troca de conversa com limpeza imediata de mensagens e carregamento seguro
  const handleSelectConversation = (conv: WhatsAppConversation) => {
    setSelectedConversation(conv);
    selectedConversationRef.current = conv;
    setMessages([]); // Limpa imediatamente para NUNCA exibir mensagens da conversa anterior
    setActionError(null);

    atendimentoApi
      .getMessages(companyId, conv.id)
      .then((msgs) => {
        // Aplica apenas se a conversa ainda for a selecionada no momento do retorno
        if (selectedConversationRef.current?.id === conv.id) {
          setMessages(msgs);
        }
      })
      .catch((err) => console.error('Erro ao buscar mensagens:', err));

    if (conv.unreadCount > 0) {
      atendimentoApi.markAsRead(companyId, conv.id).catch(() => {});
    }
  };

  // 4. Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 5. Enviar Mensagem no WhatsApp ou Nota Interna
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const targetConv = selectedConversationRef.current || selectedConversation;
    if (!targetConv || !inputText.trim() || sending) return;

    const text = inputText.trim();
    setSending(true);
    setActionError(null);

    // Mensagem otimista imediata na interface
    const tempId = `temp_${Date.now()}`;
    const optimisticMsg: WhatsAppMessage = {
      id: tempId,
      conversationId: targetConv.id,
      companyId,
      fromMe: true,
      senderPhone: session?.phoneNumber || 'Restaurante',
      senderName: activeUser?.name || 'Restaurante',
      text,
      type: 'TEXT',
      timestamp: new Date().toISOString(),
      status: 'SENT',
      isInternalNote: isInternalNoteMode,
      authorId: activeUser?.id,
      authorName: activeUser?.name,
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setInputText('');

    try {
      if (isInternalNoteMode) {
        await atendimentoApi.addNote(
          companyId,
          targetConv.id,
          text,
          activeUser?.name || 'Dono',
          activeUser?.id || 'dono'
        );
        setIsInternalNoteMode(false);
      } else {
        await atendimentoApi.sendMessage(
          companyId,
          targetConv.id,
          text,
          activeUser?.name || 'Dono',
          activeUser?.id || 'dono'
        );
      }

      // Atualiza mensagens confirmadas do servidor
      const updatedMsgs = await atendimentoApi.getMessages(companyId, targetConv.id);
      if (selectedConversationRef.current?.id === targetConv.id) {
        setMessages(updatedMsgs);
      }
      reloadData();
    } catch (err: any) {
      // Reverte mensagem otimista e restaura texto no campo
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInputText(text);
      setActionError('Não foi possível enviar a mensagem: ' + (err?.message || String(err)));
    } finally {
      setSending(false);
    }
  };

  // 6. Handle Input changes for Quick Replies suggestion
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputText(val);

    // If starts with / or has / shortcut
    const slashMatch = val.match(/\/([a-zA-Z0-9_-]*)$/);
    if (slashMatch) {
      setShowQuickReplySuggest(true);
      setSuggestFilter(slashMatch[1].toLowerCase());
    } else {
      setShowQuickReplySuggest(false);
    }
  };

  const insertQuickReply = (qr: QuickReply) => {
    // Replace trailing /... with content
    const replaced = inputText.replace(/\/([a-zA-Z0-9_-]*)$/, qr.content);
    setInputText(replaced);
    setShowQuickReplySuggest(false);
    atendimentoApi.recordQuickReplyUsage(companyId, qr.id);
  };

  // 7. Status update
  const handleStatusChange = async (newStatus: ConversationStatus) => {
    if (!selectedConversation) return;
    try {
      const updated = await atendimentoApi.updateStatus(companyId, selectedConversation.id, newStatus);
      setSelectedConversation(updated);
      reloadData();
    } catch (err: any) {
      setActionError('Erro ao atualizar status: ' + (err?.message || String(err)));
    }
  };

  // 8. Attendant Assign
  const handleAssignAttendant = async (userId: string) => {
    if (!selectedConversation) return;
    try {
      const user = database.users.find((u) => u.id === userId);
      const updated = await atendimentoApi.assignAttendant(
        companyId,
        selectedConversation.id,
        user ? user.id : undefined,
        user ? user.name : undefined
      );
      setSelectedConversation(updated);
      reloadData();
    } catch (err: any) {
      setActionError('Erro ao transferir conversa: ' + (err?.message || String(err)));
    }
  };

  // 9. Tag Toggle
  const handleToggleTag = async (tagId: string) => {
    if (!selectedConversation) return;
    const currentTags = selectedConversation.tags || [];
    const newTags = currentTags.includes(tagId)
      ? currentTags.filter((t) => t !== tagId)
      : [...currentTags, tagId];

    try {
      const updated = await atendimentoApi.updateTags(companyId, selectedConversation.id, newTags);
      setSelectedConversation(updated);
      reloadData();
    } catch (err: any) {
      setActionError('Erro ao atualizar etiquetas: ' + (err?.message || String(err)));
    }
  };

  // 10. Create New Tag Inline
  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) return;
    try {
      await atendimentoApi.saveTag(companyId, {
        name: newTagName.trim(),
        color: newTagColor,
      });
      setNewTagName('');
      setIsCreatingTag(false);
      const updatedTags = await atendimentoApi.getTags(companyId);
      setTags(updatedTags);
    } catch (err: any) {
      setActionError('Erro ao criar etiqueta: ' + (err?.message || String(err)));
    }
  };

  // 11. Create New Conversation
  const handleCreateNewConversation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChatPhone.trim()) return;

    try {
      const conv = await atendimentoApi.createConversation(companyId, {
        customerPhone: newChatPhone.trim(),
        customerName: newChatName.trim() || undefined,
        initialMessage: newChatInitialMsg.trim() || undefined,
        authorName: activeUser?.name || 'Dono',
        authorId: activeUser?.id || 'dono',
      });
      setIsNewChatModalOpen(false);
      setNewChatPhone('');
      setNewChatName('');
      setNewChatInitialMsg('');
      setSelectedConversation(conv);
      reloadData();
    } catch (err: any) {
      setActionError('Erro ao iniciar conversa: ' + (err?.message || String(err)));
    }
  };

  // Status helper badge
  const renderStatusBadge = (status: ConversationStatus) => {
    switch (status) {
      case 'OPEN':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-amber-100 text-amber-800">
            Aberta
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-blue-100 text-blue-800">
            Em Andamento
          </span>
        );
      case 'WAITING_CUSTOMER':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-stone-100 text-stone-700">
            Aguardando Cliente
          </span>
        );
      case 'RESOLVED':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-100 text-emerald-800">
            Resolvida
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-stone-100 overflow-hidden">
      {/* Top Banner / Sub-Header */}
      <div className="bg-white border-b border-stone-200 px-4 py-2.5 flex items-center justify-between gap-4 flex-wrap z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-500 text-white flex items-center justify-center font-bold shadow-xs">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-stone-900 leading-tight">
                Mise Atendimento WhatsApp
              </h1>
              <div className="flex items-center gap-2 text-[11px] text-stone-500">
                <span>{companyName}</span>
                <span aria-hidden="true">·</span>
                {session?.status === 'CONNECTED' ? (
                  <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Conectado {session.phoneNumber ? `(${session.phoneNumber})` : ''}
                  </span>
                ) : session?.status === 'CONNECTING' || session?.status === 'AWAITING_SCAN' ? (
                  <span className="flex items-center gap-1 text-amber-600 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                    Aguardando Leitura do QR Code
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-stone-500 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-stone-400" />
                    Desconectado
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsConnectModalOpen(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer border ${
              session?.status === 'CONNECTED'
                ? 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                : 'bg-orange-600 text-white border-orange-600 hover:bg-orange-700 shadow-xs'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>{session?.status === 'CONNECTED' ? 'Gerenciar WhatsApp' : 'Conectar WhatsApp'}</span>
          </button>

          <button
            onClick={() => setIsMetricsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-stone-700 bg-white hover:bg-stone-50 rounded-lg border border-stone-200 transition-colors cursor-pointer"
          >
            <BarChart3 className="w-3.5 h-3.5 text-stone-500" />
            <span className="hidden sm:inline">Métricas</span>
          </button>

          <button
            onClick={() => setIsQuickRepliesModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-stone-700 bg-white hover:bg-stone-50 rounded-lg border border-stone-200 transition-colors cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline">Respostas Rápidas</span>
          </button>

          <button
            onClick={() => setIsNewChatModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-lg border border-stone-200 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-stone-700" />
            <span>Nova Conversa</span>
          </button>
        </div>
      </div>

      {/* Action Error Banner */}
      {actionError && (
        <div className="mx-6 mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button
            onClick={() => setActionError(null)}
            className="p-1 text-rose-500 hover:text-rose-800 rounded-md cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main 3-Column Grid */}
      <div className="flex-1 flex overflow-hidden">
        {/* =========================================
            COLUMN 1: CONVERSATIONS LIST
            ========================================= */}
        <div className="w-80 md:w-88 bg-white border-r border-stone-200 flex flex-col flex-shrink-0">
          {/* Search & Filters Header */}
          <div className="p-3 border-b border-stone-100 space-y-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar cliente, número ou texto..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-stone-50 rounded-lg border border-stone-200 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>

            {/* Status Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px]">
              {(['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2 py-1 rounded-md font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                    statusFilter === st
                      ? 'bg-stone-900 text-white'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {st === 'ALL' && 'Todas'}
                  {st === 'OPEN' && 'Abertas'}
                  {st === 'IN_PROGRESS' && 'Em Curso'}
                  {st === 'RESOLVED' && 'Resolvidas'}
                </button>
              ))}
            </div>

            {/* Sub-Filters: Attendant & Tag */}
            <div className="flex items-center gap-2">
              <select
                value={attendantFilter}
                onChange={(e) => setAttendantFilter(e.target.value)}
                className="flex-1 py-1 px-2 text-[11px] font-medium text-stone-700 bg-stone-50 rounded-md border border-stone-200"
              >
                <option value="ALL">Todos os atendentes</option>
                {database.users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>

              <select
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                className="flex-1 py-1 px-2 text-[11px] font-medium text-stone-700 bg-stone-50 rounded-md border border-stone-200"
              >
                <option value="ALL">Todas as etiquetas</option>
                {tags.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Conversations Scroll Area */}
          <div className="flex-1 overflow-y-auto divide-y divide-stone-100">
            {conversations.length === 0 ? (
              <div className="text-center py-12 px-4 space-y-2">
                <div className="w-10 h-10 rounded-full bg-stone-100 text-stone-400 mx-auto flex items-center justify-center">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-stone-700">Nenhuma conversa encontrada</p>
                <p className="text-[11px] text-stone-400">
                  {session?.status === 'CONNECTED'
                    ? 'Mensagens enviadas para o seu WhatsApp aparecerão aqui instantaneamente.'
                    : 'Conecte seu WhatsApp para começar a receber mensagens de clientes.'}
                </p>
                <button
                  onClick={() => setIsNewChatModalOpen(true)}
                  className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-orange-600 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Iniciar primeira conversa</span>
                </button>
              </div>
            ) : (
              conversations.map((conv) => {
                const isSelected = selectedConversation?.id === conv.id;
                const convTags = tags.filter((t) => conv.tags?.includes(t.id));

                return (
                  <div
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv)}
                    className={`p-3 cursor-pointer transition-colors flex items-start gap-3 select-none ${
                      isSelected
                        ? 'bg-orange-50/60 border-l-4 border-orange-500'
                        : 'hover:bg-stone-50'
                    }`}
                  >
                    {/* Avatar with initial */}
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-stone-200 text-stone-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                        {conv.customerName
                          ? conv.customerName.charAt(0).toUpperCase()
                          : conv.customerPhone.slice(-2)}
                      </div>
                      {conv.unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-orange-600 text-white text-[10px] font-black flex items-center justify-center border-2 border-white">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-stone-900 truncate">
                          {conv.customerName || conv.customerPhone}
                        </span>
                        <span className="text-[10px] text-stone-400 whitespace-nowrap">
                          {conv.lastMessageTimestamp
                            ? new Date(conv.lastMessageTimestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : ''}
                        </span>
                      </div>

                      <p className="text-[11px] text-stone-500 truncate mt-0.5">
                        {conv.lastMessageText || 'Conversa iniciada'}
                      </p>

                      {/* Meta badges: Status, Attendant, Tags */}
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        {renderStatusBadge(conv.status)}

                        {conv.assignedUserName && (
                          <span className="text-[10px] text-stone-600 bg-stone-100 px-1.5 py-0.5 rounded flex items-center gap-1">
                            <UserCheck className="w-2.5 h-2.5 text-stone-400" />
                            {conv.assignedUserName}
                          </span>
                        )}

                        {convTags.map((tg) => (
                          <span
                            key={tg.id}
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded text-white"
                            style={{ backgroundColor: tg.color }}
                          >
                            {tg.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* =========================================
            COLUMN 2: CHAT AREA & THREAD
            ========================================= */}
        <div className="flex-1 bg-stone-100 flex flex-col min-w-0 border-r border-stone-200">
          {selectedConversation ? (
            <>
              {/* Chat Top Header */}
              <div className="bg-white border-b border-stone-200 px-4 py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-stone-200 text-stone-800 flex items-center justify-center font-bold text-sm">
                    {selectedConversation.customerName
                      ? selectedConversation.customerName.charAt(0).toUpperCase()
                      : selectedConversation.customerPhone.slice(-2)}
                  </div>
                  <div>
                    <h2 className="text-xs font-bold text-stone-900 leading-tight flex items-center gap-2">
                      <span>{selectedConversation.customerName || selectedConversation.customerPhone}</span>
                      <span className="text-[11px] font-normal text-stone-500 font-mono">
                        {selectedConversation.customerPhone}
                      </span>
                    </h2>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-stone-500">
                      <span>Status:</span>
                      <select
                        value={selectedConversation.status}
                        onChange={(e) => handleStatusChange(e.target.value as ConversationStatus)}
                        className="font-semibold text-stone-800 bg-stone-50 hover:bg-stone-100 py-0.5 px-1.5 rounded border border-stone-200 cursor-pointer text-[11px]"
                      >
                        <option value="OPEN">Aberta</option>
                        <option value="IN_PROGRESS">Em Andamento</option>
                        <option value="WAITING_CUSTOMER">Aguardando Cliente</option>
                        <option value="RESOLVED">Resolvida</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Attendant Transfer */}
                  <div className="flex items-center gap-1 bg-stone-50 px-2 py-1 rounded-lg border border-stone-200 text-xs">
                    <UserCheck className="w-3.5 h-3.5 text-stone-500" />
                    <select
                      value={selectedConversation.assignedUserId || ''}
                      onChange={(e) => handleAssignAttendant(e.target.value)}
                      className="bg-transparent border-0 text-xs font-semibold text-stone-800 focus:outline-none cursor-pointer"
                    >
                      <option value="">Sem responsável</option>
                      {database.users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Toggle Sidebar */}
                  <button
                    onClick={() => setShowRightSidebar(!showRightSidebar)}
                    title={showRightSidebar ? 'Ocultar detalhes do cliente' : 'Ver detalhes do cliente'}
                    className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                      showRightSidebar
                        ? 'bg-orange-50 text-orange-600 border-orange-200'
                        : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    {showRightSidebar ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Chat Messages Stream */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="text-center py-16 text-stone-400 text-xs">
                    Nenhuma mensagem anterior registrada nesta conversa.
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isFromMe = msg.fromMe;
                    const isNote = msg.isInternalNote;

                    if (isNote) {
                      return (
                        <div key={msg.id} className="flex justify-center my-2">
                          <div className="max-w-md w-full bg-amber-50 border border-amber-300 rounded-xl p-3 shadow-xs">
                            <div className="flex items-center justify-between text-[11px] font-bold text-amber-800 border-b border-amber-200 pb-1 mb-1">
                              <span className="flex items-center gap-1">
                                <Lock className="w-3 h-3 text-amber-600" />
                                NOTA INTERNA — Visível apenas pela equipe
                              </span>
                              <span className="font-normal text-amber-700">
                                {msg.authorName || 'Equipe'}
                              </span>
                            </div>
                            <p className="text-xs text-amber-950 whitespace-pre-line leading-relaxed">
                              {msg.text}
                            </p>
                            <div className="text-[10px] text-amber-700/80 text-right mt-1">
                              {new Date(msg.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isFromMe ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-md rounded-2xl px-3.5 py-2 text-xs shadow-xs ${
                            isFromMe
                              ? 'bg-stone-900 text-white rounded-br-none'
                              : 'bg-white text-stone-900 border border-stone-200 rounded-bl-none'
                          }`}
                        >
                          {/* Sender name for outbound messages */}
                          {isFromMe && msg.authorName && (
                            <div className="text-[10px] text-stone-400 font-medium mb-0.5">
                              {msg.authorName}
                            </div>
                          )}

                          <p className="whitespace-pre-line leading-relaxed break-words">{msg.text}</p>

                          <div
                            className={`flex items-center justify-end gap-1 text-[9px] mt-1 ${
                              isFromMe ? 'text-stone-400' : 'text-stone-400'
                            }`}
                          >
                            <span>
                              {new Date(msg.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            {isFromMe && (
                              <span>
                                {msg.status === 'READ' ? (
                                  <CheckCheck className="w-3 h-3 text-sky-400" />
                                ) : msg.status === 'DELIVERED' ? (
                                  <CheckCheck className="w-3 h-3 text-stone-400" />
                                ) : msg.status === 'SENT' ? (
                                  <Check className="w-3 h-3 text-stone-400" />
                                ) : (
                                  <Clock className="w-3 h-3 text-stone-400" />
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Reply Auto-complete Suggestion Box */}
              {showQuickReplySuggest && (
                <div className="mx-4 mb-2 bg-white rounded-xl shadow-lg border border-stone-200 overflow-hidden max-h-48 overflow-y-auto">
                  <div className="px-3 py-1.5 bg-stone-50 border-b border-stone-200 text-[11px] font-bold text-stone-700 flex items-center justify-between">
                    <span>Atalhos de Respostas Rápidas</span>
                    <span className="text-[10px] text-stone-400">Clique para inserir</span>
                  </div>
                  {quickReplies
                    .filter((qr) => qr.shortcut.toLowerCase().includes(suggestFilter))
                    .map((qr) => (
                      <div
                        key={qr.id}
                        onClick={() => insertQuickReply(qr)}
                        className="px-3 py-2 hover:bg-orange-50 cursor-pointer text-xs flex items-center justify-between border-b border-stone-100 last:border-0"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded text-[11px]">
                            /{qr.shortcut}
                          </span>
                          <span className="font-semibold text-stone-800">{qr.title}</span>
                        </div>
                        <span className="text-[10px] text-stone-400 truncate max-w-xs">{qr.content}</span>
                      </div>
                    ))}
                </div>
              )}

              {/* Composer */}
              <div className="bg-white border-t border-stone-200 p-3">
                {/* Mode Selector Tabs: Mensagem vs Nota Interna */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setIsInternalNoteMode(false)}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                        !isInternalNoteMode
                          ? 'bg-stone-900 text-white'
                          : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                      }`}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Mensagem WhatsApp</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsInternalNoteMode(true)}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                        isInternalNoteMode
                          ? 'bg-amber-500 text-white'
                          : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                      }`}
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Nota Interna (Equipe)</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setIsQuickRepliesModalOpen(true)}
                      className="text-stone-500 hover:text-stone-800 p-1 rounded hover:bg-stone-100 text-xs flex items-center gap-1"
                      title="Abrir respostas rápidas"
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-500" />
                      <span className="text-[11px] font-medium hidden sm:inline">Atalhos</span>
                    </button>
                  </div>
                </div>

                {/* Inline Action Error Banner */}
                {actionError && (
                  <div className="mb-2 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{actionError}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActionError(null)}
                      className="text-rose-500 hover:text-rose-800 p-0.5 rounded cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Input Area */}
                <form onSubmit={handleSendMessage} className="flex items-end gap-2">
                  <div className="flex-1 relative">
                    <textarea
                      rows={2}
                      value={inputText}
                      onChange={handleInputChange}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder={
                        isInternalNoteMode
                          ? 'Escreva um recado sigiloso para a equipe (ex: cliente alérgico a frutos do mar, pedido atrasou no forno)...'
                          : 'Digite uma mensagem para o cliente (pressione Enter para enviar, Shift+Enter para quebra)...'
                      }
                      className={`w-full p-2.5 text-xs rounded-xl border focus:outline-none resize-none leading-relaxed ${
                        isInternalNoteMode
                          ? 'bg-amber-50/60 border-amber-300 focus:ring-1 focus:ring-amber-500 text-amber-950 placeholder-amber-700/50'
                          : 'bg-stone-50 border-stone-200 focus:ring-1 focus:ring-orange-500 text-stone-900'
                      }`}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={!inputText.trim() || sending}
                    className={`h-10 px-4 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50 ${
                      isInternalNoteMode
                        ? 'bg-amber-600 hover:bg-amber-700 text-white'
                        : 'bg-orange-600 hover:bg-orange-700 text-white'
                    }`}
                  >
                    <Send className="w-4 h-4" />
                    <span className="hidden sm:inline">
                      {isInternalNoteMode ? 'Salvar Nota' : 'Enviar'}
                    </span>
                  </button>
                </form>

                {session?.status !== 'CONNECTED' && !isInternalNoteMode && (
                  <p className="text-[11px] text-amber-700 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-amber-600" />
                    <span>
                      WhatsApp desconectado. As mensagens enviadas serão enfileiradas ou salvas localmente até a reconexão.
                    </span>
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white border border-stone-200 shadow-sm flex items-center justify-center text-stone-400 mb-3">
                <MessageSquare className="w-8 h-8 stroke-1 text-orange-500" />
              </div>
              <h3 className="text-sm font-bold text-stone-800">Selecione uma conversa</h3>
              <p className="text-xs text-stone-500 max-w-sm mt-1">
                Escolha um contato à esquerda para gerenciar o histórico de mensagens, adicionar notas internas e definir responsáveis.
              </p>
            </div>
          )}
        </div>

        {/* =========================================
            COLUMN 3: CLIENT DETAILS SIDEBAR
            ========================================= */}
        {selectedConversation && showRightSidebar && (
          <div className="w-72 md:w-80 bg-white flex flex-col flex-shrink-0 overflow-y-auto p-4 space-y-5">
            {/* Header / Profile */}
            <div className="text-center pb-4 border-b border-stone-100">
              <div className="w-14 h-14 rounded-full bg-stone-200 text-stone-700 font-bold text-xl flex items-center justify-center mx-auto mb-2">
                {selectedConversation.customerName
                  ? selectedConversation.customerName.charAt(0).toUpperCase()
                  : selectedConversation.customerPhone.slice(-2)}
              </div>
              <h3 className="text-sm font-bold text-stone-900">
                {selectedConversation.customerName || 'Cliente sem nome'}
              </h3>
              <p className="text-xs text-stone-500 font-mono mt-0.5">
                {selectedConversation.customerPhone}
              </p>
              <div className="mt-2 flex justify-center">
                {renderStatusBadge(selectedConversation.status)}
              </div>
            </div>

            {/* Atendente Responsável */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-stone-500" />
                Atendente Responsável
              </label>
              <select
                value={selectedConversation.assignedUserId || ''}
                onChange={(e) => handleAssignAttendant(e.target.value)}
                className="w-full py-1.5 px-2.5 text-xs font-medium text-stone-800 bg-stone-50 rounded-lg border border-stone-200 focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer"
              >
                <option value="">Não atribuído</option>
                {database.users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role === 'DONO' ? 'Dono' : 'Equipe'})
                  </option>
                ))}
              </select>
            </div>

            {/* Etiquetas / Tags */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
                  <TagIcon className="w-3.5 h-3.5 text-stone-500" />
                  Etiquetas
                </label>
                <button
                  onClick={() => setIsCreatingTag(!isCreatingTag)}
                  className="text-[10px] font-semibold text-orange-600 hover:text-orange-700 flex items-center gap-0.5 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  Nova etiqueta
                </button>
              </div>

              {/* Tag creation form */}
              {isCreatingTag && (
                <form onSubmit={handleCreateTag} className="p-2.5 bg-stone-50 rounded-lg border border-stone-200 space-y-2">
                  <input
                    type="text"
                    required
                    placeholder="Nome da etiqueta..."
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    className="w-full px-2 py-1 text-xs bg-white rounded border border-stone-300"
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      {['#f97316', '#ef4444', '#10b981', '#3b82f6', '#8b5cf6', '#64748b'].map((col) => (
                        <button
                          key={col}
                          type="button"
                          onClick={() => setNewTagColor(col)}
                          className={`w-4 h-4 rounded-full cursor-pointer transition-transform ${
                            newTagColor === col ? 'ring-2 ring-stone-900 scale-110' : ''
                          }`}
                          style={{ backgroundColor: col }}
                        />
                      ))}
                    </div>
                    <button
                      type="submit"
                      className="px-2 py-1 text-[11px] font-semibold text-white bg-stone-900 rounded cursor-pointer"
                    >
                      Criar
                    </button>
                  </div>
                </form>
              )}

              {/* Tag List toggle */}
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tg) => {
                  const isChecked = selectedConversation.tags?.includes(tg.id);
                  return (
                    <button
                      key={tg.id}
                      onClick={() => handleToggleTag(tg.id)}
                      className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer border flex items-center gap-1 ${
                        isChecked
                          ? 'text-white border-transparent shadow-xs'
                          : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                      }`}
                      style={{
                        backgroundColor: isChecked ? tg.color : undefined,
                      }}
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: isChecked ? '#fff' : tg.color }}
                      />
                      <span>{tg.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Histórico e Vendas do Restaurante */}
            <div className="space-y-2 pt-2 border-t border-stone-100">
              <label className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-stone-500" />
                Histórico com o Estabelecimento
              </label>

              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs space-y-1.5">
                <div className="flex justify-between text-stone-600">
                  <span>Primeiro contato:</span>
                  <span className="font-semibold text-stone-800">
                    {selectedConversation.firstContactAt
                      ? new Date(selectedConversation.firstContactAt).toLocaleDateString()
                      : 'Hoje'}
                  </span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>Total de mensagens:</span>
                  <span className="font-semibold text-stone-800">{messages.length}</span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>Pedidos do restaurante:</span>
                  <span className="font-semibold text-emerald-700">Integrado com Vendas</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="space-y-2 pt-2 border-t border-stone-100">
              <label className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                Ações Rápidas
              </label>

              {selectedConversation.status !== 'RESOLVED' ? (
                <button
                  onClick={() => handleStatusChange('RESOLVED')}
                  className="w-full py-2 px-3 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <CheckCheck className="w-4 h-4" />
                  <span>Marcar como Resolvida</span>
                </button>
              ) : (
                <button
                  onClick={() => handleStatusChange('OPEN')}
                  className="w-full py-2 px-3 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg border border-stone-200 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reabrir Conversa</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <WhatsAppConnectModal
        companyId={companyId}
        companyName={companyName}
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        sessionInfo={session || { companyId, status: 'DISCONNECTED' }}
        onSessionUpdated={(newInfo) => {
          setSession(newInfo);
          reloadData();
        }}
      />

      <QuickRepliesModal
        companyId={companyId}
        quickReplies={quickReplies}
        isOpen={isQuickRepliesModalOpen}
        onClose={() => setIsQuickRepliesModalOpen(false)}
        onReload={reloadData}
        onSelectReply={(text) => setInputText((prev) => (prev ? `${prev} ${text}` : text))}
      />

      <AtendimentoMetricsModal
        metrics={metrics}
        isOpen={isMetricsModalOpen}
        onClose={() => setIsMetricsModalOpen(false)}
      />

      {/* New Conversation Modal */}
      {isNewChatModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-stone-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-orange-600" />
                Iniciar Nova Conversa
              </h3>
              <button
                onClick={() => setIsNewChatModalOpen(false)}
                className="text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNewConversation} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Número de WhatsApp do Cliente (com DDD)
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 11999998888 ou 5511999998888"
                  value={newChatPhone}
                  onChange={(e) => setNewChatPhone(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-orange-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Nome do Cliente (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Mariana Silva"
                  value={newChatName}
                  onChange={(e) => setNewChatName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Primeira mensagem (opcional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Olá! Seu pedido já saiu para entrega..."
                  value={newChatInitialMsg}
                  onChange={(e) => setNewChatInitialMsg(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewChatModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors cursor-pointer shadow-xs"
                >
                  Abrir Conversa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
