/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — Página Inicial (Design Branco Minimalista com Acentos Preto & Laranja)
 * Animações de fundo ultraleves em GPU, alta fidelidade visual,
 * calculadora de economia em tempo real e autenticação estrita com senha única.
 */

import React, { useState } from 'react';
import {
  ChefHat,
  LogIn,
  UserPlus,
  TrendingDown,
  TrendingUp,
  ShieldCheck,
  Calculator,
  ArrowRight,
  Boxes,
  FileSpreadsheet,
  Coins,
  CheckCircle2,
  Clock,
  Layers,
  Scale,
  CalendarCheck,
  Lock,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Zap,
  ArrowUpRight,
} from 'lucide-react';
import { MiseDatabaseState } from '../lib/storage';
import { AuthModal, AuthMode } from './AuthModal';

interface LandingPageProps {
  database: MiseDatabaseState;
  onLoginSuccess: (newState: MiseDatabaseState, activeUserId: string) => void;
  onBackToDashboard?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  database,
  onLoginSuccess,
  onBackToDashboard,
}) => {
  // Modal de Autenticação Segura
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<AuthMode>('login');

  // Estado da Calculadora de Retenção de CMV & Lucro
  const [monthlyRevenue, setMonthlyRevenue] = useState<number>(95000);
  const [currentCmvPercent, setCurrentCmvPercent] = useState<number>(37);
  const [targetCmvPercent, setTargetCmvPercent] = useState<number>(31.5);

  // Tab ativa da demonstração técnica dos módulos
  const [showcaseTab, setShowcaseTab] = useState<'simulador' | 'fefo' | 'nfe' | 'caixa'>('simulador');

  // FAQ Accordion
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // Cálculos reativos da calculadora de lucro
  const cmvReductionPercent = Math.max(0, currentCmvPercent - targetCmvPercent);
  const monthlySavings = (monthlyRevenue * cmvReductionPercent) / 100;
  const annualSavings = monthlySavings * 12;

  const openAuth = (mode: AuthMode) => {
    setAuthMode(mode);
    setAuthModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-white text-neutral-900 font-sans selection:bg-orange-500 selection:text-white relative overflow-hidden">
      {/* =========================================================================
          BACKGROUND ANIMADO ULTRALEVE (100% GPU / Zero impacto de performance)
         ========================================================================= */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
        {/* Subtle geometric dot grid pattern */}
        <div className="absolute inset-0 bg-dot-grid opacity-60" />

        {/* Floating ambient glow in soft orange (Top Right) */}
        <div
          className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-orange-400/12 blur-[100px] animate-float-slow"
        />

        {/* Floating ambient glow in soft neutral/charcoal (Bottom Left) */}
        <div
          className="absolute top-[40%] -left-32 w-[520px] h-[520px] rounded-full bg-neutral-900/5 blur-[90px] animate-float-reverse"
        />

        {/* Warm center highlight on hero */}
        <div
          className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[350px] rounded-full bg-orange-500/6 blur-[120px] animate-glow-pulse"
        />
      </div>

      {/* Banner se já houver sessão ativa do usuário */}
      {onBackToDashboard && database.activeUserId && (
        <div className="relative z-40 bg-neutral-950 text-neutral-200 text-xs py-2 px-4 flex items-center justify-between border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
            <span>
              Sessão ativa de{' '}
              <strong className="text-white font-semibold">
                {database.users.find((u) => u.id === database.activeUserId)?.name || 'Gestor'}
              </strong>
            </span>
          </div>
          <button
            onClick={onBackToDashboard}
            className="text-orange-400 hover:text-orange-300 font-bold flex items-center gap-1 cursor-pointer transition-colors"
          >
            <span>Voltar ao Painel Operacional</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* =========================================================================
          TOP BAR CONTRACT (3 Zonas Estritas: Marca — Links — Ação Primária)
         ========================================================================= */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-neutral-200/80 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zona 1: Marca (Elemento único, tipografia forte e acento em laranja) */}
          <a href="#" className="flex items-center gap-2.5 shrink-0 group">
            <div className="w-9 h-9 rounded-xl bg-neutral-950 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
              <ChefHat className="w-5 h-5 text-orange-500 stroke-[2.2]" />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black tracking-tight text-neutral-950 font-sans">
                Mise
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 mb-1" />
            </div>
          </a>

          {/* Zona 2: 4 Links de navegação concisos em linha única */}
          <nav className="hidden md:flex items-center gap-7 text-xs font-semibold text-neutral-600">
            <a href="#engenharia" className="hover:text-neutral-950 transition-colors whitespace-nowrap shrink-0">
              Engenharia de CMV
            </a>
            <a href="#calculadora" className="hover:text-neutral-950 transition-colors whitespace-nowrap shrink-0">
              Calculadora de Lucro
            </a>
            <a href="#modulos" className="hover:text-neutral-950 transition-colors whitespace-nowrap shrink-0">
              Módulos do Sistema
            </a>
            <a href="#seguranca" className="hover:text-neutral-950 transition-colors whitespace-nowrap shrink-0">
              Privacidade & Senha
            </a>
          </nav>

          {/* Zona 3: Ações de Autenticação com Senha Única */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => openAuth('login')}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-neutral-800 hover:text-neutral-950 hover:bg-neutral-100 rounded-xl transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              <LogIn className="w-3.5 h-3.5 text-neutral-600" />
              <span>Entrar</span>
            </button>

            <button
              type="button"
              onClick={() => openAuth('register')}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-neutral-950 hover:bg-neutral-900 border border-neutral-900 hover:border-orange-500 rounded-xl transition-all cursor-pointer shadow-sm hover:shadow-orange-500/10 whitespace-nowrap shrink-0"
            >
              <UserPlus className="w-3.5 h-3.5 text-orange-400" />
              <span>Cadastrar Empresa</span>
            </button>
          </div>
        </div>
      </header>

      {/* =========================================================================
          HERO SECTION (Alto Impacto, Branco Minimalista, Tipografia Forte)
         ========================================================================= */}
      <section className="relative z-10 pt-14 pb-20 md:pt-22 md:pb-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            {/* Kicker Tipográfico Limpo (Zero Pills) */}
            <div className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest text-neutral-500 mb-5">
              <span className="text-orange-600">Mise Gastronomia</span>
              <span aria-hidden="true">·</span>
              <span>Engenharia de Margem</span>
              <span aria-hidden="true">·</span>
              <span>Controle de Estoque FEFO</span>
            </div>

            {/* Headline Monumental com Equilíbrio de Quebra */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-neutral-950 tracking-tight leading-[1.08] text-balance">
              Onde cada centavo da sua cozinha se transforma em{' '}
              <span className="relative whitespace-nowrap">
                <span className="relative z-10 text-orange-600">lucro líquido</span>
                <span className="absolute bottom-1 left-0 w-full h-3 bg-orange-100/80 -z-0 rounded-xs" />
              </span>
              .
            </h1>

            {/* Subtítulo Focado no Negócio Real */}
            <p className="mt-6 text-base sm:text-lg text-neutral-600 leading-relaxed max-w-2xl mx-auto text-balance">
              Chega de perdas invisíveis na despensa e margens comidas pelas taxas de delivery.
              A <strong>Mise</strong> decompõe o seu CMV real centavo por centavo, automatiza pedidos de compra
              sem redigitação de NF-e e previne quebras de estoque com matemática determinística.
            </p>

            {/* Grupo de Ação de Alto Contraste */}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5">
              <button
                type="button"
                onClick={() => openAuth('register')}
                className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl text-sm font-bold text-white bg-neutral-950 hover:bg-neutral-900 border border-neutral-950 hover:border-orange-500 shadow-md hover:shadow-orange-500/20 transition-all cursor-pointer group"
              >
                <span>Criar Minha Empresa Grátis</span>
                <ArrowRight className="w-4 h-4 text-orange-400 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => {
                  const calc = document.getElementById('calculadora');
                  calc?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-bold text-neutral-800 hover:text-neutral-950 bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 transition-all cursor-pointer"
              >
                <Calculator className="w-4 h-4 text-neutral-600" />
                <span>Simular Retenção de Lucro</span>
              </button>
            </div>

            {/* Garantia de Segurança e Isolamento */}
            <div className="mt-5 flex items-center justify-center gap-2 text-[11px] text-neutral-500">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Instalação privada por empresa · Senha única criptografada (SHA-256)</span>
            </div>
          </div>

          {/* =========================================================================
              HERO VISUAL SHOWCASE (Imagem de Gastronomia de Luxo + Métricas Vivas)
             ========================================================================= */}
          <div className="mt-14 relative max-w-5xl mx-auto">
            {/* Moldura Minimalista com Borda Fina e Sombra de Estúdio */}
            <div className="relative rounded-2xl bg-neutral-950 p-2 sm:p-3 shadow-2xl border border-neutral-200 overflow-hidden">
              <div className="relative aspect-16/9 rounded-xl overflow-hidden bg-neutral-900">
                <img
                  src="/src/assets/images/hero_restaurant_craft_1793400062497.jpg"
                  alt="Cozinha contemporânea de alta precisão operacional Mise"
                  className="w-full h-full object-cover object-center filter brightness-95 contrast-105"
                  referrerPolicy="no-referrer"
                  loading="eager"
                />

                {/* Scrim Gradiente Fino para Leitura Segura */}
                <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/85 via-neutral-950/20 to-transparent" />

                {/* Live Overlays na Imagem: Métricas Reais de Cozinha */}
                <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 flex flex-wrap items-end justify-between gap-3 text-white">
                  <div>
                    <div className="text-[11px] font-mono text-orange-400 font-semibold tracking-wider uppercase">
                      Passagem Operacional em Tempo Real
                    </div>
                    <div className="text-lg sm:text-2xl font-black text-white tracking-tight">
                      Prato Principal: Polvo Grelhado com Mousseline
                    </div>
                    <div className="flex items-center gap-2 text-xs text-neutral-300 mt-1">
                      <span>Custo Unitário: <strong>R$ 21,80</strong></span>
                      <span aria-hidden="true">·</span>
                      <span>Preço Sugerido: <strong>R$ 78,00</strong></span>
                      <span aria-hidden="true">·</span>
                      <span className="text-emerald-400 font-bold">Margem: 72.1%</span>
                    </div>
                  </div>

                  {/* Terminal Card Compacto */}
                  <div className="bg-neutral-900/90 backdrop-blur-md border border-neutral-700/80 px-4 py-2.5 rounded-xl text-xs font-mono hidden sm:block">
                    <div className="text-neutral-400 text-[10px]">CMV DIÁRIO CONSOLIDADO</div>
                    <div className="text-base font-bold text-white flex items-center gap-2">
                      <span className="text-emerald-400 tabular-nums">29.4%</span>
                      <span className="text-[10px] text-neutral-400">(Meta: 31.0%)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Faixa Flutuante de Destaque Técnico */}
            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-white border border-neutral-200/90 shadow-lg px-6 py-2.5 rounded-full hidden md:flex items-center gap-6 text-xs font-medium text-neutral-700">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-orange-500" />
                <span>Cálculo puro em centavos inteiros (BigInt)</span>
              </span>
              <span className="w-px h-3.5 bg-neutral-200" />
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Zero erros de ponto flutuante</span>
              </span>
              <span className="w-px h-3.5 bg-neutral-200" />
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-neutral-900" />
                <span>Totalmente determinístico</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          PROVA QUANTITATIVA & RIGOR DO SISTEMA (4 Indicadores Reais)
         ========================================================================= */}
      <section className="py-16 bg-neutral-50/70 border-y border-neutral-200/80 relative z-10" id="engenharia">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-2xs hover:border-neutral-300 transition-colors">
              <div className="text-2xl sm:text-3xl font-black text-neutral-950 font-mono tabular-nums tracking-tight">
                -4.2%
              </div>
              <div className="text-xs font-bold text-orange-600 mt-1 uppercase tracking-wider">
                Redução de CMV
              </div>
              <p className="text-xs text-neutral-500 mt-2 leading-relaxed">
                Média atingida nas cozinhas ao eliminar porções sem ficha e ingredientes sem cotação.
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-2xs hover:border-neutral-300 transition-colors">
              <div className="text-2xl sm:text-3xl font-black text-neutral-950 font-mono tabular-nums tracking-tight">
                R$ 0,00
              </div>
              <div className="text-xs font-bold text-neutral-800 mt-1 uppercase tracking-wider">
                Desvio de Arredondamento
              </div>
              <p className="text-xs text-neutral-500 mt-2 leading-relaxed">
                Cada receita e nota fiscal é calculada em centavos inteiros, sem resíduos de float.
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-2xs hover:border-neutral-300 transition-colors">
              <div className="text-2xl sm:text-3xl font-black text-neutral-950 font-mono tabular-nums tracking-tight">
                24h / mês
              </div>
              <div className="text-xs font-bold text-orange-600 mt-1 uppercase tracking-wider">
                Tempo Economizado
              </div>
              <p className="text-xs text-neutral-500 mt-2 leading-relaxed">
                Importação instantânea de arquivos XML de NF-e e geração de listas de compras automáticas.
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-2xs hover:border-neutral-300 transition-colors">
              <div className="text-2xl sm:text-3xl font-black text-neutral-950 font-mono tabular-nums tracking-tight">
                100%
              </div>
              <div className="text-xs font-bold text-emerald-700 mt-1 uppercase tracking-wider">
                Privacidade & Senha
              </div>
              <p className="text-xs text-neutral-500 mt-2 leading-relaxed">
                Dados e fornecedores isolados por empresa com hash criptográfico SHA-256 e acesso único.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          CALCULADORA DE RETENÇÃO DE LUCRO & CMV (Interativa em Tempo Real)
         ========================================================================= */}
      <section className="py-20 bg-white relative z-10" id="calculadora">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-orange-600">
              Impacto Financeiro Direto
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-neutral-950 tracking-tight mt-2 text-balance">
              Quanto dinheiro a sua cozinha está deixando na mesa todo mês?
            </h2>
            <p className="text-sm text-neutral-600 mt-3 text-balance">
              Ajuste o seu faturamento mensal e a meta de redução de CMV para calcular o valor exato
              que a Mise recupera diretamente para o fluxo de caixa do seu negócio.
            </p>
          </div>

          <div className="max-w-4xl mx-auto bg-neutral-50 rounded-3xl border border-neutral-200 p-6 sm:p-10 shadow-xs">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Controles de Slider */}
              <div className="lg:col-span-7 space-y-6">
                {/* Slider 1: Faturamento Mensal */}
                <div>
                  <div className="flex items-center justify-between text-xs font-bold text-neutral-800 mb-2">
                    <span>Faturamento Mensal da Empresa</span>
                    <span className="font-mono text-neutral-950 text-sm">
                      R$ {monthlyRevenue.toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={30000}
                    max={500000}
                    step={5000}
                    value={monthlyRevenue}
                    onChange={(e) => setMonthlyRevenue(Number(e.target.value))}
                    className="w-full h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-neutral-950 focus:outline-none"
                  />
                  <div className="flex justify-between text-[10px] text-neutral-400 mt-1 font-mono">
                    <span>R$ 30.000</span>
                    <span>R$ 250.000</span>
                    <span>R$ 500.000</span>
                  </div>
                </div>

                {/* Slider 2: CMV Atual */}
                <div>
                  <div className="flex items-center justify-between text-xs font-bold text-neutral-800 mb-2">
                    <span>CMV Atual Estimado (Custo de Mercadoria)</span>
                    <span className="font-mono text-neutral-950 text-sm">
                      {currentCmvPercent}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={25}
                    max={50}
                    step={0.5}
                    value={currentCmvPercent}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setCurrentCmvPercent(val);
                      if (val <= targetCmvPercent) {
                        setTargetCmvPercent(val - 2);
                      }
                    }}
                    className="w-full h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-orange-600 focus:outline-none"
                  />
                  <div className="flex justify-between text-[10px] text-neutral-400 mt-1 font-mono">
                    <span>25% (Excelente)</span>
                    <span>35% (Médio)</span>
                    <span>50% (Crítico)</span>
                  </div>
                </div>

                {/* Slider 3: Meta de CMV */}
                <div>
                  <div className="flex items-center justify-between text-xs font-bold text-neutral-800 mb-2">
                    <span>Meta de CMV Otimizado com Mise</span>
                    <span className="font-mono text-emerald-700 text-sm font-bold">
                      {targetCmvPercent}% ({cmvReductionPercent.toFixed(1)}% de ganho)
                    </span>
                  </div>
                  <input
                    type="range"
                    min={20}
                    max={Math.max(21, currentCmvPercent - 0.5)}
                    step={0.5}
                    value={targetCmvPercent}
                    onChange={(e) => setTargetCmvPercent(Number(e.target.value))}
                    className="w-full h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-emerald-600 focus:outline-none"
                  />
                  <div className="flex justify-between text-[10px] text-neutral-400 mt-1 font-mono">
                    <span>20%</span>
                    <span>Meta Realista</span>
                    <span>{currentCmvPercent - 0.5}%</span>
                  </div>
                </div>
              </div>

              {/* Placar de Economia Projetada */}
              <div className="lg:col-span-5 bg-neutral-950 text-white rounded-2xl p-6 sm:p-7 border border-neutral-900 shadow-md flex flex-col justify-between">
                <div>
                  <div className="text-[11px] uppercase font-mono font-bold tracking-wider text-orange-400">
                    Lucro Adicional Recuperado
                  </div>

                  {/* Valor Mensal */}
                  <div className="mt-4">
                    <div className="text-xs text-neutral-400">Economia no caixa todo mês:</div>
                    <div className="text-3xl sm:text-4xl font-black text-white font-mono tracking-tight mt-1 tabular-nums">
                      R$ {monthlySavings.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>

                  {/* Valor Anual */}
                  <div className="mt-4 pt-4 border-t border-neutral-800">
                    <div className="text-xs text-neutral-400">Em 12 meses acumulados:</div>
                    <div className="text-xl sm:text-2xl font-bold text-emerald-400 font-mono tracking-tight mt-0.5 tabular-nums">
                      R$ {annualSavings.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => openAuth('register')}
                  className="mt-6 w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold text-neutral-950 bg-orange-500 hover:bg-orange-400 transition-colors shadow-sm cursor-pointer"
                >
                  <span>Recuperar Este Lucro na Minha Cozinha</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          BENTO GRID DE ARQUITETURA OPERACIONAL (4 Pilares Essenciais)
         ========================================================================= */}
      <section className="py-20 bg-neutral-50/50 border-t border-neutral-200/80 relative z-10" id="modulos">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-neutral-500">
              Arquitetura Determinística
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-neutral-950 tracking-tight mt-2 text-balance">
              Quatro pilares matemáticos que blindam a rentabilidade do seu negócio.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Bento Card 1: Ficha Técnica & Explosão Recursiva (Span 7) */}
            <div className="md:col-span-7 bg-white rounded-3xl border border-neutral-200 overflow-hidden shadow-2xs flex flex-col justify-between">
              <div className="p-7">
                <div className="w-10 h-10 rounded-xl bg-neutral-950 text-orange-500 flex items-center justify-center mb-5">
                  <Layers className="w-5 h-5 stroke-[2]" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-neutral-950 tracking-tight">
                  01. Ficha Técnica Viva com Proteção contra Ciclos
                </h3>
                <p className="text-xs sm:text-sm text-neutral-600 mt-2 leading-relaxed">
                  Sub-receitas aninhadas (molhos, caldos e bases) são explodidas recursivamente.
                  Cada grama incorpora o Fator de Correção (perdas limpas) e Fator de Cocção (rendimento térmico).
                  Se o preço da manteiga ou do óleo subir na nota fiscal, o custo da porção se atualiza na hora.
                </p>
              </div>
              <div className="p-4 sm:p-6 bg-neutral-100/60 border-t border-neutral-100">
                <div className="relative aspect-16/9 rounded-xl overflow-hidden border border-neutral-200 bg-white">
                  <img
                    src="/src/assets/images/bento_kitchen_intelligence_1793400063016.jpg"
                    alt="Mise en place de precisão matemática e insumos controlados"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-neutral-950/20" />
                  <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-xs px-3 py-1.5 rounded-lg border border-neutral-200 text-[11px] font-mono font-bold text-neutral-900">
                    Fórmula F01 · Custo Médio Ponderado em Centavos
                  </div>
                </div>
              </div>
            </div>

            {/* Bento Card 2: Estoque FEFO & Vencimentos (Span 5) */}
            <div className="md:col-span-5 bg-white rounded-3xl border border-neutral-200 p-7 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-neutral-950 text-orange-500 flex items-center justify-center mb-5">
                  <Clock className="w-5 h-5 stroke-[2]" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-neutral-950 tracking-tight">
                  02. Estoque FEFO & Risco de Vencimento
                </h3>
                <p className="text-xs sm:text-sm text-neutral-600 mt-2 leading-relaxed">
                  Primeiro que Vence, Primeiro que Sai (*First Expire, First Out*).
                  O sistema cruza o saldo dos lotes com o consumo diário médio e avisa com dias de antecedência
                  o risco de perda financeira em reais.
                </p>
              </div>

              <div className="mt-6 bg-neutral-50 rounded-2xl p-4 border border-neutral-200 space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between text-neutral-700">
                  <span>Queijo Brie (Lote #4102)</span>
                  <span className="text-orange-600 font-bold">Vence em 4 dias</span>
                </div>
                <div className="w-full h-2 bg-neutral-200 rounded-full overflow-hidden">
                  <div className="h-full bg-orange-500 w-[85%]" />
                </div>
                <div className="text-[10px] text-neutral-500 flex justify-between">
                  <span>Consumo previsto: 4.2 kg</span>
                  <span>Excedente em risco: R$ 0,00</span>
                </div>
              </div>
            </div>

            {/* Bento Card 3: Parser de NF-e sem Redigitação (Span 6) */}
            <div className="md:col-span-6 bg-white rounded-3xl border border-neutral-200 p-7 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-neutral-950 text-orange-500 flex items-center justify-center mb-5">
                  <FileSpreadsheet className="w-5 h-5 stroke-[2]" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-neutral-950 tracking-tight">
                  03. Auditoria e Parser de NF-e em 3 Segundos
                </h3>
                <p className="text-xs sm:text-sm text-neutral-600 mt-2 leading-relaxed">
                  Importe o XML da Nota Fiscal Eletrônica diretamente. O motor de similaridade determinístico
                  associa o nome do fornecedor ao seu insumo cadastrado, recalcula o Custo Médio Ponderado
                  e lança o contas a pagar automaticamente.
                </p>
              </div>

              <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-neutral-700 bg-neutral-50 p-3 rounded-xl border border-neutral-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Conversão automática de caixas e fardos para gramas ou mililitros.</span>
              </div>
            </div>

            {/* Bento Card 4: Retirada Segura & Caixa Projetado (Span 6) */}
            <div className="md:col-span-6 bg-white rounded-3xl border border-neutral-200 p-7 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-neutral-950 text-orange-500 flex items-center justify-center mb-5">
                  <Coins className="w-5 h-5 stroke-[2]" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-neutral-950 tracking-tight">
                  04. Retirada Segura do Dono & Fluxo de Caixa
                </h3>
                <p className="text-xs sm:text-sm text-neutral-600 mt-2 leading-relaxed">
                  Nunca mais fique em dúvida se pode retirar pró-labore este mês.
                  A Mise desconta as provisões trabalhistas, impostos do Simples Nacional
                  e colchão operacional dos próximos 30 dias para dizer o valor exato seguro.
                </p>
              </div>

              <div className="mt-6 flex items-center justify-between p-3.5 bg-neutral-950 text-white rounded-xl text-xs font-mono">
                <span className="text-neutral-400">VALOR LIBERADO PARA RETIRADA:</span>
                <span className="text-emerald-400 font-bold text-sm">R$ 14.850,00</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          DEMONSTRAÇÃO INTERATIVA DOS MÓDULOS OPERACIONAIS (Tabs Funcionais)
         ========================================================================= */}
      <section className="py-20 bg-white relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-10">
            <span className="text-xs font-bold uppercase tracking-widest text-orange-600">
              Terminal Operacional
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-neutral-950 tracking-tight mt-2 text-balance">
              Simule a experiência de controle que você terá no dia a dia.
            </h2>
          </div>

          {/* Segmented Controls / Tab Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-2 max-w-2xl mx-auto p-1.5 bg-neutral-100 rounded-2xl border border-neutral-200 mb-8">
            <button
              type="button"
              onClick={() => setShowcaseTab('simulador')}
              className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                showcaseTab === 'simulador'
                  ? 'bg-white text-neutral-950 shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-950'
              }`}
            >
              Simulador "E se?"
            </button>
            <button
              type="button"
              onClick={() => setShowcaseTab('fefo')}
              className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                showcaseTab === 'fefo'
                  ? 'bg-white text-neutral-950 shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-950'
              }`}
            >
              Estoque FEFO
            </button>
            <button
              type="button"
              onClick={() => setShowcaseTab('nfe')}
              className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                showcaseTab === 'nfe'
                  ? 'bg-white text-neutral-950 shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-950'
              }`}
            >
              Parser de NF-e
            </button>
            <button
              type="button"
              onClick={() => setShowcaseTab('caixa')}
              className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                showcaseTab === 'caixa'
                  ? 'bg-white text-neutral-950 shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-950'
              }`}
            >
              Caixa & DRE
            </button>
          </div>

          {/* Tab View Container */}
          <div className="max-w-4xl mx-auto bg-neutral-950 text-white rounded-3xl p-6 sm:p-8 border border-neutral-800 shadow-xl font-mono text-xs">
            {showcaseTab === 'simulador' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
                  <span className="text-orange-400 font-bold uppercase tracking-wider text-[11px]">
                    F01 · SIMULADOR DETERMINÍSTICO DE INSUMO
                  </span>
                  <span className="text-neutral-400 text-[10px]">Cálculo puro centavo a centavo</span>
                </div>
                <p className="text-neutral-300 font-sans text-xs leading-relaxed">
                  "E se o quilo do filé mignon subir 15%?" — O motor percorre todas as 12 receitas e sub-receitas
                  que utilizam carne, calcula o impacto ponderado no CMV e diz quanto você precisa reajustar no preço final
                  ou qual queda de volume pode tolerar sem perder margem.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="bg-neutral-900 p-3.5 rounded-xl border border-neutral-800">
                    <div className="text-neutral-400 text-[10px]">Impacto no Custo Médio</div>
                    <div className="text-base font-bold text-rose-400 mt-1">+ R$ 1,42 / prato</div>
                  </div>
                  <div className="bg-neutral-900 p-3.5 rounded-xl border border-neutral-800">
                    <div className="text-neutral-400 text-[10px]">Reajuste Sugerido</div>
                    <div className="text-base font-bold text-orange-400 mt-1">R$ 54,00 → R$ 56,20</div>
                  </div>
                  <div className="bg-neutral-900 p-3.5 rounded-xl border border-neutral-800">
                    <div className="text-neutral-400 text-[10px]">Queda Tolerável de Volume</div>
                    <div className="text-base font-bold text-emerald-400 mt-1">- 4.8% das vendas</div>
                  </div>
                </div>
              </div>
            )}

            {showcaseTab === 'fefo' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
                  <span className="text-orange-400 font-bold uppercase tracking-wider text-[11px]">
                    F14 · CONTROLE POR LOTE & VENCIMENTO FEFO
                  </span>
                  <span className="text-neutral-400 text-[10px]">Auditoria contínua</span>
                </div>
                <p className="text-neutral-300 font-sans text-xs leading-relaxed">
                  Identifica excedentes antes do vencimento. O algoritmo cruza o estoque atual do lote com o consumo médio diário dos últimos 30 dias.
                </p>
                <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-800 flex items-center justify-between">
                  <div>
                    <div className="text-white font-bold">Lote Queijo Gouda Fracionado #882</div>
                    <div className="text-neutral-400 text-[11px] mt-0.5">Saldo: 8,4 kg · Validade: 04/11/2026</div>
                  </div>
                  <span className="px-3 py-1 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30 text-[11px] font-bold">
                    Promoção / Sugestão de Sugerida
                  </span>
                </div>
              </div>
            )}

            {showcaseTab === 'nfe' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
                  <span className="text-orange-400 font-bold uppercase tracking-wider text-[11px]">
                    F44 · PARSER DETERMINÍSTICO DE XML NF-e
                  </span>
                  <span className="text-emerald-400 text-[10px]">Validação XXE ativa</span>
                </div>
                <p className="text-neutral-300 font-sans text-xs leading-relaxed">
                  Sem OCR frágil e sem inteligência artificial aproximada. O arquivo XML oficial da SEFAZ é lido
                  diretamente e convertido para centavos inteiros com reconciliação de tributos.
                </p>
                <div className="bg-neutral-900 p-3.5 rounded-xl border border-neutral-800 space-y-2">
                  <div className="flex justify-between text-neutral-400 text-[11px]">
                    <span>Nota: #00049182 (Distribuidora Paulista Ltda)</span>
                    <span className="text-emerald-400">100% Mapeada</span>
                  </div>
                  <div className="text-white font-mono text-xs">
                    Entrada de 24x Caixas de Leite Integral 1L (Convertido para 24.000 ml · R$ 0,0052/ml)
                  </div>
                </div>
              </div>
            )}

            {showcaseTab === 'caixa' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
                  <span className="text-orange-400 font-bold uppercase tracking-wider text-[11px]">
                    F29 & F30 · FLUXO DE CAIXA EM 3 CENÁRIOS & RETIRADA SEGURA
                  </span>
                  <span className="text-neutral-400 text-[10px]">Horizonte de 30 dias</span>
                </div>
                <p className="text-neutral-300 font-sans text-xs leading-relaxed">
                  Projeta o menor saldo futuro com base nos recebíveis de cartão e prazos de fornecedores.
                  Você sabe o dia exato em que o caixa pode apertar com antecedência para tomar decisões.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="bg-neutral-900 p-3.5 rounded-xl border border-neutral-800">
                    <div className="text-neutral-400 text-[10px]">Menor Saldo Previsto (Cenário Base)</div>
                    <div className="text-base font-bold text-white mt-1">R$ 18.420,00 (em 18/11)</div>
                  </div>
                  <div className="bg-neutral-900 p-3.5 rounded-xl border border-neutral-800">
                    <div className="text-neutral-400 text-[10px]">Reserva de Imposto (Simples Nacional)</div>
                    <div className="text-base font-bold text-orange-400 mt-1">R$ 4.820,00 Provisionados</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* =========================================================================
          SEGURANÇA & ISOLAMENTO DE DADOS (Privacidade Absoluta)
         ========================================================================= */}
      <section className="py-20 bg-neutral-50/70 border-t border-neutral-200/80 relative z-10" id="seguranca">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto bg-white rounded-3xl border border-neutral-200 p-8 sm:p-12 shadow-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pb-8 border-b border-neutral-100">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-neutral-950 text-orange-500 flex items-center justify-center shrink-0">
                  <Lock className="w-6 h-6 stroke-[2]" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-neutral-950">
                    Privacidade Absoluta: Cada Dono, Cada Empresa
                  </h3>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Seus dados de faturamento, fichas técnicas e fornecedores nunca são expostos.
                  </p>
                </div>
              </div>

              <span className="px-3.5 py-1.5 rounded-full text-xs font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
                Criptografia SHA-256 Ativa
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-orange-600" />
                  <span>Senha Obrigatória</span>
                </h4>
                <p className="text-xs text-neutral-600 mt-2 leading-relaxed">
                  O acesso à sua empresa requer e-mail e senha validados criptograficamente. Não existem acessos sem senha.
                </p>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-900 flex items-center gap-1.5">
                  <Boxes className="w-4 h-4 text-orange-600" />
                  <span>Isolamento Total</span>
                </h4>
                <p className="text-xs text-neutral-600 mt-2 leading-relaxed">
                  Cada usuário cadastrado tem seu banco de dados privado. Nenhum outro gestor tem acesso ao seu cardápio.
                </p>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-900 flex items-center gap-1.5">
                  <Scale className="w-4 h-4 text-orange-600" />
                  <span>Exportação em 1 Toque</span>
                </h4>
                <p className="text-xs text-neutral-600 mt-2 leading-relaxed">
                  Seus dados são seus. Baixe um backup completo em JSON a qualquer momento em Ajustes com auditoria LGPD.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          FAQ ACCORDION (Perguntas Cruciais do Dono)
         ========================================================================= */}
      <section className="py-20 bg-white relative z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-neutral-500">
              Dúvidas Frequentes
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-neutral-950 tracking-tight mt-2">
              Perguntas diretas, respostas transparentes.
            </h2>
          </div>

          <div className="space-y-3">
            {[
              {
                q: 'Como a Mise garante que os cálculos nunca erram centavos?',
                a: 'Todos os valores monetários no sistema são gravados e computados em centavos inteiros (BigInt / integer cents). Em vez de usar divisões de ponto flutuante que geram resíduos como R$ 0,000000004, o motor utiliza bases exatas em microcentavos e pontos-base, eliminando 100% dos erros de arredondamento.',
              },
              {
                q: 'Como funciona a privacidade de dados entre diferentes donos?',
                a: 'Cada conta possui uma empresa privada com chave exclusiva no armazenamento criptografado. O login exige e-mail e senha validados por SHA-256 com salt. Ninguém consegue visualizar dados ou trocar de perfil sem a senha correta.',
              },
              {
                q: 'Eu preciso substituir meu PDV de caixa atual para usar a Mise?',
                a: 'Não! A Mise não é um PDV de frente de caixa e não concorre com seu sistema de atendimento. A Mise é a inteligência de retaguarda: você importa as vendas do seu iFood ou PDV atual e as notas fiscais dos fornecedores, e o sistema faz toda a engenharia de cardápio e estoque.',
              },
              {
                q: 'Quanto tempo leva para cadastrar os primeiros insumos e fichas técnicas?',
                a: 'Menos de 10 minutos. Ao importar sua primeira nota fiscal eletrônica (XML), o sistema já cadastra os insumos com os preços reais pagos. Você também pode inicializar com o catálogo calibrado de exemplo.',
              },
            ].map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={idx}
                  className="bg-neutral-50 border border-neutral-200 rounded-2xl overflow-hidden transition-all"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full flex items-center justify-between p-5 text-left text-xs font-bold text-neutral-900 cursor-pointer hover:bg-neutral-100/60 transition-colors"
                  >
                    <span>{faq.q}</span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-neutral-500 shrink-0 ml-2" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-neutral-500 shrink-0 ml-2" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 pt-1 text-xs text-neutral-600 leading-relaxed border-t border-neutral-200/50">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =========================================================================
          BANNER FINAL DE CONVERSÃO (Preto Minimalista com Acento Laranja)
         ========================================================================= */}
      <section className="py-20 bg-neutral-950 text-white relative z-10 border-t border-neutral-900">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-orange-400 mb-4 font-mono">
            <span>Comece Hoje Mesmo</span>
            <span aria-hidden="true">·</span>
            <span>Sem Cartão de Crédito</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight text-balance">
            Pronto para colocar o controle da sua cozinha em outro patamar?
          </h2>

          <p className="mt-5 text-neutral-400 text-sm sm:text-base max-w-2xl mx-auto text-balance">
            Crie sua conta em 30 segundos, defina sua senha exclusiva e tenha acesso imediato a todas as fórmulas
            de engenharia de cardápio, estoques FEFO e fluxo de caixa da Mise.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <button
              type="button"
              onClick={() => openAuth('register')}
              className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl text-sm font-bold text-neutral-950 bg-orange-500 hover:bg-orange-400 transition-all shadow-lg hover:shadow-orange-500/20 cursor-pointer group"
            >
              <span>Cadastrar Minha Empresa Agora</span>
              <ArrowRight className="w-4 h-4 text-neutral-950 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              type="button"
              onClick={() => openAuth('login')}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-7 py-4 rounded-xl text-sm font-bold text-white bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 transition-all cursor-pointer"
            >
              <LogIn className="w-4 h-4 text-orange-400" />
              <span>Já Tenho Conta (Entrar)</span>
            </button>
          </div>
        </div>
      </section>

      {/* =========================================================================
          RODAPÉ MINIMALISTA (Quiet Footer)
         ========================================================================= */}
      <footer className="py-8 bg-neutral-950 border-t border-neutral-900/80 text-xs text-neutral-500 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-white text-sm">Mise</span>
            <span className="w-1 h-1 rounded-full bg-orange-500" />
            <span>Gestão para Comércio Alimentício & Engenharia de Margem</span>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-neutral-400">
            <span>Matemática Pura em Centavos (BigInt)</span>
            <span aria-hidden="true">·</span>
            <span>Aviso fiscal: confirme parâmetros com seu contador</span>
            <span aria-hidden="true">·</span>
            <span>© 2026 Mise</span>
          </div>
        </div>
      </footer>

      {/* Modal de Autenticação Segura */}
      <AuthModal
        isOpen={authModalOpen}
        initialMode={authMode}
        onClose={() => setAuthModalOpen(false)}
        database={database}
        onAuthSuccess={onLoginSuccess}
      />
    </div>
  );
};
