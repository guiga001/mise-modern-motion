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
  Layers,
  BrainCircuit,
} from 'lucide-react';
import { MiseDatabaseState } from '../lib/storage';

export type TabKey =
  | 'dashboard'
  | 'intelligence'
  | 'integracoes'
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
}

const groups: { label: string; items: { key: TabKey; label: string; icon: any }[] }[] = [
  {
    label: 'Visão',
    items: [
      { key: 'dashboard', label: 'Painel', icon: LayoutDashboard },
      { key: 'intelligence', label: 'Inteligência', icon: BrainCircuit },
      { key: 'integracoes', label: 'Integrações', icon: Layers },
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
      { key: 'settings', label: 'Ajustes', icon: Settings },
    ],
  },
];

const Logo = () => (
  <div className="relative w-7 h-7 rounded-lg bg-stone-950 flex items-center justify-center overflow-hidden">
    <span className="font-display italic text-white text-[17px] leading-none -mt-0.5">m</span>
    <span className="absolute bottom-1 right-1 w-1 h-1 rounded-full bg-ember" />
  </div>
);

const StoreSelect: React.FC<{ database: MiseDatabaseState; onSelectStore: (id: string) => void }> = ({
  database,
  onSelectStore,
}) => (
  <div className="relative flex items-center">
    <select
      value={database.activeStoreId}
      onChange={(e) => onSelectStore(e.target.value)}
      className="w-full pl-3 pr-8 h-9 text-xs font-medium text-stone-800 bg-white ring-1 ring-stone-200 hover:ring-stone-300 rounded-lg border-0 appearance-none cursor-pointer"
    >
      <option value="CONSOLIDATED">Todas as lojas · Consolidado</option>
      {database.stores.map((st) => (
        <option key={st.id} value={st.id}>
          {st.name} {st.isMainStore ? '(Matriz)' : ''}
        </option>
      ))}
    </select>
    <ChevronsUpDown className="w-3.5 h-3.5 text-stone-400 absolute right-2.5 pointer-events-none" />
  </div>
);

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  database,
  onSelectStore,
  onLogout,
  onViewLandingPage,
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
      <aside className="hidden md:flex fixed inset-y-0 left-0 z-40 w-60 flex-col bg-stone-50/80 backdrop-blur-xl border-r border-stone-200/70">
        <div className="flex items-center gap-2.5 px-5 h-16">
          <Logo />
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-stone-950 truncate leading-tight">
              {database.company?.name || 'Mise'}
            </div>
            <div className="text-[11px] text-stone-500 leading-tight">Gestão alimentícia</div>
          </div>
        </div>

        <div className="px-3 pb-3">
          <StoreSelect database={database} onSelectStore={onSelectStore} />
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-5">
          {groups.map((g) => (
            <div key={g.label}>
              <div className="px-2.5 pb-1.5 text-[10.5px] font-medium uppercase tracking-[0.08em] text-stone-400">
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
                      className={`relative w-full flex items-center gap-2.5 h-8 px-2.5 rounded-lg text-[13px] cursor-pointer ${
                        isActive ? 'text-stone-950 font-medium' : 'text-stone-600 hover:text-stone-950 hover:bg-stone-200/40'
                      }`}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="nav-active"
                          className="absolute inset-0 rounded-lg bg-white shadow-sm ring-1 ring-stone-200/80"
                          transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                        />
                      )}
                      <Icon className={`relative w-4 h-4 ${isActive ? 'text-stone-950' : 'text-stone-400'}`} strokeWidth={1.75} />
                      <span className="relative">{item.label}</span>
                      {isActive && <span className="relative ml-auto w-1.5 h-1.5 rounded-full bg-ember" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-stone-200/70 p-3 space-y-1">
          {onViewLandingPage && (
            <button
              onClick={onViewLandingPage}
              className="w-full flex items-center gap-2.5 h-8 px-2.5 rounded-lg text-[13px] text-stone-600 hover:text-stone-950 hover:bg-stone-200/40 cursor-pointer"
            >
              <Globe className="w-4 h-4 text-stone-400" strokeWidth={1.75} />
              Apresentação
            </button>
          )}
          <div className="flex items-center gap-2.5 px-2 pt-2">
            <div className="w-8 h-8 rounded-full bg-stone-900 text-white text-[11px] font-medium flex items-center justify-center">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium text-stone-900 truncate">{activeUser?.name || 'Dono'}</div>
              <div className="text-[11px] text-stone-500">Dono</div>
            </div>
            <button
              onClick={onLogout}
              title="Desconectar"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
            >
              <LogOut className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-stone-200/70">
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
              className={`shrink-0 h-7 px-3 rounded-full text-xs cursor-pointer ${
                activeTab === item.key ? 'bg-stone-950 text-white' : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      {/* Mobile bottom bar */}
      <nav className="md:hidden fixed bottom-3 left-3 right-3 z-40 rounded-2xl bg-stone-950/95 backdrop-blur-xl shadow-2xl">
        <div className="flex items-center justify-around h-16 px-1">
          {mobileItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => onSelectTab(item.key)}
                className={`relative flex flex-col items-center justify-center flex-1 min-h-[44px] cursor-pointer ${
                  isActive ? 'text-white' : 'text-stone-400'
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
