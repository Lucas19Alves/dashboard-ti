<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { agregarPorArea, carregarLayoutSalvo, gerarLayoutPadrao, interpretarLocal, mesclarLayout, nomeArea } from '../utils/mapaLoja'
import { PAUSA_MINUTOS, formatarDuracao, horaDe, leiturasDoUsuario, montarTrajeto, pontoNoMapa } from '../utils/trajetoUsuario'
import { rotuloUsuario } from '../utils/usuario'

// Mapa histórico do usuário: leituras ao longo do dia e o caminho percorrido pela loja.
const props = defineProps({
  auditoria: { type: Object, required: true },
  isItemLido: { type: Function, required: true },
  usuarios: { type: Array, default: () => [] }, // [{ nome, exibicao, leituras }]
  usuarioInicial: { type: String, default: '' }
})

const usuario = ref(props.usuarioInicial || props.usuarios[0]?.nome || '')
watch(() => props.usuarioInicial, (v) => { if (v) usuario.value = v })
watch(() => props.usuarios, (lista) => { if (!usuario.value && lista.length) usuario.value = lista[0].nome })

// ---------- Dados ----------
const leituras = computed(() => leiturasDoUsuario(props.auditoria?.dados, usuario.value, props.isItemLido))
const dias = computed(() => [...leituras.value.porDia.keys()].sort())
const dia = ref('')
watch(dias, (lista) => {
  if (!lista.includes(dia.value)) {
    // Dia com mais leituras do usuário (normalmente o da auditoria).
    dia.value = [...lista].sort((a, b) => leituras.value.porDia.get(b).length - leituras.value.porDia.get(a).length)[0] || ''
  }
}, { immediate: true })
const trajeto = computed(() => montarTrajeto(leituras.value.porDia.get(dia.value) || []))
const paradas = computed(() => trajeto.value.paradas)

// ---------- Mapa ----------
const areas = computed(() => agregarPorArea(props.auditoria, props.isItemLido))
const layout = computed(() => mesclarLayout(gerarLayoutPadrao(areas.value.values()), carregarLayoutSalvo()))
const posicoes = computed(() => layout.value.posicoes.filter(p => !p.oculto))
const posicaoPorBloco = computed(() => new Map(posicoes.value.map(p => [p.id, p])))
const pontos = computed(() => paradas.value.map(p => pontoNoMapa(posicaoPorBloco.value.get(p.bloco), p.local)))
const foraDoMapa = computed(() => paradas.value.filter((p, i) => !pontos.value[i]).length)

// ---------- Reprodução ----------
const cursor = ref(0)
const tocando = ref(false)
const velocidade = ref(1)
let timer = null
const parar = () => { tocando.value = false; clearInterval(timer); timer = null }
const tocar = () => {
  if (!paradas.value.length) return
  if (cursor.value >= paradas.value.length - 1) cursor.value = 0
  tocando.value = true
  clearInterval(timer)
  timer = setInterval(() => {
    if (cursor.value >= paradas.value.length - 1) return parar()
    cursor.value++
  }, 700 / velocidade.value)
}
watch(velocidade, () => { if (tocando.value) tocar() })
watch(trajeto, () => { parar(); cursor.value = Math.max(0, paradas.value.length - 1) }, { immediate: true })
onBeforeUnmount(parar)
const atual = computed(() => paradas.value[cursor.value] || null)

// Leituras do usuário por área até o cursor (cor das áreas).
const leiturasPorArea = computed(() => {
  const mapa = new Map()
  paradas.value.slice(0, cursor.value + 1).forEach(p => mapa.set(p.bloco, (mapa.get(p.bloco) || 0) + p.leituras))
  return mapa
})
const maiorArea = computed(() => Math.max(1, ...trajeto.value.areas.map(a => a.leituras)))
const TONS = ['#dbeafe', '#bfdbfe', '#93c5fd', '#60a5fa', '#3b82f6']
const corArea = (bloco) => {
  const n = leiturasPorArea.value.get(bloco)
  if (!n) return '#f1f5f9'
  return TONS[Math.min(4, Math.floor((n / maiorArea.value) * 4.999))]
}

// Cor do caminho pelo horário: do azul claro (início) ao azul escuro (fim).
const corTempo = (i) => {
  const t = paradas.value.length > 1 ? i / (paradas.value.length - 1) : 1
  const de = [125, 211, 252]
  const ate = [30, 58, 138]
  return `rgb(${de.map((c, k) => Math.round(c + (ate[k] - c) * t)).join(',')})`
}
const segmentos = computed(() => {
  const lista = []
  let anterior = null
  paradas.value.forEach((p, i) => {
    const ponto = pontos.value[i]
    if (!ponto) return
    if (anterior && i <= cursor.value) lista.push({ i, de: anterior, ate: ponto, cor: corTempo(i), pausa: p.aposPausa })
    anterior = ponto
  })
  return lista
})
const marcadores = computed(() => paradas.value
  .map((p, i) => ({ ...p, i, ponto: pontos.value[i] }))
  .filter(p => p.ponto && p.i <= cursor.value))
