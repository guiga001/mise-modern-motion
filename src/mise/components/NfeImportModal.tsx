/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — F44: Importador Seguro de XML de NF-e (Modelo 55 / 65)
 */

import React, { useState } from 'react';
import { FileCode, Upload, ShieldCheck, CheckCircle2, AlertTriangle, ArrowRight, Package } from 'lucide-react';
import { parseNfeXml, NfeParsedDocument } from '../domain/nfe-parser';
import { formatCentsToCurrency } from '../domain/units';
import { MiseDatabaseState } from '../lib/storage';
import { Ingredient, StockMovement, Supplier } from '../domain/types';
import { Modal } from './Modal';

interface NfeImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  database: MiseDatabaseState;
  onImportSuccess: (newState: MiseDatabaseState) => void;
}

export const NfeImportModal: React.FC<NfeImportModalProps> = ({
  isOpen,
  onClose,
  database,
  onImportSuccess,
}) => {
  const [xmlContent, setXmlContent] = useState('');
  const [parsedDoc, setParsedDoc] = useState<NfeParsedDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Mapeamento de cada item da NF para um insumo existente
  const [itemMapping, setItemMapping] = useState<Record<number, string>>({});

  const handleParse = (content: string) => {
    setError(null);
    setSuccessMessage(null);
    try {
      const doc = parseNfeXml(content);

      // Verificar deduplicação pela chave de 44 dígitos
      const alreadyImported = database.stockMovements.some(
        (m) => m.referenceId === doc.accessKey || m.reason?.includes(doc.accessKey)
      );

      if (alreadyImported) {
        setError(`Atenção: A NF-e com Chave de Acesso "${doc.accessKey}" já foi recebida anteriormente no estoque.`);
        return;
      }

      setParsedDoc(doc);

      // Auto-vincular insumos pelo nome similar se existir
      const initialMap: Record<number, string> = {};
      doc.items.forEach((item) => {
        const found = database.ingredients.find(
          (ing) => ing.name.toLowerCase().includes(item.description.toLowerCase().slice(0, 10))
        );
        if (found) {
          initialMap[item.itemIndex] = found.id;
        }
      });
      setItemMapping(initialMap);
    } catch (e: any) {
      setError(e.message || 'Erro ao processar o arquivo XML.');
      setParsedDoc(null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setXmlContent(text);
      handleParse(text);
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = () => {
    if (!parsedDoc) return;

    const targetStoreId = database.activeStoreId === 'CONSOLIDATED'
      ? database.stores[0]?.id || 'default_store'
      : database.activeStoreId;

    let updatedIngredients = [...database.ingredients];
    let updatedSuppliers = [...database.suppliers];
    const newMovements: StockMovement[] = [];

    // 1. Cadastrar ou localizar fornecedor
    let supplier = updatedSuppliers.find(
      (s) => s.cnpjOrCpf === parsedDoc.supplier.cnpj || s.name.toLowerCase() === parsedDoc.supplier.corporateName.toLowerCase()
    );

    if (!supplier) {
      supplier = {
        id: `sup_${Date.now()}`,
        name: parsedDoc.supplier.corporateName,
        cnpjOrCpf: parsedDoc.supplier.cnpj,
        phone: parsedDoc.supplier.phone,
      };
      updatedSuppliers.push(supplier);
    }

    // 2. Processar itens
    for (const item of parsedDoc.items) {
      let mappedIngId = itemMapping[item.itemIndex];
      let ingredient = updatedIngredients.find((i) => i.id === mappedIngId);

      // Se não mapeado para existente, cadastrar novo insumo automaticamente
      if (!ingredient) {
        const baseUnit = item.commercialUnit === 'kg' ? 'g' : (item.commercialUnit === 'l' ? 'ml' : 'un');
        const qtyInBase = baseUnit === 'g' ? item.quantity * 1000 : (baseUnit === 'ml' ? item.quantity * 1000 : item.quantity);
        const costPerBaseMicrocents = Math.round((item.totalPriceInCents * 10000) / qtyInBase);

        ingredient = {
          id: `ing_${Date.now()}_${item.itemIndex}`,
          name: item.description,
          category: 'Compras XML',
          baseUnit,
          currentUnitCostMicrocents: costPerBaseMicrocents,
          minimumStockInBaseUnit: 0,
          packagings: [],
          preferredSupplierId: supplier.id,
          updatedAt: new Date().toISOString(),
        };
        updatedIngredients.push(ingredient);
      } else {
        // Atualizar custo unitário
        const baseUnit = ingredient.baseUnit;
        const qtyInBase = baseUnit === 'g' && item.commercialUnit === 'kg'
          ? item.quantity * 1000
          : (baseUnit === 'ml' && item.commercialUnit === 'l' ? item.quantity * 1000 : item.quantity);
        const newCostMicrocents = Math.round((item.totalPriceInCents * 10000) / qtyInBase);

        updatedIngredients = updatedIngredients.map((i) =>
          i.id === ingredient!.id
            ? { ...i, currentUnitCostMicrocents: newCostMicrocents, updatedAt: new Date().toISOString() }
            : i
        );
      }

      // 3. Gerar movimentação de entrada no estoque
      const qtyInBase = ingredient.baseUnit === 'g' && item.commercialUnit === 'kg'
        ? item.quantity * 1000
        : (ingredient.baseUnit === 'ml' && item.commercialUnit === 'l' ? item.quantity * 1000 : item.quantity);

      newMovements.push({
        id: `mov_${Date.now()}_${item.itemIndex}`,
        storeId: targetStoreId,
        ingredientId: ingredient.id,
        type: 'PURCHASE_RECEIPT',
        quantityInBaseUnit: qtyInBase,
        unitCostMicrocents: ingredient.currentUnitCostMicrocents,
        totalCostInCents: item.totalPriceInCents,
        reason: `NF-e ${parsedDoc.invoiceNumber} - ${parsedDoc.supplier.corporateName} (Chave: ${parsedDoc.accessKey})`,
        referenceId: parsedDoc.accessKey,
        createdAt: new Date().toISOString(),
        createdBy: database.activeUserId || 'dono',
      });
    }

    const newState: MiseDatabaseState = {
      ...database,
      ingredients: updatedIngredients,
      suppliers: updatedSuppliers,
      stockMovements: [...database.stockMovements, ...newMovements],
      auditLogs: [
        ...database.auditLogs,
        {
          id: `aud_${Date.now()}`,
          action: 'IMPORT_NFE_XML',
          entityType: 'StockMovement',
          entityId: parsedDoc.accessKey,
          userId: database.activeUserId || 'dono',
          userName: 'Dono/Gestor',
          details: `Importada NF-e nº ${parsedDoc.invoiceNumber} do fornecedor ${parsedDoc.supplier.corporateName}. ${parsedDoc.items.length} itens recebidos no estoque.`,
          timestamp: new Date().toISOString(),
        },
      ],
    };

    onImportSuccess(newState);
    setSuccessMessage(`NF-e nº ${parsedDoc.invoiceNumber} recebida com sucesso! ${parsedDoc.items.length} itens lançados no estoque.`);
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Importação de XML de NF-e (F44)" maxWidth="2xl">
      <div className="space-y-4">
        {/* Upload Box */}
        {!parsedDoc ? (
          <div className="space-y-3">
            <div className="border-2 border-dashed border-stone-300 rounded-xl p-6 text-center hover:bg-stone-50 transition-colors">
              <FileCode className="w-10 h-10 text-stone-400 mx-auto mb-2" />
              <label className="cursor-pointer">
                <span className="text-sm font-semibold text-stone-900 hover:underline">
                  Clique para selecionar o XML da NF-e
                </span>
                <input
                  type="file"
                  accept=".xml,text/xml"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              <p className="text-xs text-stone-500 mt-1">
                Compatível com Nota Fiscal Eletrônica Modelo 55 e NFC-e 65 (SEFAZ).
              </p>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-stone-500 bg-stone-50 p-2.5 rounded-lg border border-stone-200">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Parser Seguro com proteção nativa contra injeções XXE, validação de schema e deduplicação estrita pela Chave de Acesso.
              </span>
            </div>
          </div>
        ) : (
          /* Pré-visualização da Nota */
          <div className="space-y-4">
            <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-stone-900">
                  NF-e nº {parsedDoc.invoiceNumber} (Série {parsedDoc.series})
                </span>
                <span className="font-mono font-bold text-emerald-700">
                  Total: {formatCentsToCurrency(parsedDoc.totalInvoiceInCents)}
                </span>
              </div>
              <p className="text-stone-600">
                Fornecedor: <strong>{parsedDoc.supplier.corporateName}</strong> (CNPJ: {parsedDoc.supplier.cnpj || 'N/A'})
              </p>
              <p className="text-[10px] font-mono text-stone-400 truncate">
                Chave: {parsedDoc.accessKey}
              </p>
            </div>

            {/* Itens da Nota */}
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-stone-500 block mb-1.5">
                Itens na Nota ({parsedDoc.items.length})
              </span>
              <div className="max-h-60 overflow-y-auto divide-y divide-stone-100 border border-stone-200 rounded-xl">
                {parsedDoc.items.map((item) => (
                  <div key={item.itemIndex} className="p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-stone-50">
                    <div>
                      <span className="font-semibold text-stone-900 block">{item.description}</span>
                      <span className="text-[11px] text-stone-500">
                        {item.quantity} {item.commercialUnit} · {formatCentsToCurrency(item.unitPriceInCents)}/{item.commercialUnit}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <select
                        value={itemMapping[item.itemIndex] || ''}
                        onChange={(e) => setItemMapping({ ...itemMapping, [item.itemIndex]: e.target.value })}
                        className="text-[11px] border border-stone-300 rounded p-1 bg-white font-medium max-w-44"
                      >
                        <option value="">+ Criar novo insumo</option>
                        {database.ingredients.map((ing) => (
                          <option key={ing.id} value={ing.id}>
                            Vincular a: {ing.name} ({ing.baseUnit})
                          </option>
                        ))}
                      </select>
                      <span className="font-mono font-bold text-stone-900 shrink-0">
                        {formatCentsToCurrency(item.totalPriceInCents)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setParsedDoc(null)}
                className="px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-100 rounded-lg cursor-pointer"
              >
                Voltar / Outro XML
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-medium rounded-lg cursor-pointer transition-colors shadow-xs"
              >
                Confirmar e Dar Entrada no Estoque
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}
      </div>
    </Modal>
  );
};
