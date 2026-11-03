/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — Navigation Component (Mobile Bottom Bar + Desktop Top Header)
 * Zero-pill discipline: metadados limpos, separadores tipográficos discretos.
 */

import React from 'react';
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
  Store,
  ChevronDown,
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

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  database,
  onSelectStore,
  onLogout,
  onViewLandingPage,
}) => {
  const activeUser = database.users.find(u => u.id === database.activeUserId);
  const activeStore = database.stores.find(s => s.id === database.activeStoreId);

  const navItems = [
    { key: 'dashboard' as TabKey, label: 'Painel', icon: LayoutDashboard },
    { key: 'intelligence' as TabKey, label: 'Inteligência', icon: BrainCircuit },
    { key: 'integracoes' as TabKey, label: 'Integrações', icon: Layers },
    { key: 'sales' as TabKey, label: 'Vendas', icon: UploadCloud },
    { key: 'purchases' as TabKey, label: 'Compras', icon: ShoppingCart },
    { key: 'inventory' as TabKey, label: 'Estoque', icon: PackageSearch },
    { key: 'recipes' as TabKey, label: 'Fichas & Cardápio', icon: UtensilsCrossed },
    { key: 'ingredients' as TabKey, label: 'Insumos', icon: Boxes },
    { key: 'financial' as TabKey, label: 'Caixa & Contas', icon: CircleDollarSign },
    { key: 'production' as TabKey, label: 'Produção', icon: Factory },
    { key: 'settings' as TabKey, label: 'Ajustes', icon: Settings },
  ];

  return (
    <>
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Brand and Company */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-stone-900 text-amber-400 flex items-center justify-center font-bold text-sm">
                M
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold tracking-tight text-stone-900 leading-none">
                  {database.company?.name || 'Mise'}
                </span>
                <span className="text-[11px] text-stone-500 flex items-center gap-1 mt-0.5">
                  <span>Gestão Alimentícia</span>
                  <span aria-hidden="true">·</span>
                  <span>{activeUser?.name ? `${activeUser.name} (Dono)` : 'Dono'}</span>
                </span>
              </div>
            </div>

            {/* Store Switcher & Logout */}
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="relative flex items-center">
                <Store className="w-4 h-4 text-stone-400 absolute left-2.5 pointer-events-none" />
                <select
                  value={database.activeStoreId}
                  onChange={(e) => onSelectStore(e.target.value)}
                  className="pl-8 pr-7 py-1.5 text-xs font-medium text-stone-800 bg-stone-100 hover:bg-stone-200/80 rounded-lg border-0 appearance-none focus:outline-none focus:ring-1 focus:ring-stone-900 cursor-pointer transition-colors"
                >
                  <option value="CONSOLIDATED">Todas as Lojas (Consolidado)</option>
                  {database.stores.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name} {st.isMainStore ? '(Matriz)' : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-stone-500 absolute right-2 pointer-events-none" />
              </div>

              {/* Botão Ver Página Inicial / Landing Page */}
              {onViewLandingPage && (
                <button
                  onClick={onViewLandingPage}
                  title="Ver Página Inicial e Apresentação Institucional"
                  className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg border border-stone-200/80 transition-colors cursor-pointer"
                >
                  <Globe className="w-3.5 h-3.5 text-stone-500" />
                  <span>Apresentação</span>
                </button>
              )}

              {/* Botão Sair / Desconectar */}
              <button
                onClick={onLogout}
                title="Desconectar sessão do usuário atual e retornar à página inicial"
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-stone-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg border border-stone-200/80 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 text-stone-500 group-hover:text-rose-600" />
                <span className="hidden sm:inline">Desconectar</span>
              </button>
            </div>
          </div>

          {/* Desktop Navigation Tabs */}
          <div className="hidden md:flex space-x-1 border-t border-stone-100 -mb-px overflow-x-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => onSelectTab(item.key)}
                  className={`flex items-center gap-2 py-2.5 px-3 border-b-2 text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                    isActive
                      ? 'border-stone-900 text-stone-900'
                      : 'border-transparent text-stone-600 hover:text-stone-900 hover:border-stone-300'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-stone-900' : 'text-stone-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar (High touch-target >= 44px) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-stone-200 px-2 pb-safe">
        <div className="flex items-center justify-around h-16">
          {navItems.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => onSelectTab(item.key)}
                className={`flex flex-col items-center justify-center flex-1 min-h-[44px] py-1 cursor-pointer transition-colors ${
                  isActive ? 'text-stone-900 font-bold' : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'stroke-[2.2]' : 'stroke-[1.6]'}`} />
                <span className="text-[10px] tracking-tight">{item.label}</span>
              </button>
            );
          })}
          {/* Menu popup for remaining items */}
          <button
            onClick={() => onSelectTab(activeTab === 'financial' ? 'settings' : 'financial')}
            className={`flex flex-col items-center justify-center flex-1 min-h-[44px] py-1 cursor-pointer transition-colors ${
              ['financial', 'sales', 'production', 'settings'].includes(activeTab)
                ? 'text-stone-900 font-bold'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            <CircleDollarSign className="w-5 h-5 mb-0.5 stroke-[1.8]" />
            <span className="text-[10px] tracking-tight">Financeiro</span>
          </button>
        </div>
      </nav>
    </>
  );
};
