/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — Utilitário de Impressão Térmica de Comandas (80mm / 58mm ESC/POS)
 * Suporta impressão direta via iframe isolado, fallback nativo e cópia direta de texto plano.
 */

import { DeliveryOrder } from '../domain/delivery-types';

function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Gera texto plano formatado em 48 colunas (padrão de bobinas térmicas de 80mm).
 * Perfeito para envio direto para spoolers de impressão, portas seriais ou cópia rápida.
 */
export function generateReceiptPlainText(order: DeliveryOrder, restaurantName: string): string {
  const line = '------------------------------------------------';
  const doubleLine = '================================================';
  const channel = order.channel === 'IFOOD' ? 'iFood Delivery' : '99Food Delivery';
  const orderDate = new Date(order.createdAt).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  const padRight = (str: string, len: number) => {
    return str.length >= len ? str.slice(0, len) : str + ' '.repeat(len - str.length);
  };

  const justify = (left: string, right: string, width = 48) => {
    const space = Math.max(1, width - left.length - right.length);
    return left + ' '.repeat(space) + right;
  };

  const center = (str: string, width = 48) => {
    if (str.length >= width) return str.slice(0, width);
    const leftPad = Math.floor((width - str.length) / 2);
    return ' '.repeat(leftPad) + str;
  };

  const lines: string[] = [];

  lines.push(doubleLine);
  lines.push(center(restaurantName.toUpperCase() || 'MISE RESTAURANTE'));
  lines.push(center('CONTROLE DE PRODUCAO & EXPEDICAO'));
  lines.push(center(`[ ${channel.toUpperCase()} ]`));
  lines.push(line);

  lines.push(justify(`PEDIDO: ${order.displayId}`, orderDate));
  lines.push(`ID: ${order.externalOrderId}`);
  lines.push(`TIPO: ${order.logisticsType === 'MARKETPLACE_DELIVERY' ? `${order.channel === 'IFOOD' ? 'iFood' : '99Food'} Entrega (Parceiro)` : 'Entrega Propria'}`);
  lines.push(line);

  lines.push(`CLIENTE: ${order.customer.name}`);
  if (order.customer.phone) {
    lines.push(`TELEFONE: ${order.customer.phone}`);
  }
  const addr = order.customer.deliveryAddress;
  lines.push(`END: ${addr.street}, ${addr.number}${addr.complement ? ` (${addr.complement})` : ''}`);
  lines.push(`BAIRRO: ${addr.neighborhood} - ${addr.city}/${addr.state}`);
  if (addr.reference) {
    lines.push(`REF: ${addr.reference}`);
  }
  lines.push(line);

  lines.push('ITENS DO PEDIDO:');
  lines.push('');

  for (const item of order.items) {
    const itemHeader = `${item.quantity}x ${item.name}`;
    const itemPrice = formatMoney(item.totalPriceInCents);
    lines.push(justify(itemHeader, itemPrice));

    if (item.options && item.options.length > 0) {
      for (const opt of item.options) {
        const optText = `  + ${opt.quantity > 1 ? `${opt.quantity}x ` : ''}${opt.name}`;
        const optPrice = opt.unitPriceInCents > 0 ? formatMoney(opt.unitPriceInCents * opt.quantity) : '';
        lines.push(justify(optText, optPrice));
      }
    }

    if (item.notes) {
      lines.push(`  * OBS: ${item.notes}`);
    }
    lines.push('');
  }

  if (order.notes) {
    lines.push(line);
    lines.push('OBSERVACOES GERAIS:');
    lines.push(order.notes);
    lines.push(line);
  }

  lines.push(line);
  lines.push(justify('Subtotal Itens:', formatMoney(order.financial.subtotalInCents)));
  if (order.financial.deliveryFeeInCents > 0) {
    lines.push(justify('Taxa de Entrega:', formatMoney(order.financial.deliveryFeeInCents)));
  }
  if (order.financial.discountInCents > 0) {
    lines.push(justify('Descontos / Cupom:', `-${formatMoney(order.financial.discountInCents)}`));
  }
  lines.push(line);
  lines.push(justify('TOTAL A PAGAR:', formatMoney(order.financial.totalCustomerInCents)));
  lines.push(line);

  const paymentText = order.financial.paidOnline
    ? `PAGO ONLINE (${order.financial.paymentBrand || 'APP'})`
    : 'PAGAR NA ENTREGA';
  lines.push(center(`PAGAMENTO: ${paymentText}`));
  if (order.estimatedPreparationMinutes) {
    lines.push(center(`Preparo Estimado: ${order.estimatedPreparationMinutes} min`));
  }
  lines.push(center(`Impresso: ${new Date().toLocaleTimeString('pt-BR')}`));
  lines.push(doubleLine);
  lines.push('\n\n\n'); // Espaçamento para corte de papel da guilhotina

  return lines.join('\n');
}

