/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — Tela de Inicialização do Primeiro Acesso (Bootstrap do Dono)
 * Invariante: O banco inicia 100% VAZIO. Sem seed, sem dados fictícios.
 */

import React, { useState } from 'react';
import { ChefHat, ShieldCheck, Store, User, ArrowRight } from 'lucide-react';
import { bootstrapOwner, MiseDatabaseState } from '../lib/storage';

interface BootstrapScreenProps {
  onBootstrapSuccess: (newState: MiseDatabaseState) => void;
}

export const BootstrapScreen: React.FC<BootstrapScreenProps> = ({ onBootstrapSuccess }) => {
  const [companyName, setCompanyName] = useState('');
  const [storeName, setStoreName] = useState('Matriz');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!companyName.trim()) {
      setError('Informe o nome ou razão social do seu negócio.');
      return;
    }
    if (!storeName.trim()) {
      setError('Informe o nome da primeira loja / unidade.');
      return;
    }
    if (!ownerName.trim()) {
      setError('Informe o nome completo do proprietário ou gestor.');
      return;
    }
    if (!ownerEmail.trim() || !ownerEmail.includes('@')) {
      setError('Informe um e-mail válido para o proprietário.');
      return;
    }

    try {
      setIsSubmitting(true);
      const newState = bootstrapOwner(companyName, storeName, ownerName, ownerEmail);
      onBootstrapSuccess(newState);
    } catch (err: any) {
      setError(err?.message || 'Falha ao inicializar a empresa.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-xl bg-stone-900 text-amber-400 flex items-center justify-center shadow-md">
            <ChefHat className="w-7 h-7 stroke-[2]" />
          </div>
        </div>
        <h2 className="mt-4 text-center text-2xl font-bold tracking-tight text-stone-900">
          Mise — Gestão Alimentícia
        </h2>
        <p className="mt-1 text-center text-xs text-stone-600">
          Instalação Própria · Papel Único Dono · Controle Real de CMV
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm sm:rounded-2xl border border-stone-200/80 sm:px-10">
          <div className="mb-6 pb-4 border-b border-stone-100">
            <div className="flex items-center gap-2 text-stone-900 font-semibold text-sm">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Configuração Inicial do Proprietário</span>
            </div>
            <p className="text-xs text-stone-500 mt-1 leading-relaxed">
              O banco de dados começa limpo, sem cadastros ou produtos fictícios. Preencha seus dados para começar.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Nome do Negócio / Empresa *
              </label>
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Ex: Trattoria & Pizzaria di Napoli"
                className="w-full text-sm px-3.5 py-2.5 rounded-lg border border-stone-300 focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Nome da Primeira Loja / Matriz *
              </label>
              <div className="relative">
                <Store className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="Ex: Matriz Jardins"
                  className="w-full text-sm pl-9 pr-3.5 py-2.5 rounded-lg border border-stone-300 focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-stone-100">
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Seu Nome Completo (Dono / Gestor) *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="Ex: Carlos Eduardo Silveira"
                  className="w-full text-sm pl-9 pr-3.5 py-2.5 rounded-lg border border-stone-300 focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Seu E-mail de Gestão *
              </label>
              <input
                type="email"
                required
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                placeholder="Ex: dono@restaurante.com.br"
                className="w-full text-sm px-3.5 py-2.5 rounded-lg border border-stone-300 focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-4 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold text-white bg-stone-900 hover:bg-stone-800 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
            >
              <span>{isSubmitting ? 'Configurando instalação...' : 'Iniciar Sistema Mise'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
