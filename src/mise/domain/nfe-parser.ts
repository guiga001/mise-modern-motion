/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — F44: Parser Seguro e Determinístico de XML de NF-e (Modelo 55 / 65)
 * Proteção nativa contra XXE (XML External Entity) e injeções DTD.
 */

export interface NfeItem {
  itemIndex: number;
  productCode: string;
  description: string;
  ncm: string;
  commercialUnit: string;
  quantity: number;
  unitPriceInCents: number;
  totalPriceInCents: number;
}

export interface NfeSupplier {
  cnpj: string;
  corporateName: string;
  tradeName?: string;
  phone?: string;
}

export interface NfeParsedDocument {
  accessKey: string; // Chave de acesso de 44 dígitos
  invoiceNumber: string;
  series: string;
  issueDate: string;
  supplier: NfeSupplier;
  items: NfeItem[];
  totalProductsInCents: number;
  totalInvoiceInCents: number;
  rawXmlHash: string;
}

/**
 * Validação rigorosa de segurança antes da análise:
 * Rejeita qualquer XML que contenha declarações DOCTYPE ou ENTITY (Prevenção XXE).
 */
export function validateNfeSecurity(xmlString: string, maxBytes = 5 * 1024 * 1024): void {
  if (!xmlString || typeof xmlString !== 'string') {
    throw new Error('Conteúdo do arquivo XML inválido ou vazio.');
  }

  if (xmlString.length > maxBytes) {
    throw new Error(`Arquivo excede o limite máximo permitido de ${maxBytes / 1024 / 1024}MB.`);
  }

  // Prevenção contra XXE e DTD Injections
  const upper = xmlString.toUpperCase();
  if (upper.includes('<!DOCTYPE') || upper.includes('<!ENTITY') || upper.includes('SYSTEM') && upper.includes('http')) {
    throw new Error('Segurança: XML contém entidades externas ou DTD proibidos (XXE). Processamento bloqueado.');
  }
}

/**
 * Utilitário de extração de tag regex pura para independência total de runtime (DOM ou Node.js).
 */
function extractTagContent(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? match[1].trim() : null;
}

/**
 * Converte valor decimal da SEFAZ ("123.45") em centavos inteiros (12345).
 */
export function parseSefazCurrencyToCents(valStr: string | null): number {
  if (!valStr) return 0;
  const num = parseFloat(valStr.replace(',', '.'));
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
}

/**
 * F44: Parser determinístico de XML da NF-e.
 */
export function parseNfeXml(xmlString: string): NfeParsedDocument {
  validateNfeSecurity(xmlString);

  // 1. Extrair Chave de Acesso (44 dígitos)
  let accessKey = extractTagContent(xmlString, 'chNFe');
  if (!accessKey) {
    const idMatch = xmlString.match(/Id=["']NFe(\d{44})["']/i);
    if (idMatch) {
      accessKey = idMatch[1];
    }
  }

  if (!accessKey || accessKey.length !== 44 || !/^\d{44}$/.test(accessKey)) {
    throw new Error('Chave de Acesso da NF-e inválida ou ausente (deve conter 44 dígitos numéricos).');
  }

  // 2. Dados da Nota
  const invoiceNumber = extractTagContent(xmlString, 'nNF') || 'S/N';
  const series = extractTagContent(xmlString, 'serie') || '1';
  const issueDate = extractTagContent(xmlString, 'dhEmi') || extractTagContent(xmlString, 'dEmi') || new Date().toISOString();

  // 3. Fornecedor (Emitente)
  const emitXml = extractTagContent(xmlString, 'emit');
  if (!emitXml) {
    throw new Error('Tag <emit> do fornecedor não encontrada no XML da NF-e.');
  }

  const supplierCnpj = extractTagContent(emitXml, 'CNPJ') || extractTagContent(emitXml, 'CPF') || '';
  const supplierName = extractTagContent(emitXml, 'xNome') || 'Fornecedor sem Razão Social';
  const supplierTrade = extractTagContent(emitXml, 'xFant') || undefined;
  const supplierPhone = extractTagContent(emitXml, 'fone') || undefined;

  const supplier: NfeSupplier = {
    cnpj: supplierCnpj,
    corporateName: supplierName,
    tradeName: supplierTrade,
    phone: supplierPhone,
  };

  // 4. Totais
  const totalXml = extractTagContent(xmlString, 'total');
  const icmsTotXml = totalXml ? extractTagContent(totalXml, 'ICMSTot') : null;
  const totalProductsInCents = parseSefazCurrencyToCents(icmsTotXml ? extractTagContent(icmsTotXml, 'vProd') : null);
  const totalInvoiceInCents = parseSefazCurrencyToCents(icmsTotXml ? extractTagContent(icmsTotXml, 'vNF') : null);

  // 5. Itens (<det>)
  const detMatches = xmlString.matchAll(/<det\b[^>]*>([\s\S]*?)<\/det>/gi);
  const items: NfeItem[] = [];
  let itemCounter = 1;

  for (const match of detMatches) {
    const detContent = match[1];
    const prodXml = extractTagContent(detContent, 'prod');
    if (!prodXml) continue;

    const description = extractTagContent(prodXml, 'xProd') || `Item ${itemCounter}`;
    const productCode = extractTagContent(prodXml, 'cProd') || String(itemCounter);
    const ncm = extractTagContent(prodXml, 'NCM') || '';
    const commercialUnit = (extractTagContent(prodXml, 'uCom') || 'un').toLowerCase();
    const qtyStr = extractTagContent(prodXml, 'qCom') || '1';
    const quantity = parseFloat(qtyStr.replace(',', '.'));
    const unitPriceStr = extractTagContent(prodXml, 'vUnCom') || '0';
    const unitPriceInCents = parseSefazCurrencyToCents(unitPriceStr);
    const itemTotalStr = extractTagContent(prodXml, 'vProd') || '0';
    const totalPriceInCents = parseSefazCurrencyToCents(itemTotalStr);

    items.push({
      itemIndex: itemCounter++,
      productCode,
      description,
      ncm,
      commercialUnit,
      quantity: isNaN(quantity) ? 1 : quantity,
      unitPriceInCents,
      totalPriceInCents: totalPriceInCents || Math.round(quantity * unitPriceInCents),
    });
  }

  if (items.length === 0) {
    throw new Error('Nenhum item válido (<det>) encontrado no XML da NF-e.');
  }

  // Hash simples de verificação
  let hashVal = 0;
  for (let i = 0; i < accessKey.length; i++) {
    hashVal = (hashVal << 5) - hashVal + accessKey.charCodeAt(i);
    hashVal |= 0;
  }

  return {
    accessKey,
    invoiceNumber,
    series,
    issueDate,
    supplier,
    items,
    totalProductsInCents: totalProductsInCents || items.reduce((acc, i) => acc + i.totalPriceInCents, 0),
    totalInvoiceInCents: totalInvoiceInCents || totalProductsInCents,
    rawXmlHash: `nfe_${accessKey}_${Math.abs(hashVal)}`,
  };
}
