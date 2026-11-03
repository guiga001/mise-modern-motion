/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — Cliente de API Frontend para Integrações de Delivery (iFood e 99Food)
 */

import {
  DeliveryChannel,
  DeliveryChannelConfig,
  DeliveryFilterOptions,
  DeliveryMetricsSummary,
  DeliveryOrder,
  DeliveryOrderStatus,
} from '../domain/delivery-types';

class DeliveryApiClient {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    try {
      const res = await fetch(endpoint, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = data.error || data.message || `Erro na requisição ${endpoint}: status ${res.status}`;
        throw new Error(message);
      }
      return data as T;
    } catch (err: any) {
      if (err.name === 'TypeError' && err.message?.includes('fetch')) {
        throw new Error('Falha de conexão com o servidor local. Verifique sua conexão.');
      }
      throw err;
    }
  }

  public async getConfigs(
    companyId: string
  ): Promise<{ ifood: DeliveryChannelConfig; food99: DeliveryChannelConfig }> {
    const data = await this.request<{
      success: boolean;
      configs: { ifood: DeliveryChannelConfig; food99: DeliveryChannelConfig };
    }>(`/api/integrations/configs?companyId=${encodeURIComponent(companyId)}`);
    return data.configs;
  }

  public async updateConfig(
    companyId: string,
    channel: DeliveryChannel,
    patch: Partial<DeliveryChannelConfig>
  ): Promise<DeliveryChannelConfig> {
    const data = await this.request<{ success: boolean; config: DeliveryChannelConfig }>(
      '/api/integrations/configs',
      {
        method: 'POST',
        body: JSON.stringify({ companyId, channel, ...patch }),
      }
    );
    return data.config;
  }

  public async toggleStore(
    companyId: string,
    channel: DeliveryChannel,
    storeOpen: boolean
  ): Promise<{ storeOpen: boolean; message: string }> {
    const data = await this.request<{ success: boolean; storeOpen: boolean; message: string }>(
      '/api/integrations/toggle-store',
      {
        method: 'POST',
        body: JSON.stringify({ companyId, channel, storeOpen }),
      }
    );
    return { storeOpen: data.storeOpen, message: data.message };
  }

  public async testConnection(
    companyId: string,
    channel: DeliveryChannel,
    credentials: any
  ): Promise<{ success: boolean; status: string; message: string }> {
    return this.request<{ success: boolean; status: string; message: string }>(
      '/api/integrations/test-connection',
      {
        method: 'POST',
        body: JSON.stringify({ companyId, channel, credentials }),
      }
    );
  }

  public async getOrders(companyId: string, filters: DeliveryFilterOptions = {}): Promise<DeliveryOrder[]> {
    const params = new URLSearchParams();
    params.set('companyId', companyId);
    if (filters.channel && filters.channel !== 'ALL') params.set('channel', filters.channel);
    if (filters.status && filters.status !== 'ALL') params.set('status', filters.status);
    if (filters.period && filters.period !== 'ALL') params.set('period', filters.period);
    if (filters.logisticsType && filters.logisticsType !== 'ALL')
      params.set('logisticsType', filters.logisticsType);
    if (filters.searchTerm) params.set('search', filters.searchTerm);

    const data = await this.request<{ success: boolean; orders: DeliveryOrder[] }>(
      `/api/integrations/orders?${params.toString()}`
    );
    return data.orders || [];
  }

  public async getOrderById(companyId: string, orderId: string): Promise<DeliveryOrder> {
    const data = await this.request<{ success: boolean; order: DeliveryOrder }>(
      `/api/integrations/orders/${encodeURIComponent(orderId)}?companyId=${encodeURIComponent(companyId)}`
    );
    return data.order;
  }

  public async updateOrderStatus(
    companyId: string,
    orderId: string,
    status: DeliveryOrderStatus,
    extra?: { reason?: string; driverName?: string; prepMinutes?: number }
  ): Promise<DeliveryOrder> {
    const data = await this.request<{ success: boolean; order: DeliveryOrder }>(
      `/api/integrations/orders/${encodeURIComponent(orderId)}/status`,
      {
        method: 'POST',
        body: JSON.stringify({ companyId, status, ...extra }),
      }
    );
    return data.order;
  }

  public async syncOrders(
    companyId: string,
    channel?: DeliveryChannel
  ): Promise<{ message: string; syncedCount: number; newOrders: DeliveryOrder[] }> {
    const data = await this.request<{
      success: boolean;
      message: string;
      result: { syncedCount: number; newOrders: DeliveryOrder[] };
    }>('/api/integrations/sync', {
      method: 'POST',
      body: JSON.stringify({ companyId, channel }),
    });
    return {
      message: data.message,
      syncedCount: data.result?.syncedCount || 0,
      newOrders: data.result?.newOrders || [],
    };
  }

  public async clearOrders(companyId: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>('/api/integrations/clear-orders', {
      method: 'POST',
      body: JSON.stringify({ companyId }),
    });
  }

  public async getOAuthUrl(
    companyId: string,
    channel: DeliveryChannel
  ): Promise<{ success: boolean; url: string; redirectUri: string; providerName: string }> {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const redirectParam = origin ? `&redirect_uri=${encodeURIComponent(origin + '/auth/callback')}&origin=${encodeURIComponent(origin)}` : '';
    const safeChannel = channel === '99FOOD' ? '99FOOD' : 'IFOOD';
    return this.request<{ success: boolean; url: string; redirectUri: string; providerName: string }>(
      `/api/integrations/oauth/url?companyId=${encodeURIComponent(companyId)}&channel=${encodeURIComponent(safeChannel)}${redirectParam}`
    );
  }

  public async authorizeDirect(
    companyId: string,
    channel: DeliveryChannel,
    storeName?: string,
    merchantId?: string
  ): Promise<{ success: boolean; message: string; config: DeliveryChannelConfig }> {
    const safeChannel = channel === '99FOOD' ? '99FOOD' : 'IFOOD';
    return this.request<{ success: boolean; message: string; config: DeliveryChannelConfig }>(
      '/api/integrations/oauth/authorize-direct',
      {
        method: 'POST',
        body: JSON.stringify({ companyId, channel: safeChannel, storeName, merchantId }),
      }
    );
  }

  public async disconnectOAuth(
    companyId: string,
    channel: DeliveryChannel
  ): Promise<{ success: boolean; message: string; config: DeliveryChannelConfig }> {
    return this.request<{ success: boolean; message: string; config: DeliveryChannelConfig }>(
      '/api/integrations/oauth/disconnect',
      {
        method: 'POST',
        body: JSON.stringify({ companyId, channel }),
      }
    );
  }

  public async simulateTestOrder(
    companyId: string,
    channel: DeliveryChannel
  ): Promise<{ success: boolean; message: string; order: DeliveryOrder }> {
    return this.request<{ success: boolean; message: string; order: DeliveryOrder }>(
      '/api/integrations/simulate-test-order',
      {
        method: 'POST',
        body: JSON.stringify({ companyId, channel }),
      }
    );
  }

  public async getMetrics(companyId: string, period: string = 'today'): Promise<DeliveryMetricsSummary> {
    const data = await this.request<{ success: boolean; metrics: DeliveryMetricsSummary }>(
      `/api/integrations/metrics?companyId=${encodeURIComponent(companyId)}&period=${encodeURIComponent(
        period
      )}`
    );
    return data.metrics;
  }
}

export const deliveryApi = new DeliveryApiClient();
