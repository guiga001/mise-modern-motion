/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — Configurações, Multi-Loja, Usuários Dono, Auditoria e LGPD
 * Invariante: Portabilidade com 1 clique (JSON completo) e auditoria append-only.
 */

import React, { useState } from 'react';
import {
  Settings,
  Store,
  Users,
  Shield,
  Download,
  Trash2,
  Plus,
  Key,
  CheckCircle2,
  AlertTriangle,
  FileText,
  LogOut,
} from 'lucide-react';
import { Store as StoreType, User } from '../domain/types';
import { MiseDatabaseState, appendAuditLog, purgeCompanyData } from '../lib/storage';
import { hashPassword } from '../lib/crypto';
import { getRegisteredAccounts } from '../lib/auth';
import { Modal, ConfirmDialog } from './Modal';

interface SettingsTabProps {
  database: MiseDatabaseState;
  onUpdateDatabase: (newState: MiseDatabaseState) => void;
  onResetToBootstrap: () => void;
  onLogout?: () => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  database,
  onUpdateDatabase,
  onResetToBootstrap,
  onLogout,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'STORES' | 'USERS' | 'AUDIT' | 'LGPD'>('STORES');

  // Modais
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isPurgeConfirmOpen, setIsPurgeConfirmOpen] = useState(false);

  // Form Loja
  const [storeName, setStoreName] = useState('');
  const [storeCode, setStoreCode] = useState('');
  const [storeAddress, setStoreAddress] = useState('');

  // Form Usuário (Sócio / Contador)
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userInviteError, setUserInviteError] = useState('');

  const handleAddStore = (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName.trim()) return;

    const newStore: StoreType = {
      id: `store_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: storeName.trim(),
      code: storeCode.trim().toUpperCase() || 'FILIAL',
      address: storeAddress.trim() || undefined,
      isMainStore: false,
      createdAt: new Date().toISOString(),
    };

    const newState = appendAuditLog(
      { ...database, stores: [...database.stores, newStore] },
      'CREATE_STORE',
      'Store',
      newStore.id,
      `Nova filial '${newStore.name}' (${newStore.code}) cadastrada.`
    );

    onUpdateDatabase(newState);
    setIsStoreModalOpen(false);
    setStoreName('');
    setStoreCode('');
    setStoreAddress('');
  };

  const handleInviteUser = (e: React.FormEvent) => {
    e.preventDefault();
    setUserInviteError('');

    if (!userName.trim() || !userEmail.trim()) {
      setUserInviteError('Preencha o nome e e-mail do usuário.');
      return;
    }
    if (!userPassword || userPassword.length < 6) {
      setUserInviteError('A senha inicial deve ter no mínimo 6 caracteres.');
      return;
    }

    const cleanEmail = userEmail.trim().toLowerCase();
    const cleanName = userName.trim();
    const pHash = hashPassword(userPassword);

    const newUser: User = {
      id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: cleanName,
      email: cleanEmail,
      passwordHash: pHash,
      role: 'DONO',
      storeIds: database.stores.map((s) => s.id),
      twoFactorEnabled: false,
      createdAt: new Date().toISOString(),
    };

    // Registra conta no registro de contas do sistema
    const accounts = getRegisteredAccounts();
    accounts.push({
      id: newUser.id,
      email: cleanEmail,
      name: cleanName,
      companyId: database.company?.id || 'default',
      companyName: database.company?.name || 'Mise',
      passwordHash: pHash,
      createdAt: newUser.createdAt,
    });
    localStorage.setItem('mise_accounts_registry_v1', JSON.stringify(accounts));

    const newState = appendAuditLog(
      { ...database, users: [...database.users, newUser] },
      'INVITE_USER',
      'User',
      newUser.id,
      `Usuário sócio/contador '${newUser.name}' (${newUser.email}) cadastrado com senha e papel único DONO.`
    );

    onUpdateDatabase(newState);
    setIsUserModalOpen(false);
    setUserName('');
    setUserEmail('');
    setUserPassword('');
    setUserInviteError('');
  };

  const handleExportBackupJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(database, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute(
      'download',
      `mise_backup_${database.company?.name.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    const newState = appendAuditLog(
      database,
      'EXPORT_FULL_DATA',
      'Company',
      database.company?.id || 'COMP',
      'Exportação completa dos dados da empresa realizada para portabilidade LGPD.'
    );
    onUpdateDatabase(newState);
  };

  const handlePurgeConfirm = (reason: string) => {
    purgeCompanyData();
    onResetToBootstrap();
  };

  return (
    <div className="py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-stone-900 tracking-tight">
            Configurações, Auditoria & Privacidade (LGPD)
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Empresa: <strong className="text-stone-900">{database.company?.name}</strong> · Instalação Dedicada Monotenant
          </p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveSubTab('STORES')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            activeSubTab === 'STORES' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          Lojas ({database.stores.length})
        </button>
        <button
          onClick={() => setActiveSubTab('USERS')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            activeSubTab === 'USERS' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          Usuários Dono ({database.users.length})
        </button>
        <button
          onClick={() => setActiveSubTab('AUDIT')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            activeSubTab === 'AUDIT' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          Auditoria Append-Only ({database.auditLogs.length})
        </button>
        <button
          onClick={() => setActiveSubTab('LGPD')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            activeSubTab === 'LGPD' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          Backup & LGPD
        </button>
      </div>

      {/* SUBTAB: LOJAS */}
      {activeSubTab === 'STORES' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setIsStoreModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Adicionar Loja / Filial</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {database.stores.map((st) => (
              <div
                key={st.id}
                className="bg-white rounded-xl border border-stone-200/80 p-5 shadow-2xs space-y-2"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-stone-500 uppercase tracking-wider">
                      {st.code}
                    </span>
                    <h3 className="text-sm font-bold text-stone-900">{st.name}</h3>
                  </div>
                  {st.isMainStore && (
                    <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Matriz
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-500">
                  {st.address || 'Endereço não informado'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUBTAB: USUÁRIOS */}
      {activeSubTab === 'USERS' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-bold text-stone-900">Sócios, Donos e Gestores Cadastrados</h3>
              <p className="text-[11px] text-stone-500">
                Instalação monotenant: todos os acessos compartilham privilégios de gestão com auditoria individual.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-rose-50 hover:text-rose-700 rounded-lg transition-colors cursor-pointer border border-stone-200"
                >
                  <LogOut className="w-4 h-4 text-stone-500" />
                  <span>Desconectar Sessão</span>
                </button>
              )}
              <button
                onClick={() => setIsUserModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-lg transition-colors cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Convidar Sócio ou Contador</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-stone-200/80 overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50/60 text-stone-500 font-semibold">
                  <th className="py-3 px-4">Nome</th>
                  <th className="py-3 px-4">E-mail</th>
                  <th className="py-3 px-4">Papel Canônico</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {database.users.map((u) => {
                  const isCurrent = u.id === database.activeUserId;
                  return (
                    <tr key={u.id} className="hover:bg-stone-50/60">
                      <td className="py-3 px-4">
                        <div className="font-bold text-stone-900 flex items-center gap-2">
                          <span>{u.name}</span>
                          {isCurrent && (
                            <span className="text-[10px] bg-stone-900 text-amber-400 font-mono font-bold px-1.5 py-0.5 rounded">
                              Você (Ativo)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-stone-700">{u.email}</td>
                      <td className="py-3 px-4 font-mono font-bold text-stone-900">DONO</td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-[11px] font-bold text-emerald-700">Ativo</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isCurrent ? (
                          onLogout && (
                            <button
                              onClick={onLogout}
                              className="text-stone-500 hover:text-rose-700 font-medium text-xs cursor-pointer"
                            >
                              Sair
                            </button>
                          )
                        ) : (
                          <button
                            onClick={() => {
                              const updated = { ...database, activeUserId: u.id };
                              const audited = appendAuditLog(
                                updated,
                                'USER_SWITCH',
                                'User',
                                u.id,
                                `Alternou a sessão ativa para o usuário '${u.name}'.`
                              );
                              onUpdateDatabase(audited);
                            }}
                            className="text-stone-700 hover:text-stone-900 font-medium text-xs underline cursor-pointer"
                          >
                            Alternar para este perfil
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB: AUDIT LOG */}
      {activeSubTab === 'AUDIT' && (
        <div className="bg-white rounded-xl border border-stone-200/80 overflow-hidden shadow-2xs">
          <div className="p-4 border-b border-stone-100">
            <h3 className="text-sm font-bold text-stone-900">Trilha de Auditoria (Append-Only)</h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Registra quem fez, o que foi alterado, data/hora e justificativa. Imutável contra fraudes.
            </p>
          </div>

          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50/60 text-stone-500 font-semibold sticky top-0">
                  <th className="py-2.5 px-4">Data / Hora (UTC)</th>
                  <th className="py-2.5 px-4">Ação</th>
                  <th className="py-2.5 px-4">Usuário</th>
                  <th className="py-2.5 px-4">Entidade</th>
                  <th className="py-2.5 px-4">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {database.auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-stone-50/50">
                    <td className="py-2.5 px-4 font-mono text-[11px] text-stone-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString('pt-BR')}
                    </td>
                    <td className="py-2.5 px-4 font-mono font-bold text-stone-900">
                      {log.action}
                    </td>
                    <td className="py-2.5 px-4 text-stone-700 font-medium">
                      {log.userName}
                    </td>
                    <td className="py-2.5 px-4 text-stone-500 font-mono">
                      {log.entityType}
                    </td>
                    <td className="py-2.5 px-4 text-stone-700 max-w-md truncate">
                      {log.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB: BACKUP & LGPD */}
      {activeSubTab === 'LGPD' && (
        <div className="space-y-6 max-w-3xl">
          <div className="bg-white rounded-xl border border-stone-200/80 p-6 shadow-2xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                <Download className="w-4 h-4 text-stone-700" />
                <span>Portabilidade de Dados (Exportação Integral JSON)</span>
              </h3>
              <p className="text-xs text-stone-500 mt-1">
                Conforme exigido pelo Artigo 18 da LGPD, você pode descarregar todos os seus cadastros, insumos, fichas técnicas, movimentações e histórico financeiro em formato aberto a qualquer momento.
              </p>
            </div>

            <button
              onClick={handleExportBackupJson}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              <Download className="w-4 h-4" />
              <span>Exportar Backup Completo (.JSON)</span>
            </button>
          </div>

          {/* Zona de Perigo / Eliminação */}
          <div className="bg-rose-50/60 rounded-xl border border-rose-200 p-6 shadow-2xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-rose-900 flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-700" />
                <span>Direito de Eliminação / Encerramento da Empresa</span>
              </h3>
              <p className="text-xs text-rose-800 mt-1">
                Ao excluir, todos os dados, insumos, fichas técnicas e histórico financeiro serão apagados permanentemente do armazenamento local da instalação.
              </p>
            </div>

            <button
              onClick={() => setIsPurgeConfirmOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-rose-700 hover:bg-rose-800 rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              <Trash2 className="w-4 h-4" />
              <span>Eliminar Todos os Dados da Empresa</span>
            </button>
          </div>
        </div>
      )}

      {/* Modal Adicionar Loja */}
      <Modal
        isOpen={isStoreModalOpen}
        onClose={() => setIsStoreModalOpen(false)}
        title="Cadastrar Nova Loja / Filial"
        subtitle="Gerencie múltiplas unidades com controle de estoque e DRE independentes."
      >
        <form onSubmit={handleAddStore} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Nome da Loja *
            </label>
            <input
              type="text"
              required
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="Ex: Filial Shopping Center"
              className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Código Curto (Sigla)
              </label>
              <input
                type="text"
                value={storeCode}
                onChange={(e) => setStoreCode(e.target.value)}
                placeholder="Ex: SHOPPING"
                className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-900 uppercase font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Endereço
              </label>
              <input
                type="text"
                value={storeAddress}
                onChange={(e) => setStoreAddress(e.target.value)}
                placeholder="Ex: Av. Paulista, 1000"
                className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-900"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
            <button
              type="button"
              onClick={() => setIsStoreModalOpen(false)}
              className="px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              Salvar Loja
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Convidar Usuário Dono */}
      <Modal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        title="Convidar Sócio ou Contador"
        subtitle="Todos os usuários convidados possuem o mesmo papel canônico DONO."
      >
        <form onSubmit={handleInviteUser} className="space-y-4">
          {userInviteError && (
            <div className="p-2.5 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
              {userInviteError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Nome Completo *
            </label>
            <input
              type="text"
              required
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Ex: Mariana Castro"
              className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              E-mail *
            </label>
            <input
              type="email"
              required
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              placeholder="Ex: socia@restaurante.com.br"
              className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Senha Inicial de Acesso (Mín. 6 caracteres) *
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={userPassword}
              onChange={(e) => setUserPassword(e.target.value)}
              placeholder="Defina a senha inicial deste usuário"
              className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-900"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
            <button
              type="button"
              onClick={() => setIsUserModalOpen(false)}
              className="px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              Cadastrar Dono
            </button>
          </div>
        </form>
      </Modal>

      {/* Diálogo de Confirmação para Purge Total */}
      <ConfirmDialog
        isOpen={isPurgeConfirmOpen}
        onClose={() => setIsPurgeConfirmOpen(false)}
        onConfirm={handlePurgeConfirm}
        title="Excluir Permanentemente Todos os Dados da Empresa?"
        description="Esta ação é irrevogável. Todas as fichas técnicas, insumos, movimentações de estoque, histórico de vendas e contas serão eliminados permanentemente do sistema."
        confirmLabel="Sim, Excluir Definitivamente"
        isDestructive={true}
        requireReason={true}
      />
    </div>
  );
};
