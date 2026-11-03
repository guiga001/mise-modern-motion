// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — Navigation (desktop sidebar + mobile top bar & bottom bar)
 */

import React from 'react';
import { motion } from 'motion/react';
import {
  LayoutDashboard,
  UtensilsCrossed,
  Boxes,
  PackageSearch,
  ShoppingCart,
  UploadCloud,
  CircleDollarSign,
  Factory,
  Settings,
  ChevronsUpDown,
  LogOut,
  Globe,
  BrainCircuit,
  PanelLeftClose,
  PanelLeftOpen,
  Store,
} from 'lucide-react';
import { MiseDatabaseState } from '../lib/storage';

export type TabKey =
  | 'dashboard'
  | 'intelligence'
  | 'recipes'
  | 'ingredients'
  | 'inventory'
  | 'purchases'
  | 'sales'
  | 'financial'
  | 'production'
  | 'settings';

interface NavigationProps {
  activeTab: TabKey;
  onSelectTab: (tab: TabKey) => void;
  database: MiseDatabaseState;
  onSelectStore: (storeId: string) => void;
  onLogout: () => void;
  onViewLandingPage?: () => void;
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

const groups: { label: string; items: { key: TabKey; label: string; icon: any }[] }[] = [
  {
    label: 'Visão',
    items: [
      { key: 'dashboard', label: 'Painel', icon: LayoutDashboard },
      { key: 'intelligence', label: 'Inteligência', icon: BrainCircuit },
    ],
  },
  {
    label: 'Operação',
    items: [
      { key: 'sales', label: 'Vendas', icon: UploadCloud },
      { key: 'purchases', label: 'Compras', icon: ShoppingCart },
      { key: 'inventory', label: 'Estoque', icon: PackageSearch },
      { key: 'production', label: 'Produção', icon: Factory },
    ],
  },
  {
    label: 'Cardápio',
    items: [
      { key: 'recipes', label: 'Fichas & Cardápio', icon: UtensilsCrossed },
      { key: 'ingredients', label: 'Insumos', icon: Boxes },
    ],
  },
  {
    label: 'Finanças',
    items: [
      { key: 'financial', label: 'Caixa & Contas', icon: CircleDollarSign },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { key: 'settings', label: 'Ajustes', icon: Settings },
    ],
  },
];

const Logo = () => (
  <div className="mise-brand-mark relative flex h-9 w-9 items-center justify-center">
    <span className="font-display text-[22px] leading-none -mt-0.5">m</span>
  </div>
);

const StoreSelect: React.FC<{
  database: MiseDatabaseState;
  onSelectStore: (id: string) => void;
  compact?: boolean;
}> = ({
  database,
  onSelectStore,
  compact = false,
}) => (
  <div
    className={`relative flex items-center ${
      compact
        ? 'mx-auto h-10 w-10 justify-center rounded-xl bg-white/10 ring-1 ring-white/10 focus-within:ring-2 focus-within:ring-ember'
        : ''
    }`}
  >
    <select
      value={database.activeStoreId}
      onChange={(e) => onSelectStore(e.target.value)}
      aria-label={`Selecionar loja: ${
        database.stores.find((store) => store.id === database.activeStoreId)?.name || 'Todas as lojas'
      }`}
      title={`Loja atual: ${
        database.stores.find((store) => store.id === database.activeStoreId)?.name || 'Todas as lojas'
      }`}
      className={`cursor-pointer appearance-none border-0 ${
        compact
          ? 'absolute inset-0 z-10 h-full w-full opacity-0'
          : 'h-9 w-full rounded-lg bg-white/10 pl-3 pr-8 text-xs font-medium text-white ring-1 ring-white/10 hover:ring-white/25'
      }`}
    >
      <option value="CONSOLIDATED">Todas as lojas · Consolidado</option>
      {database.stores.map((st) => (
        <option key={st.id} value={st.id}>
          {st.name} {st.isMainStore ? '(Matriz)' : ''}
        </option>
      ))}
    </select>
    {compact ? (
      <Store className="pointer-events-none h-4 w-4 text-white/65" aria-hidden="true" />
    ) : (
      <ChevronsUpDown className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-stone-400" />
    )}
  </div>
);

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  database,
  onSelectStore,
  onLogout,
  onViewLandingPage,
  isSidebarCollapsed,
  onToggleSidebar,
}) => {
  const activeUser = database.users.find((u) => u.id === database.activeUserId);
  const initials = (activeUser?.name || 'D')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const mobileItems: { key: TabKey; label: string; icon: any }[] = [
    { key: 'dashboard', label: 'Painel', icon: LayoutDashboard },
    { key: 'intelligence', label: 'Inteligência', icon: BrainCircuit },
    { key: 'sales', label: 'Vendas', icon: UploadCloud },
    { key: 'inventory', label: 'Estoque', icon: PackageSearch },
    { key: 'financial', label: 'Caixa', icon: CircleDollarSign },
  ];

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        id="mise-desktop-sidebar"
        className={`hidden md:flex fixed inset-y-0 left-0 z-40 flex-col overflow-hidden border-r border-white/10 bg-stone-950 text-white shadow-xl shadow-stone-950/10 transition-[width] duration-300 ease-in-out ${
          isSidebarCollapsed ? 'w-[72px]' : 'w-60'
        }`}
      >
        <div
          className={`flex shrink-0 items-center ${
            isSidebarCollapsed
              ? 'h-auto min-h-16 flex-col justify-center gap-1 px-1 py-2'
              : 'h-16 gap-2.5 px-5'
          }`}
        >
          <Logo />
          <div className={`min-w-0 ${isSidebarCollapsed ? 'sr-only' : ''}`}>
            <div className="text-[13px] font-semibold text-white truncate leading-tight">
              {database.company?.name || 'Mise'}
            </div>
            <div className="text-[11px] text-white/45 leading-tight">GESTÃO DE RESTAURANTES</div>
          </div>
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label={isSidebarCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
            aria-expanded={!isSidebarCollapsed}
            aria-controls="mise-desktop-sidebar"
            title={isSidebarCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white/55 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember ${
              isSidebarCollapsed ? '' : 'ml-auto'
            }`}
          >
            {isSidebarCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" strokeWidth={1.75} />
            ) : (
              <PanelLeftClose className="h-4 w-4" strokeWidth={1.75} />
            )}
          </button>
        </div>

        <div className={`shrink-0 pb-3 ${isSidebarCollapsed ? 'px-1' : 'px-3'}`}>
          <StoreSelect database={database} onSelectStore={onSelectStore} compact={isSidebarCollapsed} />
        </div>

        <nav
          aria-label="Navegação principal"
          className={`flex-1 space-y-5 overflow-y-auto pb-4 ${isSidebarCollapsed ? 'px-2' : 'px-3'}`}
        >
          {groups.map((g) => (
            <div key={g.label}>
              <div className={`px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/38 ${isSidebarCollapsed ? 'sr-only' : ''}`}>
                {g.label}
              </div>
              <div className="space-y-0.5">
                {g.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={() => onSelectTab(item.key)}
                      aria-label={item.label}
                      aria-current={isActive ? 'page' : undefined}
                      title={isSidebarCollapsed ? item.label : undefined}
                      className={`relative flex h-8 w-full cursor-pointer items-center rounded-lg text-[13px] ${
                        isSidebarCollapsed ? 'justify-center px-0' : 'gap-2.5 px-2.5'
                      } ${
                        isActive ? 'text-stone-950 font-semibold' : 'text-white/62 hover:text-white hover:bg-white/8'
                      }`}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="nav-active"
                          className="absolute inset-0 rounded-xl bg-ember shadow-sm"
                          transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                        />
                      )}
                      <Icon className={`relative w-4 h-4 ${isActive ? 'text-stone-950' : 'text-white/45'}`} strokeWidth={1.75} />
                      {!isSidebarCollapsed && <span className="relative">{item.label}</span>}
                      {isActive && !isSidebarCollapsed && <span className="relative ml-auto w-1.5 h-1.5 rounded-full bg-ember" />}
                      {isActive && isSidebarCollapsed && <span className="absolute right-1.5 h-1.5 w-1.5 rounded-full bg-ember" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div
          className={`space-y-1 border-t border-white/10 ${
            isSidebarCollapsed ? 'flex flex-col items-center gap-1 p-2' : 'p-3'
          }`}
        >
          {onViewLandingPage && (
            <button
              onClick={onViewLandingPage}
              aria-label="Apresentação"
              title={isSidebarCollapsed ? 'Apresentação' : undefined}
              className={`flex h-8 w-full cursor-pointer items-center rounded-xl text-[13px] text-white/60 hover:bg-white/8 hover:text-white ${
                isSidebarCollapsed ? 'justify-center px-0' : 'gap-2.5 px-2.5'
              }`}
            >
              <Globe className="w-4 h-4 text-stone-400" strokeWidth={1.75} />
              {!isSidebarCollapsed && 'Apresentação'}
            </button>
          )}
          <div
            className={`flex ${
              isSidebarCollapsed ? 'flex-col items-center gap-2 pt-2' : 'items-center gap-2.5 px-2 pt-2'
            }`}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-[11px] font-medium text-white ring-1 ring-white/10">
              {initials}
            </div>
            <div className={`min-w-0 flex-1 ${isSidebarCollapsed ? 'sr-only' : ''}`}>
              <div className="text-[13px] font-medium text-white truncate">{activeUser?.name || 'Dono'}</div>
              <div className="text-[11px] text-white/45">Dono</div>
            </div>
            <button
              onClick={onLogout}
              aria-label="Desconectar"
              title="Desconectar"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl text-white/45 hover:bg-rose-500/15 hover:text-rose-300"
            >
              <LogOut className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-40 bg-stone-50/95 backdrop-blur-xl border-b border-stone-200/70">
        <div className="flex items-center gap-3 px-4 h-14">
          <Logo />
          <span className="text-sm font-semibold text-stone-950 truncate flex-1">
            {database.company?.name || 'Mise'}
          </span>
          <div className="w-36">
            <StoreSelect database={database} onSelectStore={onSelectStore} />
          </div>
          <button
            onClick={onLogout}
            title="Desconectar"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-stone-500 hover:text-rose-600 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-1 overflow-x-auto px-3 pb-2 no-scrollbar">
          {groups.flatMap((g) => g.items).map((item) => (
            <button
              key={item.key}
              onClick={() => onSelectTab(item.key)}
              className={`shrink-0 h-8 px-3.5 rounded-full text-xs font-medium cursor-pointer ${
                activeTab === item.key ? 'bg-stone-950 text-ember' : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      {/* Mobile bottom bar */}
      <nav className="md:hidden fixed bottom-3 left-3 right-3 z-40 rounded-2xl bg-stone-950/96 backdrop-blur-xl shadow-2xl ring-1 ring-white/10">
        <div className="flex items-center justify-around h-16 px-1">
          {mobileItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => onSelectTab(item.key)}
                className={`relative flex flex-col items-center justify-center flex-1 min-h-[44px] cursor-pointer ${
                  isActive ? 'text-ember' : 'text-white/50'
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="mnav-active"
                    className="absolute inset-x-2 inset-y-1 rounded-xl bg-white/10"
                    transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                  />
                )}
                <Icon className="relative w-5 h-5 mb-0.5" strokeWidth={isActive ? 2 : 1.6} />
                <span className="relative text-[10px]">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
