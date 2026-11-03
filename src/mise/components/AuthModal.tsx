/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — Modal de Autenticação Segura (Entrar com Senha & Criar Conta)
 * Regra de Segurança Estrita: Cada empresa é privada e o login exige OBRIGATORIAMENTE
 * e-mail e senha validados criptograficamente (SHA-256). Proibido login sem senha.
 */

import React, { useState } from 'react';
import {
  ChefHat,
  Lock,
  Mail,
  User as UserIcon,
  Store,
  LogIn,
  UserPlus,
  X,
  CheckCircle2,
  Building,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { MiseDatabaseState } from '../lib/storage';
import { loginWithPassword, registerPrivateAccount } from '../lib/auth';

export type AuthMode = 'login' | 'register';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: AuthMode;
  onClose: () => void;
  database: MiseDatabaseState;
  onAuthSuccess: (newState: MiseDatabaseState, activeUserId: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode = 'login',
  onClose,
  onAuthSuccess,
}) => {
  const [mode, setMode] = useState<AuthMode>(initialMode);

  // Login form state
  const [loginEmail, setLoginEmail] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [showLoginPassword, setShowLoginPassword] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string>('');

  // Register form state
  const [ownerName, setOwnerName] = useState<string>('');
  const [ownerEmail, setOwnerEmail] = useState<string>('');
  const [registerPassword, setRegisterPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showRegisterPassword, setShowRegisterPassword] = useState<boolean>(false);
  const [restaurantName, setRestaurantName] = useState<string>('');
  const [storeName, setStoreName] = useState<string>('Matriz');
  const [registerError, setRegisterError] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  // Handle Login com Validação Estrita de Senha
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const email = loginEmail.trim();
    const password = loginPassword;

    if (!email) {
      setLoginError('Por favor informe o e-mail cadastrado da sua empresa.');
      return;
    }

    if (!password) {
      setLoginError('A senha é obrigatória. Cada usuário possui senha única para sua empresa privada.');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = loginWithPassword(email, password);
      setIsSubmitting(false);
      onAuthSuccess(result.database, result.account.id);
      onClose();
    } catch (err: any) {
      setIsSubmitting(false);
      setLoginError(err?.message || 'Falha ao autenticar. Verifique seus dados.');
    }
  };

  // Handle Cadastro com Criação de Senha Obrigatória e Empresa Privada
  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError('');

    if (!ownerName.trim()) {
      setRegisterError('Por favor informe seu nome completo.');
      return;
    }
    if (!ownerEmail.trim() || !ownerEmail.includes('@')) {
      setRegisterError('Por favor informe um e-mail válido.');
      return;
    }
    if (!registerPassword) {
      setRegisterError('Defina uma senha de acesso para sua conta.');
      return;
    }
    if (registerPassword.length < 6) {
      setRegisterError('A senha deve ter no mínimo 6 caracteres para segurança dos seus dados.');
      return;
    }
    if (registerPassword !== confirmPassword) {
      setRegisterError('A confirmação de senha não confere com a senha digitada.');
      return;
    }
    if (!restaurantName.trim()) {
      setRegisterError('Informe o nome da sua empresa / restaurante.');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = registerPrivateAccount({
        ownerName: ownerName.trim(),
        email: ownerEmail.trim(),
        password: registerPassword,
        companyName: restaurantName.trim(),
        storeName: storeName.trim() || 'Matriz',
      });

      setIsSubmitting(false);
      onAuthSuccess(result.database, result.account.id);
      onClose();
    } catch (err: any) {
      setIsSubmitting(false);
      setRegisterError(err?.message || 'Falha ao realizar cadastro.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/75 backdrop-blur-xs">
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-stone-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-stone-900 text-amber-400 flex items-center justify-center shadow-xs">
              <ChefHat className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900 leading-tight">
                Mise — Gestão Alimentícia
              </h3>
              <p className="text-xs text-stone-500">
                {mode === 'login'
                  ? 'Acesso seguro à sua empresa privada'
                  : 'Criar nova conta e empresa privada'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Buttons (Entrar vs Cadastrar) */}
        <div className="grid grid-cols-2 p-1.5 mx-6 mt-4 bg-stone-100 rounded-xl border border-stone-200/70 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setLoginError('');
            }}
            className={`flex items-center justify-center gap-2 py-2 rounded-lg transition-all cursor-pointer ${
              mode === 'login'
                ? 'bg-white text-stone-900 shadow-2xs font-bold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Entrar com Senha</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setRegisterError('');
            }}
            className={`flex items-center justify-center gap-2 py-2 rounded-lg transition-all cursor-pointer ${
              mode === 'register'
                ? 'bg-white text-stone-900 shadow-2xs font-bold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Cadastrar Nova Empresa</span>
          </button>
        </div>

        {/* Modal Body / Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          {mode === 'login' ? (
            /* TAB: ENTRAR COM SENHA */
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <p className="text-xs text-stone-600 leading-relaxed">
                  Digite seu e-mail e senha cadastrados. Seus dados são confidenciais e protegidos por criptografia SHA-256.
                </p>
              </div>

              {loginError && (
                <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span className="leading-tight">{loginError}</span>
                </div>
              )}

              {/* Login Email */}
              <div>
                <label className="block text-xs font-semibold text-stone-800 mb-1">
                  E-mail de Acesso *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="seu-email@restaurante.com.br"
                    className="w-full text-xs pl-9 pr-3.5 py-2.5 rounded-lg border border-stone-300 focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900 bg-white"
                  />
                </div>
              </div>

              {/* Login Password (OBRIGATÓRIA) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-stone-800">
                    Senha de Acesso *
                  </label>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Digite sua senha"
                    className="w-full text-xs pl-9 pr-10 py-2.5 rounded-lg border border-stone-300 focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900 bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 top-2.5 text-stone-400 hover:text-stone-700 transition-colors cursor-pointer"
                    title={showLoginPassword ? 'Ocultar senha' : 'Ver senha'}
                  >
                    {showLoginPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
              >
                <LogIn className="w-4 h-4" />
                <span>{isSubmitting ? 'Verificando Credenciais...' : 'Entrar com E-mail e Senha'}</span>
              </button>

              <div className="text-center pt-2">
                <p className="text-xs text-stone-500">
                  Ainda não tem conta para seu restaurante?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('register');
                      setRegisterError('');
                    }}
                    className="font-bold text-stone-900 hover:underline cursor-pointer"
                  >
                    Cadastre-se aqui
                  </button>
                </p>
              </div>
            </form>
          ) : (
            /* TAB: CADASTRAR NOVA EMPRESA E SENHA */
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              {registerError && (
                <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span className="leading-tight">{registerError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Nome do Dono / Gestor *
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-stone-400 absolute left-3 top-2.5 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      placeholder="Ex: Carlos Mendonça"
                      className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-stone-300 focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    E-mail de Login *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-2.5 pointer-events-none" />
                    <input
                      type="email"
                      required
                      value={ownerEmail}
                      onChange={(e) => setOwnerEmail(e.target.value)}
                      placeholder="carlos@seurestaurante.com"
                      className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-stone-300 focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
                    />
                  </div>
                </div>
              </div>

              {/* Senha e Confirmação de Senha */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Senha de Acesso (Mín. 6 dígitos) *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-2.5 pointer-events-none" />
                    <input
                      type={showRegisterPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={registerPassword}
                      onChange={(e) => setRegisterPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full text-xs pl-9 pr-9 py-2 rounded-lg border border-stone-300 focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                      className="absolute right-2.5 top-2 text-stone-400 hover:text-stone-700 cursor-pointer"
                    >
                      {showRegisterPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Confirmar Senha *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-2.5 pointer-events-none" />
                    <input
                      type={showRegisterPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repita a senha"
                      className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-stone-300 focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
                    />
                  </div>
                </div>
              </div>

              {/* Nome do Restaurante e Unidade */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Nome da Empresa / Restaurante *
                  </label>
                  <div className="relative">
                    <Building className="w-4 h-4 text-stone-400 absolute left-3 top-2.5 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={restaurantName}
                      onChange={(e) => setRestaurantName(e.target.value)}
                      placeholder="Ex: Burger House Gourmet"
                      className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-stone-300 focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Unidade
                  </label>
                  <div className="relative">
                    <Store className="w-4 h-4 text-stone-400 absolute left-3 top-2.5 pointer-events-none" />
                    <input
                      type="text"
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      placeholder="Matriz"
                      className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-stone-300 focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
                    />
                  </div>
                </div>
              </div>



              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold text-stone-950 bg-amber-400 hover:bg-amber-300 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSubmitting ? 'Criando Empresa Segura...' : 'Cadastrar Empresa e Acessar'}</span>
              </button>

              <div className="text-center pt-1">
                <p className="text-xs text-stone-500">
                  Já possui uma conta?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setLoginError('');
                    }}
                    className="font-bold text-stone-900 hover:underline cursor-pointer"
                  >
                    Entrar aqui
                  </button>
                </p>
              </div>
            </form>
          )}
        </div>

        {/* Modal Footer Assurance */}
        <div className="px-6 py-3 bg-stone-50 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-500">
          <span className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-emerald-600" />
            <span>Empresa 100% privada · Senha criptografada (SHA-256)</span>
          </span>
          <span className="font-mono text-stone-400">Mise v1.1 Seguro</span>
        </div>
      </div>
    </div>
  );
};