/**
 * Gera o documento HTML auto-contido para impressão em impressora térmica (80mm / 58mm).
 */
export function generateReceiptHtml(order: DeliveryOrder, restaurantName: string): string {
  const channel = order.channel === 'IFOOD' ? 'iFood' : '99Food';
  const channelColor = order.channel === 'IFOOD' ? '#ea1d2c' : '#f7a800';
  const orderDate = new Date(order.createdAt).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  const addr = order.customer.deliveryAddress;

  const itemsHtml = order.items
    .map((item) => {
      const optionsHtml =
        item.options && item.options.length > 0
          ? item.options
              .map(
                (opt) => `
                <div style="display:flex;justify-content:space-between;padding-left:12px;font-size:11px;color:#333;">
                  <span>+ ${opt.name}</span>
                  <span>${opt.unitPriceInCents > 0 ? formatMoney(opt.unitPriceInCents * opt.quantity) : ''}</span>
                </div>
              `
              )
              .join('')
          : '';

      const notesHtml = item.notes
        ? `<div style="margin-top:2px;margin-left:12px;background:#f3f3f3;padding:2px 4px;font-weight:bold;font-size:11px;border-left:3px solid #000;">OBS: ${item.notes}</div>`
        : '';

      return `
        <div style="margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:12px;">
            <span>${item.quantity}x ${item.name}</span>
            <span>${formatMoney(item.totalPriceInCents)}</span>
          </div>
          ${optionsHtml}
          ${notesHtml}
        </div>
      `;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Comanda - ${order.displayId}</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 0;
    }
    @media print {
      html, body {
        width: 74mm;
        margin: 0 auto;
        padding: 0;
        background: #fff;
        color: #000;
      }
    }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      line-height: 1.25;
      color: #000;
      background: #fff;
      width: 74mm;
      margin: 0 auto;
      padding: 4mm 2mm;
      box-sizing: border-box;
    }
    .center { text-align: center; }
    .right { text-align: right; }
    .bold { font-weight: bold; }
    .divider { border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px; }
    .double-divider { border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 6px; }
    .flex { display: flex; justify-content: space-between; }
    .badge {
      display: inline-block;
      padding: 2px 6px;
      font-weight: bold;
      font-size: 11px;
      border: 1px solid #000;
      margin: 4px 0;
    }
    .total-box {
      font-size: 14px;
      font-weight: 900;
      border-top: 2px solid #000;
      border-bottom: 2px solid #000;
      padding: 4px 0;
      margin: 6px 0;
    }
  </style>
</head>
<body>
  <div class="center double-divider">
    <div style="font-size:15px;font-weight:900;letter-spacing:1px;text-transform:uppercase;">${restaurantName || 'MISE RESTAURANTE'}</div>
    <div style="font-size:10px;margin-top:2px;">CONTROLE DE PRODUÇÃO & EXPEDIÇÃO</div>
    <div class="badge" style="background:${channelColor};color:#fff;border-color:${channelColor};">PEDIDO ${channel.toUpperCase()}</div>
  </div>

  <div class="divider">
    <div class="flex bold" style="font-size:14px;">
      <span>${order.displayId}</span>
      <span style="font-size:11px;font-weight:normal;">${orderDate}</span>
    </div>
    <div style="font-size:10px;color:#444;word-break:break-all;">ID: ${order.externalOrderId}</div>
    <div style="font-size:11px;margin-top:2px;">
      Logística: <strong>${order.logisticsType === 'MARKETPLACE_DELIVERY' ? `${channel} Entrega (Parceiro)` : 'Entrega Própria'}</strong>
    </div>
  </div>

  <div class="divider">
    <div class="bold" style="font-size:13px;">Cliente: ${order.customer.name}</div>
    ${order.customer.phone ? `<div>Tel: <strong>${order.customer.phone}</strong></div>` : ''}
    <div style="margin-top:4px;">
      <div><strong>${addr.street}, ${addr.number}${addr.complement ? ` (${addr.complement})` : ''}</strong></div>
      <div style="font-size:11px;">${addr.neighborhood} - ${addr.city}/${addr.state}</div>
      ${addr.reference ? `<div style="font-size:11px;font-style:italic;">Ref: ${addr.reference}</div>` : ''}
    </div>
  </div>

  <div class="divider">
    <div class="bold" style="font-size:11px;letter-spacing:1px;margin-bottom:6px;">ITENS DO PEDIDO</div>
    ${itemsHtml}
  </div>

  ${
    order.notes
      ? `
    <div class="divider" style="background:#f0f0f0;padding:4px;">
      <strong>OBSERVAÇÕES DO CLIENTE:</strong>
      <div style="font-style:italic;margin-top:2px;">${order.notes}</div>
    </div>
  `
      : ''
  }

  <div class="divider">
    <div class="flex">
      <span>Subtotal:</span>
      <span>${formatMoney(order.financial.subtotalInCents)}</span>
    </div>
    ${
      order.financial.deliveryFeeInCents > 0
        ? `
      <div class="flex">
        <span>Taxa Entrega:</span>
        <span>${formatMoney(order.financial.deliveryFeeInCents)}</span>
      </div>
    `
        : ''
    }
    ${
      order.financial.discountInCents > 0
        ? `
      <div class="flex">
        <span>Descontos:</span>
        <span>-${formatMoney(order.financial.discountInCents)}</span>
      </div>
    `
        : ''
    }
    <div class="flex total-box">
      <span>TOTAL A PAGAR:</span>
      <span>${formatMoney(order.financial.totalCustomerInCents)}</span>
    </div>
  </div>

  <div class="center divider">
    <div class="bold" style="font-size:12px;">
      PAGAMENTO: ${order.financial.paidOnline ? `PAGO ONLINE (${order.financial.paymentBrand || 'APP'})` : 'PAGAR NA ENTREGA'}
    </div>
    ${
      order.estimatedPreparationMinutes
        ? `<div style="font-size:11px;margin-top:3px;">Preparo Estimado: ${order.estimatedPreparationMinutes} minutos</div>`
        : ''
    }
  </div>

  <div class="center" style="font-size:10px;color:#777;margin-top:6px;">
    Impresso via Sistema Mise de Gestão
  </div>
</body>
</html>`;
}

/**
 * Dispara a impressão física da comanda com isolamento via iframe e fallback direto.
 */
export async function printThermalReceipt(
  order: DeliveryOrder,
  restaurantName: string
): Promise<{ success: boolean; method: string }> {
  const html = generateReceiptHtml(order, restaurantName);

  return new Promise((resolve) => {
    try {
      // 1. Tentar criar um iframe invisível para imprimir exclusivamente a comanda
      const iframe = document.createElement('iframe');
      iframe.setAttribute(
        'style',
        'position:fixed;top:-10000px;left:-10000px;width:80mm;height:0;border:0;visibility:hidden;'
      );
      document.body.appendChild(iframe);

      const frameDoc = iframe.contentWindow?.document || iframe.contentDocument;

      if (frameDoc && iframe.contentWindow) {
        frameDoc.open();
        frameDoc.write(html);
        frameDoc.close();

        // Aguarda renderização dos estilos e fontes
        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();

            setTimeout(() => {
              if (document.body.contains(iframe)) {
                document.body.removeChild(iframe);
              }
              resolve({ success: true, method: 'iframe' });
            }, 1000);
          } catch (printErr) {
            console.warn('Iframe print bloqueado pelo navegador, acionando fallback window.print()', printErr);
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
            window.print();
            resolve({ success: true, method: 'window-fallback' });
          }
        }, 300);
      } else {
        window.print();
        resolve({ success: true, method: 'window-direct' });
      }
    } catch (err) {
      console.error('Falha ao acionar rotina de impressão:', err);
      try {
        window.print();
        resolve({ success: true, method: 'window-catch' });
      } catch (finalErr) {
        resolve({ success: false, method: 'failed' });
      }
    }
  });
}
