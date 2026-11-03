/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise Atendimento — Tipos e Modelos do Módulo de Atendimento via WhatsApp
 * Suporte a multiempresa estrito, sessões independentes e notas internas.
 */

export type WhatsAppConnectionStatus =
  | 'DISCONNECTED'
  | 'STARTING'
  | 'AWAITING_SCAN'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'ERROR'
  | 'EXPIRED';

export interface WhatsAppSessionInfo {
  companyId: string;
  status: WhatsAppConnectionStatus;
  phoneNumber?: string;
  profileName?: string;
  profilePicUrl?: string;
  qrCodeDataUrl?: string;
  qrExpiresAt?: string;
  connectedAt?: string;
  lastDisconnectReason?: string;
  batteryLevel?: number;
  pairingCode?: string;
}

export type MessageType = 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'AUDIO' | 'INTERNAL_NOTE';
export type MessageDeliveryStatus = 'SENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';

export interface WhatsAppMessage {
  id: string;
  conversationId: string;
  companyId: string;
  fromMe: boolean;
  senderPhone: string;
  senderName?: string;
  text: string;
  type: MessageType;
  mediaUrl?: string;
  fileName?: string;
  mimeType?: string;
  timestamp: string; // ISO String
  status: MessageDeliveryStatus;
  isInternalNote?: boolean; // Nota restrita à equipe, nunca vai ao WhatsApp
  authorId?: string; // ID do atendente/dono
  authorName?: string;
}

export type ConversationStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_CUSTOMER' | 'RESOLVED';

export interface WhatsAppConversation {
  id: string; // id único: companyId_phone
  companyId: string;
  customerPhone: string;
  customerName: string;
  customerAvatarUrl?: string;
  unreadCount: number;
  lastMessageText: string;
  lastMessageTimestamp: string;
  lastMessageDirection: 'INBOUND' | 'OUTBOUND';
  status: ConversationStatus;
  assignedUserId?: string; // ID do atendente responsável
  assignedUserName?: string;
  tags: string[]; // Lista de IDs das etiquetas
  firstContactAt: string;
  updatedAt: string;
}

export interface AtendimentoTag {
  id: string;
  companyId: string;
  name: string;
  color: string; // Cor em hex ou classe
  description?: string;
}

export interface QuickReply {
  id: string;
  companyId: string;
  shortcut: string; // Ex: "cardapio", "ola", "entrega"
  title: string;
  category: string; // Ex: "Boas-vindas", "Cardápio", "Pedidos", "Outros"
  content: string;
  usageCount: number;
  createdAt: string;
}

export interface InternalNote {
  id: string;
  conversationId: string;
  companyId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

export interface AtendimentoMetrics {
  totalConversations: number;
  openConversations: number;
  inProgressConversations: number;
  resolvedConversations: number;
  unreadMessagesCount: number;
  averageFirstResponseTimeMinutes: number;
  conversationsByAttendant: {
    userId: string;
    userName: string;
    count: number;
  }[];
  conversationsByTag: {
    tagId: string;
    tagName: string;
    color: string;
    count: number;
  }[];
}
