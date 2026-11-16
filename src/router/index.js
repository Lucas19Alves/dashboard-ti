import { createRouter, createWebHistory } from 'vue-router'

// Cada página é baixada apenas quando o usuário acessa a respectiva rota.
const Inicio = () => import('../pages/Inicio.vue')
const Auditorias = () => import('../pages/Auditorias.vue')
const AuditoriaDetalhes = () => import('../pages/AuditoriaDetalhes.vue')
const Vencimentos = () => import('../pages/Vencimentos.vue')
const AnaliseAuditorias = () => import('../pages/AnaliseAuditorias.vue')
const Estoque = () => import('../pages/Estoque.vue')
const Documentacao = () => import('../pages/Documentacao.vue')
const FichaColaborador = () => import('../pages/FichaColaborador.vue')

const routes = [
  {
    path: '/',
    name: 'Inicio',
    meta: { titulo: 'Início', indexar: true, descricao: 'Resumo do dia da loja: auditoria planejada, pendências, vencimentos próximos, estoque e backup.' },
    component: Inicio
  },
  {
    path: '/auditorias',
    name: 'Auditorias',
    meta: { titulo: 'Auditorias', indexar: true, descricao: 'Calendário semanal de auditorias de etiqueta, presença e ruptura, com meta, pendências e importação das planilhas do ERP.' },
    component: Auditorias
  },
  {
    path: '/auditoria/:id',
    name: 'AuditoriaDetalhes',
    meta: { titulo: 'Detalhes da auditoria' },
    component: AuditoriaDetalhes
  },
  {
    path: '/colaborador/:usuario',
    name: 'FichaColaborador',
    meta: { titulo: 'Ficha do colaborador' },
    component: FichaColaborador
  },
  {
    path: '/auditorias/analise',
    name: 'AnaliseAuditorias',
    meta: { titulo: 'Análise de auditorias', indexar: true, descricao: 'Evolução das auditorias da loja: reincidência, ruptura em valor, desempenho por setor e por colaborador.' },
    component: AnaliseAuditorias
  },
  {
    path: '/vencimentos',
    name: 'Vencimentos',
    meta: { titulo: 'Vencimentos', indexar: true, descricao: 'Controle de validades por urgência e por setor, com lista de conferência e imagem pronta para o WhatsApp.' },
    component: Vencimentos
  },
  {
    path: '/estoque',
    name: 'Estoque',
    meta: { titulo: 'Estoque', indexar: true, descricao: 'Estoque total da loja, itens sem local (não vinculados), histórico e problemas de cadastro.' },
    component: Estoque
  },
  // Endereço antigo: a aba Não vinculados agora fica dentro de Estoque.
  { path: '/nao-vinculados', redirect: { path: '/estoque', query: { aba: 'nao-vinculados' } } },
  {
    path: '/documentacao',
    name: 'Documentacao',
    meta: { titulo: 'Documentação', indexar: true, descricao: 'Como usar o Dashboard Loja: importação de planilhas, auditorias, vencimentos, estoque, backup e atalhos.' },
    component: Documentacao
  },
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, salvo) {
    if (salvo) return salvo
    if (to.path === from.path) return false
    return { top: 0 }
  }
})

// Título, descrição e endereço canônico por página (buscadores executam o JavaScript e leem estes valores).
const SITE = 'https://dashboard-ti-five.vercel.app'
const TITULO_INICIO = 'Dashboard Loja · Auditorias, vencimentos e estoque'
const DESCRICAO_PADRAO = 'Painel da loja para auditorias de etiqueta, presença e ruptura, controle de vencimentos e estoque. Importa as planilhas do ERP, gera relatórios para o WhatsApp e funciona offline.'
const definirMeta = (seletor, atributo, valor) => document.head.querySelector(seletor)?.setAttribute(atributo, valor)

router.afterEach(to => {
  const titulo = to.path === '/' ? TITULO_INICIO : to.meta?.titulo ? `${to.meta.titulo} · Dashboard Loja` : 'Dashboard Loja'
  const url = SITE + to.path
  document.title = titulo
  definirMeta('meta[name="description"]', 'content', to.meta?.descricao || DESCRICAO_PADRAO)
  definirMeta('link[rel="canonical"]', 'href', url)
  definirMeta('meta[property="og:url"]', 'content', url)
  definirMeta('meta[property="og:title"]', 'content', titulo)
  // Só as páginas gerais vão para o índice; detalhe de auditoria, ficha de colaborador e páginas ocultas não.
  definirMeta('meta[name="robots"]', 'content', to.meta?.indexar ? 'index, follow, max-image-preview:large' : 'noindex, follow')
})

export default router
