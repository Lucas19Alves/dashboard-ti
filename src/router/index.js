import { createRouter, createWebHistory } from 'vue-router'

// Cada página é baixada apenas quando o usuário acessa a respectiva rota.
const Inicio = () => import('../pages/Inicio.vue')
const Auditorias = () => import('../pages/Auditorias.vue')
const AuditoriaDetalhes = () => import('../pages/AuditoriaDetalhes.vue')
const Vencimentos = () => import('../pages/Vencimentos.vue')
const AnaliseAuditorias = () => import('../pages/AnaliseAuditorias.vue')
const NaoVinculados = () => import('../pages/NaoVinculados.vue')
const Documentacao = () => import('../pages/Documentacao.vue')
const FichaColaborador = () => import('../pages/FichaColaborador.vue')

const routes = [
  {
    path: '/',
    name: 'Inicio',
    meta: { titulo: 'Início' },
    component: Inicio
  },
  {
    path: '/auditorias',
    name: 'Auditorias',
    meta: { titulo: 'Auditorias' },
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
    meta: { titulo: 'Análise de auditorias' },
    component: AnaliseAuditorias
  },
  {
    path: '/vencimentos',
    name: 'Vencimentos',
    meta: { titulo: 'Vencimentos' },
    component: Vencimentos
  },
  {
    path: '/nao-vinculados',
    name: 'NaoVinculados',
    meta: { titulo: 'Não vinculados' },
    component: NaoVinculados
  },
  {
    path: '/documentacao',
    name: 'Documentacao',
    meta: { titulo: 'Documentação' },
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

router.afterEach(to => {
  document.title = to.meta?.titulo ? `${to.meta.titulo} · Dashboard TI` : 'Dashboard TI'
})

export default router