const raio = n => Math.min(0.9, 0.3 + Math.sqrt(n) * 0.09)

const rotuloArea = (p) => {
  const area = areas.value.get(p.id) || { bloco: p.id, ...interpretarLocal(p.id) }
  return area.tipo === 'gondola' ? p.id.slice(1) : nomeArea(area)
}

// ---------- Linha do tempo ----------
const span = computed(() => Math.max(60000, (trajeto.value.fim ?? 0) - (trajeto.value.inicio ?? 0)))
const CORES_TIPO = { gondola: '#3b82f6', liquida: '#06b6d4', freezer: '#8b5cf6', paredaoFrios: '#a855f7', emporio: '#f59e0b', acougue: '#ef4444', flv: '#22c55e', outro: '#64748b' }
const faixa = computed(() => paradas.value.map((p, i) => ({
  i,
  esquerda: ((p.inicio - trajeto.value.inicio) / span.value) * 100,
  largura: Math.max(0.35, ((Math.max(p.fim, p.inicio + 30000) - p.inicio) / span.value) * 100),
  cor: CORES_TIPO[p.tipo] || CORES_TIPO.outro,
  titulo: `${horaDe(p.inicio)} · ${p.local} · ${p.leituras} leitura(s)`
})))
const marcasHora = computed(() => {
  if (trajeto.value.inicio === null) return []
  const lista = []
  const hora = 3600000
  for (let t = Math.ceil(trajeto.value.inicio / hora) * hora; t <= trajeto.value.fim; t += hora) {
    lista.push({ t, pos: ((t - trajeto.value.inicio) / span.value) * 100, rotulo: horaDe(t).slice(0, 2) + 'h' })
  }
  return lista
})
// Leituras por 15 minutos (barras sobre a faixa).
const blocos15 = computed(() => {
  if (trajeto.value.inicio === null) return []
  const passo = 15 * 60000
  const base = Math.floor(trajeto.value.inicio / passo) * passo
  const qtd = Math.floor((trajeto.value.fim - base) / passo) + 1
  const lista = Array.from({ length: qtd }, (_, k) => ({ inicio: base + k * passo, n: 0 }))
  for (const l of leituras.value.porDia.get(dia.value) || []) lista[Math.floor((l.instante - base) / passo)].n++
  return lista
})
const maior15 = computed(() => Math.max(1, ...blocos15.value.map(b => b.n)))

const listaParadas = ref(null)
watch(cursor, async (i) => {
  await nextTick()
  listaParadas.value?.querySelector(`[data-parada="${i}"]`)?.scrollIntoView({ block: 'nearest' })
})

const indicadores = computed(() => {
  const t = trajeto.value
  return [
    { rotulo: 'Primeira leitura', valor: t.inicio === null ? '—' : horaDe(t.inicio) },
    { rotulo: 'Última leitura', valor: t.fim === null ? '—' : horaDe(t.fim) },
    { rotulo: 'Tempo ativo', valor: formatarDuracao(t.ativo), detalhe: t.pausas ? `${t.pausas} pausa(s) · ${formatarDuracao(t.tempoPausado)}` : 'sem pausas' },
    { rotulo: 'Leituras', valor: t.leituras.toLocaleString('pt-BR'), detalhe: `${Math.round(t.ritmo)}/h no tempo ativo` },
    { rotulo: 'Paradas', valor: t.paradas.length.toLocaleString('pt-BR'), detalhe: `${t.trocasArea} trocas de área` },
    { rotulo: 'Áreas visitadas', valor: t.areas.length, detalhe: t.areas[0] ? `mais tempo: ${t.areas[0].area}` : '' }
  ]
})
</script>

