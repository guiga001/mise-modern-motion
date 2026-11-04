// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — Aplicação Principal de Gestão para Comércio Alimentício
 */

import React, { useState, useEffect } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { loadDatabase, saveDatabase, appendAuditLog, MiseDatabaseState } from './lib/storage';
import {
  getActiveSession,
  loadCompanyDatabase,
  saveCompanyDatabase,
  logoutCurrentSession,
} from './lib/auth';
import { BootstrapScreen } from './components/BootstrapScreen';
import { LoginScreen } from './components/LoginScreen';
import { LandingPage } from './components/LandingPage';
import { Navigation, TabKey } from './components/Navigation';
import { DashboardTab } from './components/DashboardTab';
import { RecipesTab } from './components/RecipesTab';
import { IngredientsTab } from './components/IngredientsTab';
import { InventoryTab } from './components/InventoryTab';
import { PurchasesTab } from './components/PurchasesTab';
import { SalesTab } from './components/SalesTab';
import { FinancialTab } from './components/FinancialTab';
import { ProductionTab } from './components/ProductionTab';
import { SettingsTab } from './components/SettingsTab';
import { IntelligenceTab } from './components/IntelligenceTab';

export default function App() {
  const [database, setDatabase] = useState<MiseDatabaseState>(() => {
    const session = getActiveSession();
    if (session) {
      return loadCompanyDatabase(session.companyId);
    }
    const state = loadDatabase();
    return { ...state, activeUserId: null };
  });
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    return window.localStorage.getItem('mise-sidebar-collapsed') === 'true';
  });
  const [isViewingLanding, setIsViewingLanding] = useState<boolean>(() => {
    return !getActiveSession();
  });

  useEffect(() => {
    window.localStorage.setItem('mise-sidebar-collapsed', String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  useEffect(() => {
    // Carregar na montagem inicial com verificação de sessão ativa
    const session = getActiveSession();
    if (session) {
      const state = loadCompanyDatabase(session.companyId);
      setDatabase(state);
      setIsViewingLanding(false);
    } else {
      const state = loadDatabase();
      setDatabase({ ...state, activeUserId: null });
      setIsViewingLanding(true);
    }
  }, []);

  const handleUpdateDatabase = (newState: MiseDatabaseState) => {
    setDatabase(newState);
    if (newState.company?.id) {
      saveCompanyDatabase(newState.company.id, newState);
    } else {
      saveDatabase(newState);
    }
  };

  const handleSelectStore = (storeId: string) => {
    const updated = {
      ...database,
      activeStoreId: storeId,
    };
    handleUpdateDatabase(updated);
  };

  const handleResetToBootstrap = () => {
    logoutCurrentSession();
    const emptyState = loadDatabase();
    setDatabase({ ...emptyState, activeUserId: null });
    setActiveTab('dashboard');
    setIsViewingLanding(true);
  };

  const handleLogout = () => {
    logoutCurrentSession();
    setDatabase((prev) => ({
      ...prev,
      activeUserId: null,
    }));
    setIsViewingLanding(true);
  };

  // Se o usuário estiver desconectado / deslogado, ou se a empresa ainda não tiver sido inicializada,
  // ou se solicitou visualizar a apresentação, exibe a Landing Page inicial completa com Login e Cadastro
  if (
    !database.activeUserId ||
    !database.users.some(u => u.id === database.activeUserId) ||
    isViewingLanding
  ) {
    return (
      <MotionConfig reducedMotion="user">
        <motion.div
          key="mise-landing"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
        >
          <LandingPage
            database={database}
            onLoginSuccess={(newState, activeUserId) => {
              handleUpdateDatabase({
                ...newState,
                activeUserId,
              });
              setIsViewingLanding(false);
            }}
            onBackToDashboard={
              database.activeUserId && database.users.some(u => u.id === database.activeUserId)
                ? () => setIsViewingLanding(false)
                : undefined
            }
          />
        </motion.div>
      </MotionConfig>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="mise-app-layout min-h-screen bg-stone-50 text-stone-900 flex flex-col pb-20 md:pb-8">
      {/* Top Header & Navigation */}
      <Navigation
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        database={database}
        onSelectStore={handleSelectStore}
        onLogout={handleLogout}
        onViewLandingPage={() => setIsViewingLanding(true)}
        isSidebarCollapsed={isSidebarCollapsed}
        onToggleSidebar={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
      />

      {/* Main Tab View */}
      <main
        className={`mise-workspace min-w-0 flex-1 transition-[margin] duration-300 ease-in-out ${
          isSidebarCollapsed ? 'md:ml-[72px]' : 'md:ml-60'
        }`}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeTab}
            className="mise-motion-page"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            {activeTab === 'dashboard' && (
              <DashboardTab
                database={database}
                onNavigate={(tab) => setActiveTab(tab)}
                onUpdateDatabase={handleUpdateDatabase}
              />
            )}
            {activeTab === 'intelligence' && (
              <IntelligenceTab
                database={database}
                onUpdateDatabase={handleUpdateDatabase}
                onNavigateTab={(tab) => setActiveTab(tab as any)}
              />
            )}
            {activeTab === 'recipes' && (
              <RecipesTab
                database={database}
                onUpdateDatabase={handleUpdateDatabase}
                onNavigateToIngredients={() => setActiveTab('ingredients')}
              />
            )}
            {activeTab === 'ingredients' && (
              <IngredientsTab
                database={database}
                onUpdateDatabase={handleUpdateDatabase}
              />
            )}
            {activeTab === 'inventory' && (
              <InventoryTab
                database={database}
                onUpdateDatabase={handleUpdateDatabase}
                onNavigateToIngredients={() => setActiveTab('ingredients')}
              />
            )}
            {activeTab === 'purchases' && (
              <PurchasesTab
                database={database}
                onUpdateDatabase={handleUpdateDatabase}
                onNavigateToIngredients={() => setActiveTab('ingredients')}
              />
            )}
            {activeTab === 'sales' && (
              <SalesTab
                database={database}
                onUpdateDatabase={handleUpdateDatabase}
                onNavigateToRecipes={() => setActiveTab('recipes')}
              />
            )}
            {activeTab === 'financial' && (
              <FinancialTab
                database={database}
                onUpdateDatabase={handleUpdateDatabase}
              />
            )}
            {activeTab === 'production' && (
              <ProductionTab
                database={database}
                onUpdateDatabase={handleUpdateDatabase}
                onNavigateToRecipes={() => setActiveTab('recipes')}
              />
            )}
            {activeTab === 'settings' && (
              <SettingsTab
                database={database}
                onUpdateDatabase={handleUpdateDatabase}
                onResetToBootstrap={handleResetToBootstrap}
                onLogout={handleLogout}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
      </div>
    </MotionConfig>
  );
}
