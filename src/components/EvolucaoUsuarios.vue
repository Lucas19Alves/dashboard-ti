<script setup>
import { computed, ref } from 'vue'
import { evolucaoUsuarios } from '../utils/historicoAuditorias'
import { separarUsuario, rotuloUsuario } from '../utils/usuario'
import GraficoEvolucaoUsuario from './GraficoEvolucaoUsuario.vue'
import UiTabela from './ui/UiTabela.vue'

// Produtividade de cada usuário ao longo das auditorias: ritmo (leituras por hora ativa) e % de problema.
// A tabela padrão cuida de busca, filtros (tendência, % problema, nº de auditorias...), ordem e CSV;
// o tipo de auditoria muda a base do cálculo, por isso fica fora dela.
const props = defineProps({
  auditorias: { type: Array, required: true }
})

const filtroTipo = ref('todos')
const tiposDisponiveis = computed(() => ['Etiqueta', 'Presença', 'Ruptura'].filter(t => props.auditorias.some(a => a.tipo === t)))
const auditoriasDoTipo = computed(() => (filtroTipo.value === 'todos' ? props.auditorias : props.auditorias.filter(a => a.tipo === filtroTipo.value)))
const usuarios = computed(() => evolucaoUsuarios(auditoriasDoTipo.value))

const fmt = v => (v === null || v === undefined ? '—' : Math.round(v).toLocaleString('pt-BR'))
const SETAS = {
  subindo: { icone: 'fa-arrow-trend-up', texto: 'subindo' },
  caindo: { icone: 'fa-arrow-trend-down', texto: 'caindo' },
  estavel: { icone: 'fa-minus', texto: 'estável' },
  indefinida: { icone: 'fa-minus', texto: 'poucas auditorias' }
}
// Ritmo subir é bom; problema subir é ruim.
const corRitmo = t => (t === 'subindo' ? 'text-emerald-700' : t === 'caindo' ? 'text-red-700' : 'text-slate-500')
const corProblema = t => (t === 'subindo' ? 'text-red-700' : t === 'caindo' ? 'text-emerald-700' : 'text-slate-500')

const COLUNAS = [
  { chave: 'usuario', titulo: 'Usuário', tipo: 'texto', valor: u => separarUsuario(u.usuario).nome || u.usuario },
  { chave: 'matricula', titulo: 'Matrícula', tipo: 'texto', oculta: true, valor: u => separarUsuario(u.usuario).matricula },
  { chave: 'auditorias', titulo: 'Aud.', tipo: 'numero' },
  { chave: 'leituras', titulo: 'Leituras', tipo: 'numero', oculta: true },
  { chave: 'ritmoMedio', titulo: 'Ritmo médio', tipo: 'numero', formato: v => `${fmt(v)}/h` },
  { chave: 'ritmoRecente', titulo: 'Últimas 3', tipo: 'numero', formato: v => `${fmt(v)}/h` },
  { chave: 'tendenciaRitmo', titulo: 'Tendência do ritmo', tipo: 'categoria', rapido: true, oculta: true, valor: u => SETAS[u.tendenciaRitmo]?.texto },
  { chave: 'percProblemaMedio', titulo: '% problema', tipo: 'numero', formato: v => (v === null || v === undefined ? '—' : `${v.toFixed(1)}%`) },
  { chave: 'tendenciaProblema', titulo: 'Tendência do problema', tipo: 'categoria', rapido: true, oculta: true, valor: u => SETAS[u.tendenciaProblema]?.texto }
]
const ATALHOS = [
  { rotulo: 'Ritmo caindo', icone: 'fas fa-arrow-trend-down', condicoes: [{ chave: 'tendenciaRitmo', op: 'em', valor: ['caindo'] }] },
  { rotulo: 'Problema acima de 5%', icone: 'fas fa-triangle-exclamation', condicoes: [{ chave: 'percProblemaMedio', op: 'maior', valor: '5' }] },
  { rotulo: '3+ auditorias', icone: 'fas fa-layer-group', condicoes: [{ chave: 'auditorias', op: 'maiorIgual', valor: '3' }] }
]

