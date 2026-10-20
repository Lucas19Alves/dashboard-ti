<script setup>
import { computed, ref, watch } from 'vue'
import { agregarPorArea, carregarLayoutSalvo, gerarLayoutPadrao, interpretarLocal, mesclarLayout, nomeArea } from '../utils/mapaLoja'
import { escalaPorAfinidade, historicoLeitores, mediana, ritmosDaAuditoria, setorPorArea } from '../utils/planoAcao'
import { evolucaoUsuarios } from '../utils/historicoAuditorias'
import { useAuditoriasStore } from '../stores/auditoriasStore'
import { correspondeBusca } from '../utils/busca'
import { rotuloUsuario } from '../utils/usuario'
import { blocoTabela, escapeHtml, imprimirRelatorio, selo } from '../utils/print'

// Escala para a próxima auditoria: cada colaborador fica com as áreas e setores em que costuma
// ler (histórico das últimas auditorias), dentro da capacidade do seu ritmo até o fim do horário.
const props = defineProps({
  auditoria: { type: Object, required: true },
  inicio: { type: String, default: '08:00' },
  fim: { type: String, default: '20:00' }
})
const store = useAuditoriasStore()

// Base histórica: as últimas auditorias com itens (inclui a atual).
const BASES = [5, 10, 20]
const base = ref(10)
const historicoAuditorias = computed(() => [...(store.auditorias || [])]
  .filter(a => Array.isArray(a?.dados) && a.dados.length)
  .sort((a, b) => String(b.data).localeCompare(String(a.data)) || b.id - a.id)
  .slice(0, base.value))
const historico = computed(() => historicoLeitores(historicoAuditorias.value))
const ritmoHistorico = computed(() => new Map(evolucaoUsuarios(historicoAuditorias.value).map(u => [u.usuario, u.ritmoRecente ?? u.ritmoMedio])))
const ritmosAtuais = computed(() => ritmosDaAuditoria(props.auditoria))
const ritmoMediano = computed(() => Math.round(mediana(ritmosAtuais.value.map(r => r.ritmo)) || mediana([...ritmoHistorico.value.values()].filter(Boolean)) || 120))

// Áreas a auditar (tamanho pela auditoria atual) e setor de cada área.
const areasAuditoria = computed(() => agregarPorArea(props.auditoria, () => false))
const areas = computed(() => [...areasAuditoria.value.values()].map(a => ({ bloco: a.bloco, tipo: a.tipo, numero: a.numero, itens: a.total })).filter(a => a.itens > 0))
const setores = computed(() => setorPorArea(props.auditoria))

// Colaboradores: todos com histórico; por padrão, os que leram nesta auditoria.
const colaboradores = computed(() => [...historico.value.values()]
  .sort((a, b) => b.total - a.total)
  .map(h => ({ usuario: h.usuario, total: h.total, setor: [...h.porSetor].sort((a, b) => b[1] - a[1])[0]?.[0] || '', ritmo: ritmoHistorico.value.get(h.usuario) || null })))
const selecionados = ref(new Set())
watch(() => props.auditoria?.id, () => {
  const atuais = new Set(Object.keys(props.auditoria?.analise?.porUsuario || {}))
  const lista = colaboradores.value.filter(c => atuais.has(c.usuario)).map(c => c.usuario)
  selecionados.value = new Set(lista.length ? lista : colaboradores.value.slice(0, 3).map(c => c.usuario))
}, { immediate: true })
const alternar = (usuario) => {
  const novo = new Set(selecionados.value)
  novo.has(usuario) ? novo.delete(usuario) : novo.add(usuario)
  selecionados.value = novo
}
const buscaColab = ref('')
const colaboradoresVisiveis = computed(() => colaboradores.value.filter(c => correspondeBusca(buscaColab.value, [c.usuario, c.setor])))

