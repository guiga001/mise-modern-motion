/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise Atendimento — Gerenciador de Respostas Rápidas
 * Atalhos padronizados para agilidade no atendimento de pedidos e dúvidas.
 */

import React, { useState } from 'react';
import { X, Plus, Trash2, Edit2, Zap, Tag, Check, Copy } from 'lucide-react';
import { QuickReply } from '../domain/atendimento-types';
import { atendimentoApi } from '../lib/atendimento-api';

interface QuickRepliesModalProps {
  companyId: string;
  quickReplies: QuickReply[];
  isOpen: boolean;
  onClose: () => void;
  onReload: () => void;
  onSelectReply?: (text: string) => void;
}

export const QuickRepliesModal: React.FC<QuickRepliesModalProps> = ({
  companyId,
  quickReplies,
  isOpen,
  onClose,
  onReload,
  onSelectReply,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('TODAS');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [shortcut, setShortcut] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Geral');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const categories = ['TODAS', ...Array.from(new Set(quickReplies.map((q) => q.category || 'Geral')))];

  const filtered = activeCategory === 'TODAS'
    ? quickReplies
    : quickReplies.filter((q) => (q.category || 'Geral') === activeCategory);

  const startEdit = (reply?: QuickReply) => {
    setErrorMsg(null);
    if (reply) {
      setEditingId(reply.id);
      setShortcut(reply.shortcut);
      setTitle(reply.title);
      setCategory(reply.category || 'Geral');
      setContent(reply.content);
    } else {
      setEditingId(null);
      setShortcut('');
      setTitle('');
      setCategory('Geral');
      setContent('');
    }
    setIsEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    setLoading(true);
    setErrorMsg(null);
    try {
      await atendimentoApi.saveQuickReply(companyId, {
        id: editingId || undefined,
        shortcut: shortcut.replace(/^\//, '').trim(),
        title: title.trim(),
        category: category.trim(),
        content: content.trim(),
      });
      setIsEditing(false);
      onReload();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao salvar resposta rápida.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setErrorMsg(null);
    try {
      await atendimentoApi.deleteQuickReply(companyId, id);
      onReload();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao excluir resposta rápida.');
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-stone-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-stone-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900">Respostas Rápidas</h2>
              <p className="text-xs text-stone-500">
                Responda com agilidade dúvidas frequentes, cardápio e chave PIX
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {isEditing ? (
            <form onSubmit={handleSave} className="space-y-4 bg-stone-50 p-4 rounded-xl border border-stone-200">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-stone-900">
                  {editingId ? 'Editar Resposta Rápida' : 'Nova Resposta Rápida'}
                </span>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="text-xs text-stone-500 hover:text-stone-800"
                >
                  Cancelar
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Atalho (sem a barra)
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-2 text-stone-400 text-xs font-mono">/</span>
                    <input
                      type="text"
                      value={shortcut}
                      onChange={(e) => setShortcut(e.target.value)}
                      placeholder="cardapio"
                      className="w-full pl-6 pr-3 py-1.5 text-xs bg-white rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-orange-500 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Categoria
                  </label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Cardápio, Boas-vindas, PIX..."
                    className="w-full px-3 py-1.5 text-xs bg-white rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Título identificador
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Enviar Cardápio em PDF / Chave PIX Matriz"
                  className="w-full px-3 py-1.5 text-xs bg-white rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Conteúdo da mensagem enviada ao cliente
                </label>
                <textarea
                  required
                  rows={4}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Digite aqui o texto exato que será enviado..."
                  className="w-full px-3 py-2 text-xs bg-white rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-200 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {loading ? 'Salvando...' : 'Salvar Resposta'}
                </button>
              </div>
            </form>
          ) : (
            <>
              {/* Category filters & Add button */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                        activeCategory === cat
                          ? 'bg-stone-900 text-white'
                          : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => startEdit()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Novo Atalho</span>
                </button>
              </div>

              {/* List */}
              {filtered.length === 0 ? (
                <div className="text-center py-10 bg-stone-50 rounded-xl border border-stone-200">
                  <p className="text-xs text-stone-500">Nenhuma resposta rápida cadastrada nesta categoria.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2.5">
                  {filtered.map((reply) => (
                    <div
                      key={reply.id}
                      className="p-3 bg-white rounded-xl border border-stone-200 hover:border-stone-300 transition-colors flex flex-col justify-between gap-2 group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded">
                              /{reply.shortcut}
                            </span>
                            <span className="text-xs font-bold text-stone-900">{reply.title}</span>
                            <span className="text-[10px] text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded">
                              {reply.category || 'Geral'}
                            </span>
                          </div>
                          <p className="text-xs text-stone-600 mt-1.5 whitespace-pre-line bg-stone-50/60 p-2 rounded-lg border border-stone-100">
                            {reply.content}
                          </p>
                        </div>

                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                          {onSelectReply && (
                            <button
                              onClick={() => {
                                onSelectReply(reply.content);
                                atendimentoApi.recordQuickReplyUsage(companyId, reply.id);
                                onClose();
                              }}
                              className="px-2.5 py-1 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-md transition-colors cursor-pointer"
                            >
                              Usar
                            </button>
                          )}
                          <button
                            onClick={() => handleCopy(reply.id, reply.content)}
                            title="Copiar texto"
                            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-md transition-colors cursor-pointer"
                          >
                            {copiedId === reply.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => startEdit(reply)}
                            title="Editar"
                            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-md transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(reply.id)}
                            title="Excluir"
                            className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-stone-400 pt-1 border-t border-stone-100">
                        <span>Usado {reply.usageCount || 0} vezes</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-stone-100 bg-stone-50 flex items-center justify-between text-xs text-stone-500">
          <span>Dica: Digite <code className="bg-stone-200 px-1 rounded font-mono">/</code> na caixa de mensagem para ver os atalhos.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-200 rounded-lg transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
