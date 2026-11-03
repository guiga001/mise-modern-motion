/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — Tipos de Domínio para Integrações de Delivery (iFood e 99Food)
 * Invariante: Valores monetários SEMPRE em centavos inteiros (BRL cents).
 */

export type DeliveryChannel = 'IFOOD' | '99FOOD';

export type DeliveryOrderStatus =
  | 'PENDING'          // Novo pedido, aguardando confirmação do restaurante
  | 'CONFIRMED'        // Confirmado pelo restaurante
  | 'PREPARING'        // Em preparo na cozinha
  | 'READY_FOR_PICKUP' // Pronto para retirada (motoboy / cliente)
  | 'DISPATCHED'       // Saiu para entrega (em rota)
  | 'DELIVERED'        // Entregue / Concluído com sucesso
  | 'CANCELLED';       // Cancelado

export type DeliveryLogisticsType = 'OWN_DELIVERY' | 'MARKETPLACE_DELIVERY';

export interface DeliveryCustomerAddress {
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  postalCode?: string;
  reference?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

export interface DeliveryCustomer {
  id?: string;
  name: string;
  phone?: string;
  document?: string;
  deliveryAddress: DeliveryCustomerAddress;
}

export interface DeliveryOrderItemOption {
  name: string;
  quantity: number;
  unitPriceInCents: number;
  groupName?: string;
}

export interface DeliveryOrderItem {
  id: string;
  externalCode?: string;
  name: string;
  quantity: number;
  unitPriceInCents: number;
  totalPriceInCents: number;
  notes?: string;
  options?: DeliveryOrderItemOption[];
}

export interface DeliveryFinancialSummary {
  subtotalInCents: number;
  deliveryFeeInCents: number;
  discountInCents: number;
  additionalFeesInCents: number;
  totalCustomerInCents: number;      // Valor final pago pelo cliente
  marketplaceCommissionInCents: number; // Taxa cobrada pelo iFood/99Food
  netRestaurantPayoutInCents: number;   // Líquido a receber pelo restaurante
  paymentMethod: 'ONLINE_CREDIT' | 'ONLINE_DEBIT' | 'PIX' | 'CASH' | 'CARD_MACHINE' | 'MEAL_VOUCHER';
  paymentBrand?: string;            // ex: 'Mastercard', 'Visa', 'Elo', 'Alelo'
  paidOnline: boolean;
}

export interface DeliveryOrder {
  id: string;
  displayId: string;                // Código curto visível, ex: "#IFO-4821" ou "#99F-1092"
  externalOrderId: string;          // UUID do iFood ou ID do 99Food
  companyId: string;
  storeId?: string;
  channel: DeliveryChannel;
  status: DeliveryOrderStatus;
  logisticsType: DeliveryLogisticsType;
  customer: DeliveryCustomer;
  items: DeliveryOrderItem[];
  financial: DeliveryFinancialSummary;
  notes?: string;                   // Observações gerais do pedido
  estimatedPreparationMinutes: number;
  driver?: {
    name?: string;
    phone?: string;
    type?: string;                  // 'Parceiro iFood', 'Motoboy Próprio', etc.
  };
  createdAt: string;
  confirmedAt?: string;
  readyAt?: string;
  dispatchedAt?: string;
  deliveredAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  printedAt?: string;
  syncedToInventory?: boolean;
}

export interface DeliveryChannelConfig {
  channel: DeliveryChannel;
  enabled: boolean;
  storeOpen: boolean;
  storeName: string;
  merchantId: string;               // Merchant UUID iFood / Shop ID 99Food
  clientId?: string;                // iFood Client ID
  clientSecret?: string;            // iFood Client Secret
  appId?: string;                   // 99Food App ID
  appSecret?: string;               // 99Food App Secret
  defaultCommissionRate: number;    // em porcentagem, ex: 12 ou 27
  autoAcceptOrders: boolean;
  defaultPrepMinutes: number;
  autoPrintReceipt: boolean;
  connectionStatus: 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'TESTING';
  lastStatusCheck?: string;
  lastErrorMessage?: string;
  webhookUrl: string;
  webhookSecret?: string;
  lastSyncAt?: string;
  environment: 'PRODUCTION' | 'SANDBOX';
  authType?: 'OAUTH2' | 'API_KEY';
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: string;
  authorizedAt?: string;
  authorizedBy?: string;
}

export interface DeliveryMetricsSummary {
  period: string;                   // 'today' | '7d' | '30d' | 'month' | 'all'
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  cancellationRate: number;         // em porcentagem, ex: 2.5
  totalGrossInCents: number;
  totalNetInCents: number;
  totalCommissionInCents: number;
  averageTicketInCents: number;
  byChannel: {
    ifood: {
      ordersCount: number;
      grossInCents: number;
      netInCents: number;
      commissionInCents: number;
      averageTicketInCents: number;
    };
    food99: {
      ordersCount: number;
      grossInCents: number;
      netInCents: number;
      commissionInCents: number;
      averageTicketInCents: number;
    };
  };
  byStatusCount: Record<DeliveryOrderStatus, number>;
}

export interface DeliveryFilterOptions {
  channel?: DeliveryChannel | 'ALL';
  status?: DeliveryOrderStatus | 'ALL' | 'ACTIVE';
  period?: 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'THIS_MONTH' | 'ALL';
  logisticsType?: DeliveryLogisticsType | 'ALL';
  searchTerm?: string;
}
