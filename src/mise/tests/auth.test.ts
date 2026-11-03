/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Suíte de Testes de Autenticação Estrita, Senhas e Isolamento de Empresas
 */

import { hashPassword, verifyPassword } from '../src/lib/crypto';
import { registerPrivateAccount, loginWithPassword } from '../src/lib/auth';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`FALHA NA ASSERÇÃO AUTH: ${msg}`);
  }
}

export function runAuthTests() {
  console.log('--- Iniciando Testes de Autenticação e Senhas do Mise ---');

  // Mock localStorage for Node environment if needed
  if (typeof globalThis.localStorage === 'undefined') {
    const store: Record<string, string> = {};
    (globalThis as any).localStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, val: string) => { store[key] = val; },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => {
        for (const k in store) delete store[k];
      },
    };
  } else {
    localStorage.clear();
  }

  // 1. Teste de Hashing SHA-256 e Verificação
  const pass = 'MinhaSenhaSecreta@2026';
  const hash1 = hashPassword(pass);
  const hash2 = hashPassword(pass);
  assert(hash1 === hash2, 'Hash determinístico deve produzir o mesmo resultado para a mesma senha');
  assert(hash1.length === 64, 'SHA-256 hex deve possuir 64 caracteres');
  assert(verifyPassword(pass, hash1), 'Senha correta deve ser verificada como verdadeira');
  assert(!verifyPassword('SenhaIncorreta', hash1), 'Senha incorreta deve retornar falso');
  assert(!verifyPassword('', hash1), 'Senha vazia deve retornar falso');
  console.log('✔ Teste 1: Hashing SHA-256 determinístico e verificação de senha validados.');

  // 2. Registro com Senha Obrigatória
  let failedShortPass = false;
  try {
    registerPrivateAccount({
      ownerName: 'Dono 1',
      email: 'dono1@restaurante.com',
      password: '123', // curta demais
      companyName: 'Restaurante Alfa',
    });
  } catch (e: any) {
    failedShortPass = true;
    assert(e.message.includes('mínimo 6 caracteres'), 'Deve exigir mínimo 6 caracteres');
  }
  assert(failedShortPass, 'Tentativa de registrar com senha curta deve falhar');

  const reg1 = registerPrivateAccount({
    ownerName: 'Alice Mendes',
    email: 'alice@alfa.com',
    password: 'senhaSegura123',
    companyName: 'Alfa Burger',
    storeName: 'Matriz Alfa',
  });
  assert(reg1.account.email === 'alice@alfa.com', 'Conta deve ser criada');
  assert(reg1.database.company?.name === 'Alfa Burger', 'Empresa privada Alfa deve ser criada');
  console.log('✔ Teste 2: Registro com senha e empresa privada inicializada com sucesso.');

  // 3. Login com Senha Incorreta DEVE ser Recusado
  let failedWrongPass = false;
  try {
    loginWithPassword('alice@alfa.com', 'senhaErrada');
  } catch (e: any) {
    failedWrongPass = true;
    assert(e.message.includes('Senha incorreta'), 'Deve alertar senha incorreta');
  }
  assert(failedWrongPass, 'Tentativa de login com senha incorreta deve ser bloqueada');

  // 4. Login com Senha Vazia DEVE ser Recusado
  let failedEmptyPass = false;
  try {
    loginWithPassword('alice@alfa.com', '');
  } catch (e: any) {
    failedEmptyPass = true;
  }
  assert(failedEmptyPass, 'Login sem senha DEVE ser terminantemente recusado');

  // 5. Login com Senha Correta DEVE passar e carregar os dados da Alfa
  const loginSuccess = loginWithPassword('alice@alfa.com', 'senhaSegura123');
  assert(loginSuccess.account.name === 'Alice Mendes', 'Deve carregar a conta autenticada');
  assert(loginSuccess.database.company?.id === reg1.account.companyId, 'Deve carregar estritamente a empresa Alfa');
  console.log('✔ Teste 3: Bloqueio estrito de senha incorreta e sucesso na senha correta validados.');

  // 6. Teste de Isolamento de Empresas: Usuário 2 cria Restaurante Beta
  const reg2 = registerPrivateAccount({
    ownerName: 'Bruno Costa',
    email: 'bruno@beta.com',
    password: 'outraSenha456',
    companyName: 'Pizzaria Beta',
    storeName: 'Matriz Beta',
  });
  assert(reg2.database.company?.id !== reg1.database.company?.id, 'IDs de empresa devem ser 100% distintos');
  assert(reg2.database.company?.name === 'Pizzaria Beta', 'Empresa deve ser Pizzaria Beta');

  // Bruno loga na sua empresa
  const loginBruno = loginWithPassword('bruno@beta.com', 'outraSenha456');
  assert(loginBruno.database.company?.name === 'Pizzaria Beta', 'Bruno acessa exclusivamente a Pizzaria Beta');

  // Bruno NÃO pode logar com a senha da Alice
  let failedCrossPass = false;
  try {
    loginWithPassword('bruno@beta.com', 'senhaSegura123');
  } catch (e) {
    failedCrossPass = true;
  }
  assert(failedCrossPass, 'Bruno não pode usar a senha da Alice');

  console.log('✔ Teste 4: Isolamento total entre empresas privadas e senhas únicas validado.');
  console.log('--- Todos os Testes de Autenticação Segura Passaram com Sucesso! ---');
}
