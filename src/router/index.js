import { createRouter, createWebHistory } from 'vue-router'
import Inicio from '../pages/Inicio.vue'
import Auditorias from '../pages/Auditorias.vue'
import AuditoriaDetalhes from '../pages/AuditoriaDetalhes.vue'
import Vencimentos from '../pages/Vencimentos.vue'
import AnaliseAuditorias from '../pages/AnaliseAuditorias.vue'

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
