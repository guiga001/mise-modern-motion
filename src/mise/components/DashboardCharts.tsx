/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — Gráficos Nativos SVG de Alta Precisão (Sem dependências externas frágeis)
 * 3 Tipos: 
 * 1. Gráfico de Barras: Faturamento vs Custo de Insumos (CMV) vs Lucro
 * 2. Gráfico de Linha/Área: Evolução Diária do Saldo de Caixa
 * 3. Gráfico de Rosca (Donut): Composição e Destino de Cada Real Gasto
 */

import React, { useState } from 'react';
import { formatCentsToCurrency } from '../domain/units';

// ============================================================================
// 1. GRÁFICO DE BARRAS: FATURAMENTO vs CUSTO DE INSUMOS vs LUCRO
// ============================================================================

export interface DailyBarData {
  dateLabel: string;
  grossRevenueInCents: number;
  cmvInCents: number;
  netProfitInCents: number;
}

interface BarChartProps {
  data: DailyBarData[];
}

export const BarChartRevenueVsCost: React.FC<BarChartProps> = ({ data }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-stone-400 text-xs">
        <p>Nenhuma movimentação neste período para exibir o gráfico de barras.</p>
      </div>
    );
  }

  // Encontrar o maior valor para escalar o eixo Y
  const maxVal = Math.max(
    100,
    ...data.flatMap(d => [d.grossRevenueInCents, d.cmvInCents, Math.max(0, d.netProfitInCents)])
  );

  const chartHeight = 180;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between text-xs text-stone-600 gap-2">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-emerald-600 inline-block" />
            <span className="font-medium text-stone-700">Faturamento</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-amber-500 inline-block" />
            <span className="font-medium text-stone-700">Custo Insumos (CMV)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-stone-900 inline-block" />
            <span className="font-medium text-stone-700">Lucro</span>
          </div>
        </div>
        <span className="text-[11px] text-stone-400 font-mono">Valores em R$</span>
      </div>

      <div className="relative pt-6">
        {/* Tooltip flutuante */}
        {hoveredIdx !== null && data[hoveredIdx] && (
          <div className="absolute top-0 right-4 z-10 bg-stone-900 text-white p-2.5 rounded-lg text-[11px] shadow-lg pointer-events-none flex items-center gap-3">
            <span className="font-bold text-amber-300">{data[hoveredIdx].dateLabel}:</span>
            <span>Faturamento: {formatCentsToCurrency(data[hoveredIdx].grossRevenueInCents)}</span>
            <span>CMV: {formatCentsToCurrency(data[hoveredIdx].cmvInCents)}</span>
            <span className={data[hoveredIdx].netProfitInCents >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
              Lucro: {formatCentsToCurrency(data[hoveredIdx].netProfitInCents)}
            </span>
          </div>
        )}

        <div className="flex items-end gap-2 sm:gap-4 h-48 border-b border-stone-200 px-2">
          {data.map((item, idx) => {
            const revHeight = Math.max(4, (item.grossRevenueInCents / maxVal) * chartHeight);
            const cmvHeight = Math.max(4, (item.cmvInCents / maxVal) * chartHeight);
            const profitHeight = Math.max(4, (Math.max(0, item.netProfitInCents) / maxVal) * chartHeight);

            const isHovered = hoveredIdx === idx;

            return (
              <div
                key={idx}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer"
              >
                <div className={`flex items-end gap-1 w-full justify-center transition-transform ${isHovered ? 'scale-105' : ''}`}>
                  {/* Barra Faturamento */}
                  <div
                    style={{ height: `${revHeight}px` }}
                    className="w-2.5 sm:w-4 bg-emerald-600 rounded-t-xs hover:bg-emerald-500 transition-all"
                    title={`Faturamento: ${formatCentsToCurrency(item.grossRevenueInCents)}`}
                  />
                  {/* Barra CMV */}
                  <div
                    style={{ height: `${cmvHeight}px` }}
                    className="w-2.5 sm:w-4 bg-amber-500 rounded-t-xs hover:bg-amber-400 transition-all"
                    title={`CMV: ${formatCentsToCurrency(item.cmvInCents)}`}
                  />
                  {/* Barra Lucro */}
                  <div
                    style={{ height: `${profitHeight}px` }}
                    className="w-2.5 sm:w-4 bg-stone-900 rounded-t-xs hover:bg-stone-700 transition-all"
                    title={`Lucro: ${formatCentsToCurrency(item.netProfitInCents)}`}
                  />
                </div>
                <span className="text-[10px] text-stone-500 font-mono mt-2 truncate w-full text-center">
                  {item.dateLabel}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 2. GRÁFICO DE LINHA / ÁREA: EVOLUÇÃO CONTÍNUA DO FLUXO DE CAIXA
// ============================================================================

export interface DailyLineData {
  dateLabel: string;
  balanceInCents: number;
}

interface LineChartProps {
  data: DailyLineData[];
}

export const LineChartCashFlow: React.FC<LineChartProps> = ({ data }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (data.length < 2) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-stone-400 text-xs">
        <p>Dados insuficientes para desenhar a curva temporal (mínimo de 2 dias necessários).</p>
      </div>
    );
  }

  const values = data.map(d => d.balanceInCents);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = (maxVal - minVal) === 0 ? 1 : maxVal - minVal;

  const width = 600;
  const height = 180;
  const paddingX = 30;
  const paddingY = 25;

  const points = data.map((d, i) => {
    const x = paddingX + (i / (data.length - 1)) * (width - 2 * paddingX);
    const y = height - paddingY - ((d.balanceInCents - minVal) / range) * (height - 2 * paddingY);
    return { x, y, data: d };
  });

  const pathD = points.reduce((acc, p, i) => {
    return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
  }, '');

  // Área fechada para o gradiente
  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - paddingY} L ${points[0].x} ${height - paddingY} Z`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs text-stone-600">
        <div className="flex items-center gap-2">
          <span className="w-3 h-0.5 bg-emerald-600 inline-block" />
          <span className="font-semibold text-stone-800">Saldo Acumulado do Caixa</span>
        </div>
        {hoveredIdx !== null && (
          <div className="text-xs font-mono font-bold text-stone-900 bg-stone-100 px-2.5 py-1 rounded-md">
            {data[hoveredIdx].dateLabel}: {formatCentsToCurrency(data[hoveredIdx].balanceInCents)}
          </div>
        )}
      </div>

      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-48 overflow-visible"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="cashGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#059669" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#059669" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Linhas de grade horizontais */}
          <line
            x1={paddingX}
            y1={height - paddingY}
            x2={width - paddingX}
            y2={height - paddingY}
            stroke="#e7e5e4"
            strokeWidth="1"
          />
          <line
            x1={paddingX}
            y1={paddingY}
            x2={width - paddingX}
            y2={paddingY}
            stroke="#e7e5e4"
            strokeDasharray="3 3"
            strokeWidth="1"
          />

          {/* Área preenchida */}
          <path d={areaD} fill="url(#cashGradient)" />

          {/* Linha principal */}
          <path
            d={pathD}
            fill="none"
            stroke="#059669"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Pontos interativos */}
          {points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={hoveredIdx === i ? 6 : 3.5}
              className="fill-white stroke-emerald-700 stroke-2 cursor-pointer transition-all"
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            />
          ))}
        </svg>

        {/* Labels do eixo X */}
        <div className="flex justify-between text-[10px] text-stone-400 font-mono px-6 mt-1">
          <span>{data[0]?.dateLabel}</span>
          {data.length > 2 && <span>{data[Math.floor(data.length / 2)]?.dateLabel}</span>}
          <span>{data[data.length - 1]?.dateLabel}</span>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 3. GRÁFICO DE ROSCA (DONUT): DESTINO DO DINHEIRO & DISTRIBUIÇÃO DE CUSTOS
// ============================================================================

export interface DonutSegment {
  label: string;
  amountInCents: number;
  color: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  totalRevenueInCents: number;
}

export const DonutChartExpensesBreakdown: React.FC<DonutChartProps> = ({
  segments,
  totalRevenueInCents,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const activeSegments = segments.filter(s => s.amountInCents > 0);
  const totalAmount = activeSegments.reduce((acc, curr) => acc + curr.amountInCents, 0);

  if (totalAmount === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-stone-400 text-xs">
        <p>Nenhuma despesa ou custo lançado neste período.</p>
      </div>
    );
  }

  // Raio e centro do círculo SVG
  const size = 180;
  const strokeWidth = 26;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let accumulatedPercent = 0;

  return (
    <div className="flex flex-col md:flex-row items-center gap-6 justify-between">
      {/* SVG Donut */}
      <div className="relative w-44 h-44 flex-shrink-0 flex items-center justify-center">
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full -rotate-90">
          {activeSegments.map((seg, idx) => {
            const percent = seg.amountInCents / totalAmount;
            const strokeDasharray = `${percent * circumference} ${circumference}`;
            const strokeDashoffset = -(accumulatedPercent * circumference);
            accumulatedPercent += percent;

            const isHovered = hoveredIdx === idx;

            return (
              <circle
                key={idx}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke={seg.color}
                strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-150 cursor-pointer"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
            );
          })}
        </svg>

        {/* Centro da Rosca */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
          <span className="text-[10px] text-stone-500 font-semibold uppercase tracking-wider">
            Total Saídas
          </span>
          <span className="text-xs font-bold font-mono text-stone-900 mt-0.5">
            {formatCentsToCurrency(totalAmount)}
          </span>
        </div>
      </div>

      {/* Legenda detalhada */}
      <div className="flex-1 w-full space-y-2">
        {activeSegments.map((seg, idx) => {
          const pct = ((seg.amountInCents / totalAmount) * 100).toFixed(1);
          const isHovered = hoveredIdx === idx;

          return (
            <div
              key={idx}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              className={`flex items-center justify-between text-xs p-1.5 rounded-lg transition-colors cursor-pointer ${
                isHovered ? 'bg-stone-100 font-bold' : 'hover:bg-stone-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: seg.color }}
                />
                <span className="text-stone-800">{seg.label}</span>
              </div>
              <div className="flex items-center gap-3 font-mono">
                <span className="text-stone-900 font-semibold">{formatCentsToCurrency(seg.amountInCents)}</span>
                <span className="text-stone-500 text-[11px] w-12 text-right">{pct}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
