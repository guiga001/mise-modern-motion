/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — Tela de Conexão / Login Seguro com Senha Obrigatória
 * Cada usuário e empresa privada possui credenciais exclusivas e protegidas por SHA-256.
 */

import React, { useState } from 'react';
import { ChefHat, ShieldCheck, LogIn, Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { MiseDatabaseState } from '../lib/storage';
import { loginWithPassword } from '../lib/auth';

interface LoginScreenProps {
  database: MiseDatabaseState;
  onLoginSuccess: (newState: MiseDatabaseState, userId: string) => void;
  onGoToRegister?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLoginSuccess,
  onGoToRegister,
}) => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('Por favor, digite seu e-mail de acesso.');
      return;
    }

    if (!password) {
      setError('A senha é obrigatória para acessar sua empresa privada.');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = loginWithPassword(cleanEmail, password);
      setIsSubmitting(false);
      onLoginSuccess(result.database, result.account.id);
    } catch (err: any) {
      setIsSubmitting(false);
      setError(err?.message || 'Falha ao conectar. Verifique seu e-mail e senha.');
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
        <h2 className="mt-4 text-center text-2xl font-black tracking-tight text-stone-900">
          Mise — Gestão Alimentícia
        </h2>
        <div className="mt-1 flex items-center justify-center gap-1.5 text-xs text-stone-600">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Acesso Privado e Criptografado por Empresa</span>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm sm:rounded-2xl border border-stone-200/80 sm:px-10">
          <div className="mb-6 pb-4 border-b border-stone-100">
            <div className="flex items-center gap-2 text-stone-900 font-bold text-sm">
              <Lock className="w-4 h-4 text-amber-600" />
              <span>Autenticação de Usuário e Empresa</span>
            </div>
            <p className="text-xs text-stone-500 mt-1 leading-relaxed">
              Digite seu e-mail e sua senha exclusiva cadastrados para acessar os dados operacionais da sua empresa.
            </p>
          </div>

          <form onSubmit={handleConnect} className="space-y-4">
            {error && (
              <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="leading-tight">{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                E-mail Cadastrado *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu-email@restaurante.com.br"
                  className="w-full text-xs pl-9 pr-3.5 py-2.5 rounded-lg border border-stone-300 focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900 bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Senha de Acesso *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite sua senha cadastrada"
                  className="w-full text-xs pl-9 pr-10 py-2.5 rounded-lg border border-stone-300 focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900 bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-stone-400 hover:text-stone-700 transition-colors cursor-pointer"
                  title={showPassword ? 'Ocultar senha' : 'Ver senha'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-4 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
            >
              <LogIn className="w-4 h-4" />
              <span>{isSubmitting ? 'Verificando Senha...' : 'Entrar com Senha'}</span>
            </button>
          </form>

          {onGoToRegister && (
            <div className="mt-6 pt-4 border-t border-stone-100 text-center">
              <p className="text-xs text-stone-500">
                Ainda não cadastrou sua empresa?{' '}
                <button
                  type="button"
                  onClick={onGoToRegister}
                  className="font-bold text-stone-900 hover:underline cursor-pointer"
                >
                  Cadastre-se aqui
                </button>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
