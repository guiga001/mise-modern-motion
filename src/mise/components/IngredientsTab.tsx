/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — Gestão de Insumos, Embalagens e Fornecedores
 * Invariante: Unidade base canônica (g, ml, un) com custo unitário exato.
 */

import React, { useState } from 'react';
import { Boxes, Plus, Search, Tag, Truck, Edit3, Trash2 } from 'lucide-react';
import { Ingredient, IngredientPackaging, BaseUnit, Supplier } from '../domain/types';
import { formatBaseQuantity, formatCentsToCurrency, parseCurrencyToCents } from '../domain/units';
import { MiseDatabaseState, saveDatabase, appendAuditLog } from '../lib/storage';
import { Modal } from './Modal';
import { EmptyState } from './EmptyState';

interface IngredientsTabProps {
  database: MiseDatabaseState;
  onUpdateDatabase: (newState: MiseDatabaseState) => void;
}

export const IngredientsTab: React.FC<IngredientsTabProps> = ({ database, onUpdateDatabase }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Geral');
  const [baseUnit, setBaseUnit] = useState<BaseUnit>('g');
  const [minimumStock, setMinimumStock] = useState('1000');
  const [supplierId, setSupplierId] = useState('');

  // Embalagem comercial de compra
  const [packagingName, setPackagingName] = useState('Saco / Caixa Padrão');
  const [packagingQtyInBase, setPackagingQtyInBase] = useState('1000'); // 1kg = 1000g
  const [packagingCostStr, setPackagingCostStr] = useState('10,00');

  const categories = Array.from(new Set(database.ingredients.map(i => i.category || 'Geral')));

  const openCreateModal = () => {
    setEditingIngredient(null);
    setName('');
    setCategory('Geral');
    setBaseUnit('g');
    setMinimumStock('1000');
    setSupplierId('');
    setPackagingName('Pacote / Caixa');
    setPackagingQtyInBase('1000');
    setPackagingCostStr('25,00');
    setIsModalOpen(true);
  };

  const openEditModal = (ing: Ingredient) => {
    setEditingIngredient(ing);
    setName(ing.name);
    setCategory(ing.category);
    setBaseUnit(ing.baseUnit);
    setMinimumStock(ing.minimumStockInBaseUnit.toString());
    setSupplierId(ing.preferredSupplierId || '');

    if (ing.packagings.length > 0) {
      const p = ing.packagings[0];
      setPackagingName(p.packagingName);
      setPackagingQtyInBase(p.quantityInBaseUnit.toString());
      setPackagingCostStr((p.costInCents / 100).toFixed(2).replace('.', ','));
    } else {
      setPackagingName('Pacote Padrão');
      setPackagingQtyInBase('1000');
      setPackagingCostStr('10,00');
    }
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const packQty = Math.max(1, parseFloat(packagingQtyInBase) || 1);
    const packCostInCents = parseCurrencyToCents(packagingCostStr);
    // Custo em microcentavos: (Custo em centavos * 10.000) / Quantidade Base
    const unitCostMicrocents = Math.round((packCostInCents * 10000) / packQty);

    const packaging: IngredientPackaging = {
      id: `pack_${Date.now()}`,
      packagingName: packagingName.trim() || 'Embalagem Comercial',
      quantityInBaseUnit: packQty,
      costInCents: packCostInCents,
    };

    let updatedIngredients: Ingredient[];
    let action = '';

    if (editingIngredient) {
      action = 'EDIT_INGREDIENT';
      updatedIngredients = database.ingredients.map(ing => {
        if (ing.id === editingIngredient.id) {
          return {
            ...ing,
            name: name.trim(),
            category: category.trim(),
            baseUnit,
            minimumStockInBaseUnit: parseFloat(minimumStock) || 0,
            currentUnitCostMicrocents: unitCostMicrocents,
            preferredSupplierId: supplierId || undefined,
            packagings: [packaging],
            updatedAt: new Date().toISOString(),
          };
        }
        return ing;
      });
    } else {
      action = 'CREATE_INGREDIENT';
      const newIng: Ingredient = {
        id: `ing_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: name.trim(),
        category: category.trim(),
        baseUnit,
        minimumStockInBaseUnit: parseFloat(minimumStock) || 0,
        currentUnitCostMicrocents: unitCostMicrocents,
        preferredSupplierId: supplierId || undefined,
        packagings: [packaging],
        updatedAt: new Date().toISOString(),
      };
      updatedIngredients = [...database.ingredients, newIng];
    }

    const stateWithIngredients = {
      ...database,
      ingredients: updatedIngredients,
    };

    const newState = appendAuditLog(
      stateWithIngredients,
      action,
      'Ingredient',
      editingIngredient ? editingIngredient.id : 'NEW',
      `Insumo '${name}' salvo com custo unitário de ${(unitCostMicrocents / 10000).toFixed(4)} centavos por ${baseUnit}.`
    );

    onUpdateDatabase(newState);
    setIsModalOpen(false);
  };

  const filteredIngredients = database.ingredients.filter(ing => {
    const matchesSearch = ing.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ing.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'ALL' || ing.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-stone-900 tracking-tight">
            Catálogo de Insumos & Matérias-Primas
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Padronize compras em embalagens comerciais e converta para unidades-base ({database.ingredients.length} cadastrados).
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-lg transition-colors cursor-pointer shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Insumo</span>
        </button>
      </div>

      {database.ingredients.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="Nenhum insumo cadastrado"
          description="Os insumos são as matérias-primas que compõem suas fichas técnicas (ex: Queijo Mussarela, Farinha de Trigo, Filé Mignon, Óleo). Cadastre o primeiro para desbloquear o cálculo de CMV."
          actionLabel="Cadastrar Primeiro Insumo"
          onAction={openCreateModal}
        />
      ) : (
        <div className="space-y-4">
          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar insumo por nome ou categoria..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 text-xs rounded-lg border border-stone-200 bg-white focus:outline-none focus:ring-1 focus:ring-stone-900"
              />
            </div>
            {categories.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                <button
                  onClick={() => setSelectedCategory('ALL')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                    selectedCategory === 'ALL'
                      ? 'bg-stone-900 text-white'
                      : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  Todas
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                      selectedCategory === cat
                        ? 'bg-stone-900 text-white'
                        : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-stone-200/80 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50/60 text-stone-500 font-semibold">
                    <th className="py-3 px-4">Insumo</th>
                    <th className="py-3 px-4">Unidade-Base</th>
                    <th className="py-3 px-4">Embalagem Padrão</th>
                    <th className="py-3 px-4 text-right">Custo Base (Micro)</th>
                    <th className="py-3 px-4 text-right">Custo Ref. (kg / L)</th>
                    <th className="py-3 px-4 text-right">Estoque Mínimo</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredIngredients.map((ing) => {
                    const pack = ing.packagings[0];
                    // Custo por kg ou por L
                    const costRef = (ing.currentUnitCostMicrocents * 1000) / 10000;

                    return (
                      <tr key={ing.id} className="hover:bg-stone-50/60 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-stone-900">{ing.name}</div>
                          <div className="text-[11px] text-stone-500">{ing.category}</div>
                        </td>
                        <td className="py-3 px-4 font-mono font-medium text-stone-700">
                          {ing.baseUnit}
                        </td>
                        <td className="py-3 px-4 text-stone-600">
                          {pack ? (
                            <span>
                              {pack.packagingName} ({formatBaseQuantity(pack.quantityInBaseUnit, ing.baseUnit)}) = {formatCentsToCurrency(pack.costInCents)}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-stone-600">
                          {(ing.currentUnitCostMicrocents / 10000).toFixed(4)} R$/{ing.baseUnit}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-stone-900">
                          {ing.baseUnit === 'un'
                            ? formatCentsToCurrency(Math.round(ing.currentUnitCostMicrocents / 100))
                            : `${formatCentsToCurrency(Math.round(costRef))} / ${ing.baseUnit === 'g' ? 'kg' : 'L'}`}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-stone-600">
                          {formatBaseQuantity(ing.minimumStockInBaseUnit, ing.baseUnit)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => openEditModal(ing)}
                            className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-md transition-colors cursor-pointer"
                            title="Editar insumo"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cadastro/Edição */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingIngredient ? 'Editar Insumo' : 'Novo Insumo'}
        subtitle="Defina o nome, unidade base e custo através da embalagem de compra."
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Nome do Insumo *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Queijo Mussarela Peça"
                className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Categoria
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Ex: Laticínios, Carnes, Hortifrúti"
                className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Unidade Base Canônica *
              </label>
              <select
                value={baseUnit}
                onChange={(e) => setBaseUnit(e.target.value as BaseUnit)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 bg-white focus:outline-none focus:ring-1 focus:ring-stone-900"
              >
                <option value="g">Gramas (g) — para sólidos/massa</option>
                <option value="ml">Mililitros (ml) — para líquidos</option>
                <option value="un">Unidade (un) — para ovos, pães, etc.</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Estoque Mínimo (em {baseUnit})
              </label>
              <input
                type="number"
                value={minimumStock}
                onChange={(e) => setMinimumStock(e.target.value)}
                placeholder="Ex: 5000"
                className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-900"
              />
            </div>
          </div>

          {/* Embalagem Comercial de Compra */}
          <div className="p-4 bg-stone-50 rounded-xl border border-stone-200/80 space-y-3">
            <span className="text-xs font-bold text-stone-900">Embalagem Comercial de Compra</span>
            <p className="text-[11px] text-stone-500">
              O Mise calcula o custo unitário automaticamente a partir de como você compra no atacado.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-stone-600 mb-1">
                  Nome da Embalagem
                </label>
                <input
                  type="text"
                  value={packagingName}
                  onChange={(e) => setPackagingName(e.target.value)}
                  placeholder="Ex: Peça 4kg, Caixa 12x1L"
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white focus:outline-none focus:ring-1 focus:ring-stone-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-stone-600 mb-1">
                  Conteúdo Total ({baseUnit})
                </label>
                <input
                  type="number"
                  value={packagingQtyInBase}
                  onChange={(e) => setPackagingQtyInBase(e.target.value)}
                  placeholder="Ex: 4000"
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white focus:outline-none focus:ring-1 focus:ring-stone-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-stone-600 mb-1">
                  Preço Pago (R$)
                </label>
                <input
                  type="text"
                  value={packagingCostStr}
                  onChange={(e) => setPackagingCostStr(e.target.value)}
                  placeholder="Ex: 140,00"
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white focus:outline-none focus:ring-1 focus:ring-stone-900"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              Salvar Insumo
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
