#!/usr/bin/env node
/**
 * Trava de seguranca do deploy.
 *
 * Esta maquina tem mais de uma conta Netlify autenticada. Se a conta ativa nao
 * for a dona do site, o deploy pode falhar ou - pior - publicar o app em outra
 * conta. Este script confere conta e site ANTES de qualquer publicacao.
 *
 * Roda offline: le a configuracao local do CLI, sem chamar a API.
 */
import fs from 'fs';
import path from 'path';

const CONTA_ESPERADA = 'breno.luis@gmail.com';
const SITE_ESPERADO = '1b16cf0d-e999-40e4-8cff-a4e1135b8420'; // nossaviagem
const NOME_SITE = 'nossaviagem';

const vermelho = (t) => `\x1b[31m${t}\x1b[0m`;
const verde = (t) => `\x1b[32m${t}\x1b[0m`;
const amarelo = (t) => `\x1b[33m${t}\x1b[0m`;

const abortar = (titulo, detalhes) => {
  console.error(`\n${vermelho('DEPLOY BLOQUEADO')} - ${titulo}\n`);
  detalhes.forEach((linha) => console.error('  ' + linha));
  console.error('');
  process.exit(1);
};

// Localiza o config do Netlify CLI (Windows usa APPDATA)
const candidatos = [
  process.env.APPDATA && path.join(process.env.APPDATA, 'netlify', 'Config', 'config.json'),
  process.env.XDG_CONFIG_HOME && path.join(process.env.XDG_CONFIG_HOME, 'netlify', 'config.json'),
  process.env.HOME && path.join(process.env.HOME, '.config', 'netlify', 'config.json'),
  process.env.USERPROFILE && path.join(process.env.USERPROFILE, '.netlify', 'config.json')
].filter(Boolean);

const caminhoConfig = candidatos.find((p) => fs.existsSync(p));

if (!caminhoConfig) {
  abortar('nao encontrei a configuracao do Netlify CLI', [
    'Voce esta logado? Rode:',
    amarelo('  netlify login')
  ]);
}

let config;
try {
  config = JSON.parse(fs.readFileSync(caminhoConfig, 'utf8'));
} catch (erro) {
  abortar('configuracao do Netlify CLI ilegivel', [caminhoConfig, erro.message]);
}

const usuarios = config.users || {};
const ativo = usuarios[config.userId];
const emailAtivo = ativo?.email || '(desconhecido)';

if (emailAtivo !== CONTA_ESPERADA) {
  const disponiveis = Object.entries(usuarios).map(([, u]) => `- ${u.email || '(sem email)'}`);
  abortar(`a conta ativa nao e a dona do site ${NOME_SITE}`, [
    `Conta ativa:    ${vermelho(emailAtivo)}`,
    `Conta esperada: ${verde(CONTA_ESPERADA)}`,
    '',
    'Contas autenticadas nesta maquina:',
    ...disponiveis,
    '',
    'Para trocar:',
    amarelo('  netlify switch'),
    '(escolha ' + CONTA_ESPERADA + ' na lista)'
  ]);
}

// Confere o vinculo do projeto com o site correto
const caminhoEstado = path.join(process.cwd(), '.netlify', 'state.json');

if (!fs.existsSync(caminhoEstado)) {
  abortar('este projeto nao esta vinculado a nenhum site', [
    'Vincule com:',
    amarelo(`  netlify link --id ${SITE_ESPERADO}`)
  ]);
}

const estado = JSON.parse(fs.readFileSync(caminhoEstado, 'utf8'));

if (estado.siteId !== SITE_ESPERADO) {
  abortar('o projeto esta vinculado a outro site', [
    `Vinculado a:  ${vermelho(estado.siteId)}`,
    `Esperado:     ${verde(SITE_ESPERADO)} (${NOME_SITE})`,
    '',
    'Corrija com:',
    amarelo(`  netlify unlink && netlify link --id ${SITE_ESPERADO}`)
  ]);
}

console.log(`${verde('OK')} conta ${CONTA_ESPERADA} | site ${NOME_SITE} | pronto para publicar`);
