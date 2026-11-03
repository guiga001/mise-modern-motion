/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise Atendimento — Cliente de API com Isolamento por Restaurante
 * Comunicação REST e Server-Sent Events (SSE) para tempo real.
 */

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

export class AtendimentoApiClient {
  private getHeaders(companyId: string): HeadersInit {
    return {
      'Content-Type': 'application/json',
      'x-company-id': companyId,
    };
  }

  // 1. Sessão WhatsApp
  async getSession(companyId: string): Promise<WhatsAppSessionInfo> {
    const res = await fetch(`/api/atendimento/session?companyId=${encodeURIComponent(companyId)}`, {
      headers: this.getHeaders(companyId),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async connectWhatsApp(companyId: string, forceNew = false): Promise<WhatsAppSessionInfo> {
    const res = await fetch('/api/atendimento/session/connect', {
      method: 'POST',
      headers: this.getHeaders(companyId),
      body: JSON.stringify({ companyId, forceNew }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async requestPairingCode(companyId: string, phoneNumber: string): Promise<{ code: string; sessionInfo: WhatsAppSessionInfo }> {
    const res = await fetch('/api/atendimento/session/pairing-code', {
      method: 'POST',
      headers: this.getHeaders(companyId),
      body: JSON.stringify({ companyId, phoneNumber }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async disconnectWhatsApp(companyId: string): Promise<WhatsAppSessionInfo> {
    const res = await fetch('/api/atendimento/session/disconnect', {
      method: 'POST',
      headers: this.getHeaders(companyId),
      body: JSON.stringify({ companyId }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  // 2. Stream SSE em Tempo Real
  subscribeEvents(
    companyId: string,
    onEvent: (event: { type: string; companyId: string; data: any }) => void
  ): () => void {
    const url = `/api/atendimento/events?companyId=${encodeURIComponent(companyId)}`;
    const eventSource = new EventSource(url);

    eventSource.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data);
        onEvent(parsed);
      } catch (err) {
        console.error('Erro ao processar evento SSE:', err);
      }
    };

    eventSource.onerror = (err) => {
      // EventSource reconecta automaticamente
      console.warn('[SSE Atendimento] Conexão temporariamente interrompida, tentando reconectar...', err);
    };

    return () => {
      eventSource.close();
    };
  }

  // 3. Conversas
  async getConversations(
    companyId: string,
    filter?: {
      status?: ConversationStatus | 'ALL';
      assignedUserId?: string;
      tagId?: string;
      search?: string;
    }
  ): Promise<WhatsAppConversation[]> {
    const params = new URLSearchParams();
    params.set('companyId', companyId);
    if (filter?.status) params.set('status', filter.status);
    if (filter?.assignedUserId) params.set('assignedUserId', filter.assignedUserId);
    if (filter?.tagId) params.set('tagId', filter.tagId);
    if (filter?.search) params.set('search', filter.search);

    const res = await fetch(`/api/atendimento/conversations?${params.toString()}`, {
      headers: this.getHeaders(companyId),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async createConversation(
    companyId: string,
    params: {
      customerPhone: string;
      customerName?: string;
      initialMessage?: string;
      authorName?: string;
      authorId?: string;
    }
  ): Promise<WhatsAppConversation> {
    const res = await fetch('/api/atendimento/conversations', {
      method: 'POST',
      headers: this.getHeaders(companyId),
      body: JSON.stringify({ ...params, companyId }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  // 4. Mensagens
  async getMessages(companyId: string, conversationId: string): Promise<WhatsAppMessage[]> {
    const res = await fetch(
      `/api/atendimento/conversations/${encodeURIComponent(conversationId)}/messages?companyId=${encodeURIComponent(companyId)}`,
      { headers: this.getHeaders(companyId) }
    );
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async sendMessage(
    companyId: string,
    conversationId: string,
    text: string,
    authorName?: string,
    authorId?: string
  ): Promise<WhatsAppMessage> {
    const res = await fetch(`/api/atendimento/conversations/${encodeURIComponent(conversationId)}/messages`, {
      method: 'POST',
      headers: this.getHeaders(companyId),
      body: JSON.stringify({ companyId, text, authorName, authorId }),
    });
    if (!res.ok) {
      const errText = await res.text();
      try {
        const parsed = JSON.parse(errText);
        throw new Error(parsed.error || errText);
      } catch {
        throw new Error(errText);
      }
    }
    return res.json();
  }

  async markAsRead(companyId: string, conversationId: string): Promise<void> {
    await fetch(`/api/atendimento/conversations/${encodeURIComponent(conversationId)}/read`, {
      method: 'POST',
      headers: this.getHeaders(companyId),
      body: JSON.stringify({ companyId }),
    });
  }

  async assignAttendant(
    companyId: string,
    conversationId: string,
    userId?: string,
    userName?: string
  ): Promise<WhatsAppConversation> {
    const res = await fetch(`/api/atendimento/conversations/${encodeURIComponent(conversationId)}/assign`, {
      method: 'POST',
      headers: this.getHeaders(companyId),
      body: JSON.stringify({ companyId, userId, userName }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async updateStatus(
    companyId: string,
    conversationId: string,
    status: ConversationStatus
  ): Promise<WhatsAppConversation> {
    const res = await fetch(`/api/atendimento/conversations/${encodeURIComponent(conversationId)}/status`, {
      method: 'POST',
      headers: this.getHeaders(companyId),
      body: JSON.stringify({ companyId, status }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async updateTags(
    companyId: string,
    conversationId: string,
    tags: string[]
  ): Promise<WhatsAppConversation> {
    const res = await fetch(`/api/atendimento/conversations/${encodeURIComponent(conversationId)}/tags`, {
      method: 'POST',
      headers: this.getHeaders(companyId),
      body: JSON.stringify({ companyId, tags }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  // 5. Notas Internas
  async getNotes(companyId: string, conversationId: string): Promise<InternalNote[]> {
    const res = await fetch(
      `/api/atendimento/conversations/${encodeURIComponent(conversationId)}/notes?companyId=${encodeURIComponent(companyId)}`,
      { headers: this.getHeaders(companyId) }
    );
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async addNote(
    companyId: string,
    conversationId: string,
    content: string,
    authorName: string,
    authorId: string
  ): Promise<InternalNote> {
    const res = await fetch(`/api/atendimento/conversations/${encodeURIComponent(conversationId)}/notes`, {
      method: 'POST',
      headers: this.getHeaders(companyId),
      body: JSON.stringify({ companyId, content, authorName, authorId }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  // 6. Etiquetas
  async getTags(companyId: string): Promise<AtendimentoTag[]> {
    const res = await fetch(`/api/atendimento/tags?companyId=${encodeURIComponent(companyId)}`, {
      headers: this.getHeaders(companyId),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async saveTag(companyId: string, tag: Partial<AtendimentoTag>): Promise<AtendimentoTag> {
    const res = await fetch('/api/atendimento/tags', {
      method: 'POST',
      headers: this.getHeaders(companyId),
      body: JSON.stringify({ ...tag, companyId }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async deleteTag(companyId: string, tagId: string): Promise<void> {
    const res = await fetch(`/api/atendimento/tags/${encodeURIComponent(tagId)}?companyId=${encodeURIComponent(companyId)}`, {
      method: 'DELETE',
      headers: this.getHeaders(companyId),
    });
    if (!res.ok) throw new Error(await res.text());
  }

  // 7. Respostas Rápidas
  async getQuickReplies(companyId: string): Promise<QuickReply[]> {
    const res = await fetch(`/api/atendimento/quick-replies?companyId=${encodeURIComponent(companyId)}`, {
      headers: this.getHeaders(companyId),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async saveQuickReply(companyId: string, qr: Partial<QuickReply>): Promise<QuickReply> {
    const res = await fetch('/api/atendimento/quick-replies', {
      method: 'POST',
      headers: this.getHeaders(companyId),
      body: JSON.stringify({ ...qr, companyId }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async deleteQuickReply(companyId: string, id: string): Promise<void> {
    const res = await fetch(`/api/atendimento/quick-replies/${encodeURIComponent(id)}?companyId=${encodeURIComponent(companyId)}`, {
      method: 'DELETE',
      headers: this.getHeaders(companyId),
    });
    if (!res.ok) throw new Error(await res.text());
  }

  async recordQuickReplyUsage(companyId: string, id: string): Promise<void> {
    await fetch(`/api/atendimento/quick-replies/${encodeURIComponent(id)}/use`, {
      method: 'POST',
      headers: this.getHeaders(companyId),
      body: JSON.stringify({ companyId }),
    });
  }

  // 8. Métricas
  async getMetrics(companyId: string): Promise<AtendimentoMetrics> {
    const res = await fetch(`/api/atendimento/metrics?companyId=${encodeURIComponent(companyId)}`, {
      headers: this.getHeaders(companyId),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }
}

export const atendimentoApi = new AtendimentoApiClient();
