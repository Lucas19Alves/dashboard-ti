import { createRouter, createWebHistory } from 'vue-router'

// Cada página é baixada apenas quando o usuário acessa a respectiva rota.
const Inicio = () => import('../pages/Inicio.vue')
const Auditorias = () => import('../pages/Auditorias.vue')
const AuditoriaDetalhes = () => import('../pages/AuditoriaDetalhes.vue')
const Vencimentos = () => import('../pages/Vencimentos.vue')
const AnaliseAuditorias = () => import('../pages/AnaliseAuditorias.vue')

const routes = [
  {
    path: '/',
    name: 'Inicio',
    component: Inicio
  },
  {
    path: '/auditorias',
    name: 'Auditorias',
    component: Auditorias
  },
  {
    path: '/auditoria/:id',
    name: 'AuditoriaDetalhes',
    component: AuditoriaDetalhes
  },
  {
    path: '/auditorias/analise',
    name: 'AnaliseAuditorias',
    component: AnaliseAuditorias
  },
  {
    path: '/vencimentos',
    name: 'Vencimentos',
    component: Vencimentos
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