<template>
  <section class="rounded-2xl bg-white p-5 shadow-sm">
    <div class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h3 class="text-lg font-bold text-slate-900"><i class="fas fa-route mr-2 text-blue-600"></i>Mapa histórico do usuário</h3>
        <p class="text-xs text-slate-500">Leituras ao longo do dia e o caminho pela loja, na ordem do horário de cada leitura.</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <select v-model="usuario" class="ui-input w-auto max-w-72 py-2 text-sm" aria-label="Usuário">
          <option v-for="u in usuarios" :key="u.nome" :value="u.nome">{{ rotuloUsuario(u.nome) }} · {{ u.leituras }}</option>
        </select>
        <select v-if="dias.length > 1" v-model="dia" class="ui-input w-auto py-2 text-sm" aria-label="Dia">
          <option v-for="d in dias" :key="d" :value="d">{{ d.split('-').reverse().join('/') }} · {{ leituras.porDia.get(d).length }}</option>
        </select>
      </div>
    </div>

    <div v-if="!paradas.length" class="mt-5 rounded-xl bg-slate-50 px-6 py-10 text-center">
      <i class="fas fa-clock text-2xl text-slate-300"></i>
      <p class="mt-2 text-sm font-semibold text-slate-700">Sem leituras com horário para este usuário</p>
      <p class="mt-1 text-xs text-slate-500">O trajeto usa a coluna "Auditado em" com data e hora de cada leitura.</p>
    </div>

    <template v-else>
      <!-- Indicadores -->
      <div class="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <div v-for="k in indicadores" :key="k.rotulo" class="rounded-xl bg-slate-50 p-3">
          <p class="text-xs font-semibold text-slate-500">{{ k.rotulo }}</p>
          <p class="mt-0.5 text-xl font-black text-slate-900">{{ k.valor }}</p>
          <p v-if="k.detalhe" class="truncate text-[11px] text-slate-500" :title="k.detalhe">{{ k.detalhe }}</p>
        </div>
      </div>

      <!-- Linha do tempo -->
      <div class="mt-4 rounded-xl bg-slate-50 p-4">
        <div class="flex flex-wrap items-center gap-2">
          <button type="button" class="ui-btn-primary py-1.5" :aria-label="tocando ? 'Pausar' : 'Reproduzir'" @click="tocando ? parar() : tocar()">
            <i :class="tocando ? 'fas fa-pause' : 'fas fa-play'"></i>{{ tocando ? 'Pausar' : 'Reproduzir' }}
          </button>
          <div class="flex rounded-lg bg-white p-0.5 text-xs shadow-sm">
            <button v-for="v in [1, 2, 4]" :key="v" type="button" class="rounded-md px-2 py-1 font-bold" :class="velocidade === v ? 'bg-blue-600 text-white' : 'text-slate-600'" @click="velocidade = v">{{ v }}×</button>
          </div>
          <button type="button" class="ui-btn-secondary py-1.5 text-xs" @click="parar(); cursor = paradas.length - 1">Dia completo</button>
          <span v-if="atual" class="ml-auto text-sm text-slate-600">
            <b class="text-slate-900">{{ horaDe(atual.inicio) }}</b><template v-if="atual.fim > atual.inicio">–{{ horaDe(atual.fim) }}</template>
            · <b class="text-slate-900">{{ atual.local }}</b> · {{ atual.leituras }} leitura(s) · parada {{ cursor + 1 }} de {{ paradas.length }}
          </span>
        </div>
        <input v-model.number="cursor" type="range" min="0" :max="paradas.length - 1" class="mt-3 w-full accent-blue-600" aria-label="Momento do trajeto" @input="parar">
        <!-- Volume por 15 min -->
        <div class="mt-2 flex h-10 items-end gap-px">
          <span v-for="b in blocos15" :key="b.inicio" class="flex-1 rounded-t-sm bg-blue-300" :style="{ height: `${(b.n / maior15) * 100}%`, minHeight: b.n ? '2px' : '0' }" :title="`${horaDe(b.inicio)}: ${b.n} leituras`"></span>
        </div>
        <!-- Paradas no tempo -->
        <div class="relative mt-1 h-5 rounded bg-white ring-1 ring-slate-200">
          <button v-for="s in faixa" :key="s.i" type="button" class="absolute top-0.5 bottom-0.5 rounded-sm transition" :class="s.i === cursor ? 'ring-2 ring-slate-900 z-10' : s.i > cursor ? 'opacity-30' : ''"
            :style="{ left: `${s.esquerda}%`, width: `${s.largura}%`, background: s.cor }" :title="s.titulo" @click="parar(); cursor = s.i"></button>
        </div>
        <div class="relative mt-1 h-4 text-[10px] font-semibold text-slate-400">
          <span v-for="m in marcasHora" :key="m.t" class="absolute -translate-x-1/2" :style="{ left: `${m.pos}%` }">{{ m.rotulo }}</span>
        </div>
      </div>

      <div class="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <!-- Mapa com o caminho -->
        <div class="overflow-x-auto rounded-xl bg-slate-50 p-3">
          <svg :viewBox="`-0.5 -0.5 ${layout.colunas + 1} ${layout.linhas + 1}`" class="min-w-[640px] w-full" role="img" :aria-label="`Trajeto de ${rotuloUsuario(usuario)}`">
            <g v-for="p in posicoes" :key="p.id">
              <rect :x="p.x + 0.08" :y="p.y + 0.08" :width="p.w - 0.16" :height="p.h - 0.16" rx="0.35"
                :fill="corArea(p.id)" :stroke="atual?.bloco === p.id ? '#0f172a' : '#cbd5e1'" :stroke-width="atual?.bloco === p.id ? 0.18 : 0.06" />
              <text :x="p.x + p.w / 2" :y="p.y + p.h / 2" text-anchor="middle" dominant-baseline="central" font-size="0.75" font-weight="800" fill="#475569" opacity="0.75">{{ rotuloArea(p) }}</text>
            </g>
            <line v-for="s in segmentos" :key="`s${s.i}`" :x1="s.de.x" :y1="s.de.y" :x2="s.ate.x" :y2="s.ate.y"
              :stroke="s.cor" stroke-width="0.28" stroke-linecap="round" :stroke-dasharray="s.pausa ? '0.5 0.45' : ''" opacity="0.9" />
            <circle v-for="m in marcadores" :key="`m${m.i}`" :cx="m.ponto.x" :cy="m.ponto.y" :r="raio(m.leituras)"
              :fill="corTempo(m.i)" stroke="#fff" stroke-width="0.1" class="cursor-pointer" @click="parar(); cursor = m.i">
              <title>{{ horaDe(m.inicio) }} · {{ m.local }} · {{ m.leituras }} leitura(s)</title>
            </circle>
            <template v-if="marcadores.length">
              <circle :cx="marcadores[0].ponto.x" :cy="marcadores[0].ponto.y" r="0.55" fill="#10b981" stroke="#fff" stroke-width="0.14" />
              <text :x="marcadores[0].ponto.x" :y="marcadores[0].ponto.y - 0.95" text-anchor="middle" font-size="0.8" font-weight="900" fill="#047857">Início</text>
            </template>
            <g v-if="atual && pontos[cursor]">
              <circle :cx="pontos[cursor].x" :cy="pontos[cursor].y" r="1.1" fill="#f97316" opacity="0.25">
                <animate attributeName="r" values="0.8;1.4;0.8" dur="1.4s" repeatCount="indefinite" />
              </circle>
              <circle :cx="pontos[cursor].x" :cy="pontos[cursor].y" r="0.6" fill="#f97316" stroke="#fff" stroke-width="0.14" />
            </g>
          </svg>
          <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600">
            <span><i class="mr-1 inline-block size-2.5 rounded-full bg-emerald-500"></i>Início</span>
            <span><i class="mr-1 inline-block size-2.5 rounded-full bg-orange-500"></i>Posição no momento</span>
            <span class="inline-flex items-center gap-1">Caminho<i class="inline-block h-1.5 w-10 rounded-full" style="background: linear-gradient(90deg, rgb(125,211,252), rgb(30,58,138))"></i>mais tarde</span>
            <span>tracejado: após pausa de {{ PAUSA_MINUTOS }}+ min</span>
            <span>bolinha maior = mais leituras na parada</span>
            <span v-if="foraDoMapa" class="text-amber-700">{{ foraDoMapa }} parada(s) em locais fora do mapa</span>
            <span v-if="leituras.semHorario" class="text-slate-500">{{ leituras.semHorario }} leitura(s) sem horário</span>
          </div>
        </div>

        <!-- Paradas -->
        <div class="flex max-h-[560px] flex-col rounded-xl ring-1 ring-slate-200">
          <p class="border-b border-slate-100 px-3 py-2 text-xs font-semibold text-slate-500">Paradas na ordem</p>
          <ol ref="listaParadas" class="flex-1 overflow-y-auto">
            <li v-for="(p, i) in paradas" :key="i" :data-parada="i">
              <p v-if="p.aposPausa" class="bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700"><i class="fas fa-mug-hot mr-1"></i>Pausa de {{ formatarDuracao(p.pausaAntes) }}</p>
              <button type="button" class="flex w-full items-center gap-2 border-b border-slate-50 px-3 py-2 text-left text-sm transition hover:bg-blue-50/60"
                :class="i === cursor ? 'bg-orange-50' : i > cursor ? 'opacity-50' : ''" @click="parar(); cursor = i">
                <span class="w-7 shrink-0 text-[11px] font-bold text-slate-400">{{ i + 1 }}</span>
                <span class="w-[86px] shrink-0 tabular-nums text-xs font-semibold text-slate-600">{{ horaDe(p.inicio) }}<template v-if="p.fim > p.inicio">–{{ horaDe(p.fim) }}</template></span>
                <span class="min-w-0 flex-1 truncate font-bold text-slate-900">{{ p.local }}<span class="ml-1 text-[11px] font-medium text-slate-400">{{ p.area !== p.local ? p.area : '' }}</span></span>
                <span class="shrink-0 rounded-full bg-slate-100 px-2 text-xs font-bold text-slate-700">{{ p.leituras }}</span>
              </button>
            </li>
          </ol>
        </div>
      </div>
    </template>
  </section>
</template>