const horaInicio = ref(props.inicio)
const horaFim = ref(props.fim)
const ritmoPadrao = ref(120)
watch(ritmoMediano, v => { ritmoPadrao.value = v }, { immediate: true })
const minutos = hhmm => { const [h, m] = String(hhmm).split(':').map(Number); return (h || 0) * 60 + (m || 0) }
const horas = computed(() => Math.max(0.5, (minutos(horaFim.value) - minutos(horaInicio.value)) / 60))
const horario = h => {
  const total = minutos(horaInicio.value) + Math.round(h * 60)
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

const escala = computed(() => escalaPorAfinidade({
  areas: areas.value,
  pessoas: colaboradores.value.filter(c => selecionados.value.has(c.usuario)).map(c => ({ usuario: c.usuario, ritmo: c.ritmo })),
  historico: historico.value,
  setores: setores.value,
  horas: horas.value,
  ritmoPadrao: Math.max(1, Number(ritmoPadrao.value) || 1)
}))

const CORES = ['#3b82f6', '#f97316', '#10b981', '#a855f7', '#ef4444', '#06b6d4', '#eab308', '#ec4899', '#64748b', '#84cc16', '#14b8a6', '#8b5cf6']
const cor = pessoa => CORES[(pessoa - 1) % CORES.length]
const grupoDaArea = computed(() => new Map(escala.value.grupos.flatMap(g => g.areas.map(a => [a.bloco, g]))))
const classeAderencia = v => (v >= 80 ? 'bg-emerald-100 text-emerald-700' : v >= 50 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-700')

const resumirAreas = (lista) => {
  const corredores = lista.filter(a => a.tipo === 'gondola').map(a => String(a.numero).padStart(2, '0'))
  const outras = lista.filter(a => a.tipo !== 'gondola').map(a => nomeArea(a))
  return [corredores.length ? `Corredor${corredores.length > 1 ? 'es' : ''} ${corredores.join(', ')}` : '', ...outras].filter(Boolean).join(' · ')
}

// Mapa
const layout = computed(() => mesclarLayout(gerarLayoutPadrao(areasAuditoria.value.values()), carregarLayoutSalvo()))
const posicoes = computed(() => layout.value.posicoes.filter(p => !p.oculto))
const rotulo = (p) => {
  const area = areasAuditoria.value.get(p.id) || { bloco: p.id, ...interpretarLocal(p.id) }
  return area.tipo === 'gondola' ? p.id.slice(1) : nomeArea(area)
}
const iniciais = usuario => (rotuloUsuario(usuario).split(' ').filter(Boolean).slice(0, 2).map(x => x[0]).join('') || '?').toUpperCase()

// Escala impressa para afixar ou entregar à equipe: uma linha por pessoa, com assinatura.
const imprimirEscala = () => {
  const e = escala.value
  if (!e.grupos.length) return
  imprimirRelatorio({
    titulo: 'Escala da auditoria',
    subtitulo: `${props.auditoria.tipo} · ${horaInicio.value} às ${horaFim.value}`,
    contexto: [
      { rotulo: 'Base', valor: `${props.auditoria.tipo} · histórico das últimas ${base.value} auditorias` },
      { rotulo: 'Horário', valor: `${horaInicio.value} às ${horaFim.value}` },
      { rotulo: 'Colaboradores', valor: `${e.grupos.length} (necessárias: ${e.pessoasNecessarias})` },
      { rotulo: 'Término previsto', valor: horario(e.horasNecessarias) }
    ],
    indicadores: [
      { rotulo: 'Itens a auditar', valor: e.totalItens.toLocaleString('pt-BR'), tom: 'neutro' },
      { rotulo: 'Pessoas necessárias', valor: e.pessoasNecessarias, tom: e.pessoasNecessarias > e.grupos.length ? 'ruim' : 'bom' },
      { rotulo: 'Término previsto', valor: horario(e.horasNecessarias), tom: e.cabeNoHorario ? 'bom' : 'ruim' },
      { rotulo: 'Áreas habituais', valor: `${e.aderencia.toFixed(0)}%`, detalhe: 'itens onde a pessoa já costuma ler', tom: 'neutro' }
    ],
    secoes: [{
      titulo: 'Divisão por colaborador',
      html: blocoTabela({
        colunas: [
          { chave: 'pessoa', titulo: '#', alinhamento: 'right' }, { chave: 'nome', titulo: 'Colaborador' }, { chave: 'areas', titulo: 'Áreas' },
          { chave: 'itens', titulo: 'Itens', alinhamento: 'right', format: v => v.toLocaleString('pt-BR') }, { chave: 'ritmo', titulo: 'Ritmo (/h)', alinhamento: 'right' },
          { chave: 'termino', titulo: 'Até', alinhamento: 'right', html: (v, l) => (l.estoura ? selo(v, 'ruim') : escapeHtml(v)) },
          { chave: 'visto', titulo: 'Visto', html: () => '&nbsp;'.repeat(18) }
        ],
        linhas: e.grupos.map(g => ({ pessoa: g.pessoa, nome: rotuloUsuario(g.usuario), areas: resumirAreas(g.areas) || '—', itens: g.itens, ritmo: Math.round(g.ritmo), termino: horario(g.horas), estoura: g.horas > horas.value }))
      })
    }],
    assinaturas: ['Responsável pela auditoria', 'Liderança', 'Data']
  })
}
</script>

<template>
  <section class="rounded-2xl bg-white p-5 shadow-sm">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 class="text-lg font-bold text-slate-900"><i class="fas fa-people-arrows mr-2 text-blue-600"></i>Escala sugerida para a próxima auditoria</h3>
        <p class="text-xs text-slate-500">Cada colaborador fica nas áreas e setores em que costuma ler (histórico), dentro do que o seu ritmo permite até {{ horaFim }}.</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
      <button type="button" class="ui-btn-secondary py-1.5 text-xs" :disabled="!escala.grupos.length" @click="imprimirEscala"><i class="fas fa-print"></i>Imprimir escala</button>
      <label class="flex items-center gap-2 text-xs font-semibold text-slate-600">
        Histórico das últimas
        <select v-model.number="base" class="ui-input w-auto py-1.5 text-xs">
          <option v-for="n in BASES" :key="n" :value="n">{{ n }} auditorias</option>
        </select>
      </label>
      </div>
    </div>

    <!-- Colaboradores -->
    <div class="mt-4 rounded-xl bg-slate-50 p-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <p class="text-xs font-bold text-slate-700">Colaboradores na escala: {{ selecionados.size }}</p>
        <input v-model="buscaColab" type="search" class="ui-input w-full py-1.5 text-xs sm:w-56" placeholder="Buscar colaborador ou setor..." aria-label="Buscar colaborador">
      </div>
      <p v-if="!colaboradores.length" class="mt-2 text-xs text-slate-500">Sem histórico de leituras por usuário nas auditorias salvas.</p>
      <div class="mt-2 flex max-h-36 flex-wrap gap-1.5 overflow-y-auto">
        <button v-for="c in colaboradoresVisiveis" :key="c.usuario" type="button" :aria-pressed="selecionados.has(c.usuario)"
          class="rounded-full px-2.5 py-1 text-xs font-semibold ring-1 transition" :class="selecionados.has(c.usuario) ? 'bg-blue-600 text-white ring-blue-600' : 'bg-white text-slate-700 ring-slate-200 hover:ring-blue-300'"
          :title="`${c.total.toLocaleString('pt-BR')} leituras no histórico${c.ritmo ? ` · ${Math.round(c.ritmo)}/h` : ''}`" @click="alternar(c.usuario)">
          <i :class="selecionados.has(c.usuario) ? 'fas fa-check mr-1' : 'fas fa-plus mr-1 opacity-50'"></i>{{ rotuloUsuario(c.usuario) }}
          <span class="ml-1 font-medium opacity-75">· {{ c.setor }}</span>
        </button>
      </div>
    </div>

    <div class="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
      <label class="block"><span class="ui-label">Início</span><input v-model="horaInicio" type="time" class="ui-input"></label>
      <label class="block"><span class="ui-label">Fim</span><input v-model="horaFim" type="time" class="ui-input"></label>
      <label class="block"><span class="ui-label">Ritmo padrão (/h)</span><input v-model.number="ritmoPadrao" type="number" min="1" class="ui-input"></label>
    </div>
    <p class="mt-1 text-[11px] text-slate-500">Cada colaborador usa o próprio ritmo recente; o padrão vale para quem não tem histórico de horário e para o cálculo de pessoas necessárias.</p>

    <div class="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
      <div class="rounded-xl bg-slate-50 p-3"><p class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Itens a auditar</p><p class="text-xl font-black text-slate-900">{{ escala.totalItens.toLocaleString('pt-BR') }}</p></div>
      <div class="rounded-xl p-3" :class="escala.pessoasNecessarias > selecionados.size ? 'bg-red-50' : 'bg-emerald-50'">
        <p class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Pessoas necessárias</p>
        <p class="text-xl font-black" :class="escala.pessoasNecessarias > selecionados.size ? 'text-red-700' : 'text-emerald-700'">{{ escala.pessoasNecessarias }}</p>
        <p class="text-[11px] text-slate-500">{{ horas.toFixed(1).replace('.', ',') }}h a {{ ritmoPadrao }}/h</p>
      </div>
      <div class="rounded-xl p-3" :class="escala.cabeNoHorario ? 'bg-emerald-50' : 'bg-red-50'">
        <p class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Término previsto</p>
        <p class="text-xl font-black" :class="escala.cabeNoHorario ? 'text-emerald-700' : 'text-red-700'">{{ escala.grupos.length ? horario(escala.horasNecessarias) : '—' }}</p>
        <p class="text-[11px] text-slate-500">pela maior carga</p>
      </div>
      <div class="rounded-xl p-3" :class="escala.aderencia >= 80 ? 'bg-emerald-50' : 'bg-amber-50'">
        <p class="text-[11px] font-bold uppercase tracking-wider text-slate-500">No setor habitual</p>
        <p class="text-xl font-black text-slate-900">{{ escala.aderencia.toFixed(0) }}%</p>
        <p class="text-[11px] text-slate-500">dos itens com quem já lê ali</p>
      </div>
    </div>

    <p v-if="!areas.length" class="mt-4 rounded-xl bg-slate-50 py-8 text-center text-sm text-slate-500">Sem contagem por local nesta auditoria.</p>
    <p v-else-if="!escala.grupos.length" class="mt-4 rounded-xl bg-slate-50 py-8 text-center text-sm text-slate-500">Escolha ao menos um colaborador.</p>
    <div v-else class="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div class="overflow-x-auto rounded-xl bg-slate-50 p-3">
        <svg :viewBox="`-0.5 -0.5 ${layout.colunas + 1} ${layout.linhas + 1}`" class="w-full min-w-[600px]" role="img" aria-label="Divisão das áreas por colaborador">
          <g v-for="p in posicoes" :key="p.id">
            <rect :x="p.x + 0.08" :y="p.y + 0.08" :width="p.w - 0.16" :height="p.h - 0.16" rx="0.35" :fill="grupoDaArea.has(p.id) ? cor(grupoDaArea.get(p.id).pessoa) : '#e2e8f0'"
              :fill-opacity="grupoDaArea.has(p.id) ? (grupoDaArea.get(p.id).areas.find(a => a.bloco === p.id)?.habitual ? 0.9 : 0.45) : 1" stroke="#fff" stroke-width="0.08">
              <title>{{ rotulo(p) }}{{ grupoDaArea.has(p.id) ? ` · ${rotuloUsuario(grupoDaArea.get(p.id).usuario)}` : '' }}{{ setores.get(p.id) ? ` · ${setores.get(p.id)}` : '' }}</title>
            </rect>
            <text :x="p.x + p.w / 2" :y="p.y + p.h / 2 - (grupoDaArea.has(p.id) && p.h > 2 ? 0.45 : 0)" text-anchor="middle" dominant-baseline="central" font-size="0.75" font-weight="800" :fill="grupoDaArea.has(p.id) ? '#fff' : '#64748b'">{{ rotulo(p) }}</text>
            <text v-if="grupoDaArea.has(p.id) && p.h > 2" :x="p.x + p.w / 2" :y="p.y + p.h / 2 + 0.55" text-anchor="middle" dominant-baseline="central" font-size="0.62" font-weight="700" fill="#fff">{{ iniciais(grupoDaArea.get(p.id).usuario) }}</text>
          </g>
        </svg>
        <p class="mt-2 text-[11px] text-slate-500">Cor cheia = área em que a pessoa já costuma ler · cor clara = área nova para ela (sem alternativa com histórico).</p>
      </div>
      <ol class="max-h-[560px] space-y-2 overflow-y-auto">
        <li v-for="g in escala.grupos" :key="g.pessoa" class="rounded-xl p-3 ring-1 ring-slate-200">
          <div class="flex items-center gap-2">
            <span class="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-black text-white" :style="{ background: cor(g.pessoa) }">{{ iniciais(g.usuario) }}</span>
            <div class="min-w-0 flex-1">
              <p class="truncate font-bold text-slate-900">{{ rotuloUsuario(g.usuario) }}</p>
              <p class="truncate text-[11px] text-slate-500">Costuma ler: {{ g.setoresHabituais.join(', ') || '—' }}</p>
            </div>
            <span class="rounded-full px-2 py-0.5 text-[11px] font-bold" :class="classeAderencia(g.aderencia)" :title="'Itens em áreas/setores que a pessoa já lê'">{{ g.aderencia.toFixed(0) }}% habitual</span>
          </div>
          <p class="mt-1.5 text-xs text-slate-700">{{ resumirAreas(g.areas) || 'Sem áreas' }}</p>
          <p class="text-[11px] text-slate-500">
            {{ g.itens.toLocaleString('pt-BR') }} itens · {{ Math.round(g.ritmo) }}/h · <span :class="g.horas > horas ? 'font-bold text-red-700' : ''">até {{ horario(g.horas) }}</span>
          </p>
        </li>
      </ol>
    </div>
  </section>
</template>