// Usuário mostrado no gráfico: o clicado, ou o primeiro da lista filtrada.
const selecionado = ref('')
const filtrados = ref([])
const aoFiltrar = (lista) => {
  filtrados.value = lista
  if (!lista.some(u => u.usuario === selecionado.value)) selecionado.value = lista[0]?.usuario || ''
}
const atual = computed(() => usuarios.value.find(u => u.usuario === selecionado.value) || null)
</script>

<template>
  <section class="ui-card p-5 md:p-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-base font-bold text-slate-900">Evolução ao longo das auditorias</h2>
        <p class="text-xs text-slate-500">Ritmo = leituras por hora de tempo ativo (pausas de 15+ min não contam). Precisa da coluna "Auditado em" com horário. Clique num usuário para ver o gráfico.</p>
      </div>
      <label class="text-xs text-slate-600">Calcular com
        <select v-model="filtroTipo" class="ui-input ml-1 inline-block w-auto py-1.5 text-xs" aria-label="Tipo de auditoria">
          <option value="todos">todos os tipos</option>
          <option v-for="t in tiposDisponiveis" :key="t" :value="t">{{ t }}</option>
        </select>
      </label>
    </div>

    <p v-if="!usuarios.length" class="py-10 text-center text-sm text-slate-500">Sem dados por usuário no período.</p>

    <div v-else class="mt-4 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <UiTabela id="evolucao-usuarios" titulo="Evolução dos usuários" :itens="usuarios" :colunas="COLUNAS" :atalhos="ATALHOS" :ordem-inicial="{ chave: 'leituras', direcao: 'desc' }" chave-item="usuario" :tamanho-pagina="10" :agrupavel="false" clicavel :destacar="u => u.usuario === selecionado" placeholder="Nome ou matrícula..." @linha="selecionado = $event.usuario" @filtrados="aoFiltrar">
        <template #celula-usuario="{ item: u }">
          <p class="font-semibold text-slate-800">{{ separarUsuario(u.usuario).nome || u.usuario }}</p>
          <p v-if="separarUsuario(u.usuario).matricula" class="text-[10px] font-normal text-slate-500">{{ separarUsuario(u.usuario).matricula }}</p>
        </template>
        <template #celula-ritmoRecente="{ item: u, texto }">
          <span class="font-semibold" :class="corRitmo(u.tendenciaRitmo)">{{ texto }} <i :class="['fas', SETAS[u.tendenciaRitmo].icone, 'ml-0.5 text-[10px]']" :title="`Ritmo ${SETAS[u.tendenciaRitmo].texto}`"></i></span>
        </template>
        <template #celula-percProblemaMedio="{ item: u, texto }">
          <span :class="corProblema(u.tendenciaProblema)">{{ texto }} <i :class="['fas', SETAS[u.tendenciaProblema].icone, 'ml-0.5 text-[10px]']" :title="`Problema ${SETAS[u.tendenciaProblema].texto}`"></i></span>
        </template>
      </UiTabela>

      <!-- Gráfico -->
      <div v-if="atual" class="h-fit rounded-xl bg-slate-50 p-4">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <p class="font-bold text-slate-900">{{ rotuloUsuario(atual.usuario) }}</p>
          <p class="text-xs text-slate-500">{{ atual.auditorias }} auditoria(s) · {{ atual.leituras.toLocaleString('pt-BR') }} leituras ·
            <router-link :to="`/colaborador/${encodeURIComponent(atual.usuario)}`" class="font-semibold text-blue-700 hover:underline">Abrir ficha</router-link></p>
        </div>
        <GraficoEvolucaoUsuario class="mt-3" :usuario="atual" />
      </div>
    </div>
  </section>
</template>
