<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  TIPOS_AREA,
  agregarPorArea,
  carregarLayoutSalvo,
  gerarLayoutPadrao,
  interpretarLocal,
  limparLayoutSalvo,
  mesclarLayout,
  nomeArea,
  percentualPendente,
  salvarLayout
} from '../utils/mapaLoja'
import { META_PENDENTE_PERCENTUAL } from '../utils/metricasAuditoria'
import { rotuloUsuario, separarUsuario } from '../utils/usuario'

// Mapa visual da loja: cada área (corredor, freezer, açougue...) colorida pelos dados da auditoria.
// O layout pode ser rearranjado pelo usuário e fica salvo neste navegador.
const props = defineProps({
  auditoria: { type: Object, required: true },
  isItemLido: { type: Function, required: true }
})
const emit = defineEmits(['ver-itens'])
const META = META_PENDENTE_PERCENTUAL

const areas = computed(() => agregarPorArea(props.auditoria, props.isItemLido))
const areasMapeaveis = computed(() => [...areas.value.values()].filter(a => a.tipo !== 'outro'))
const outros = computed(() => [...areas.value.values()].filter(a => a.tipo === 'outro').sort((a, b) => b.pendentes - a.pendentes))

// ---------- Layout ----------
const salvo = ref(carregarLayoutSalvo())
const layout = computed(() => mesclarLayout(gerarLayoutPadrao(areasMapeaveis.value), salvo.value))
const editando = ref(false)
const persistir = (posicoes) => {
  salvo.value = { colunas: layout.value.colunas, linhas: layout.value.linhas, posicoes }
  salvarLayout(salvo.value)
}
const atualizarPosicao = (id, mudanca) => {
  persistir(layout.value.posicoes.map(p => (p.id === id ? { ...p, ...mudanca } : p)))
}
const restaurarPadrao = () => {
  limparLayoutSalvo()
  salvo.value = null
}
const colunasVisiveis = computed(() => layout.value.colunas + (editando.value ? 4 : 0))
const linhasVisiveis = computed(() => layout.value.linhas + (editando.value ? 4 : 0))

// Tamanho da célula acompanha a largura disponível.
const palco = ref(null)
const larguraPalco = ref(900)
let observador
onMounted(() => {
  observador = new ResizeObserver(([e]) => { larguraPalco.value = e.contentRect.width })
  if (palco.value) observador.observe(palco.value)
})
onBeforeUnmount(() => observador?.disconnect())
const celula = computed(() => Math.max(12, larguraPalco.value / colunasVisiveis.value))

// ---------- Arrastar / redimensionar (modo edição) ----------
let arraste = null
const iniciarArraste = (evento, posicao, modo = 'mover') => {
  if (!editando.value) return
  evento.preventDefault()
  evento.stopPropagation()
  selecionado.value = posicao.id
  arraste = { id: posicao.id, modo, x0: evento.clientX, y0: evento.clientY, inicial: { ...posicao } }
  window.addEventListener('pointermove', moverArraste)
  window.addEventListener('pointerup', terminarArraste, { once: true })
}
const moverArraste = (evento) => {
  if (!arraste) return
  const dx = Math.round((evento.clientX - arraste.x0) / celula.value)
  const dy = Math.round((evento.clientY - arraste.y0) / celula.value)
  const i = arraste.inicial
  const mudanca = arraste.modo === 'mover'
    ? { x: Math.max(0, i.x + dx), y: Math.max(0, i.y + dy) }
    : { w: Math.max(1, i.w + dx), h: Math.max(1, i.h + dy) }
  const atual = layout.value.posicoes.find(p => p.id === arraste.id)
  if (atual && Object.keys(mudanca).some(k => atual[k] !== mudanca[k])) atualizarPosicao(arraste.id, mudanca)
}
const terminarArraste = () => {
  arraste = null
  window.removeEventListener('pointermove', moverArraste)
}
onBeforeUnmount(terminarArraste)

// Teclado no modo edição: setas movem a área selecionada.
const aoTeclar = (evento) => {
  if (!editando.value || !posicaoSelecionada.value) return
  const passos = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[evento.key]
  if (!passos) return
  evento.preventDefault()
  const p = posicaoSelecionada.value
  atualizarPosicao(p.id, { x: Math.max(0, p.x + passos[0]), y: Math.max(0, p.y + passos[1]) })
}

// ---------- Cores ----------
const modo = ref('pendente') // pendente | leituras | usuario
const usuarioFoco = ref('')
const usuarios = computed(() => {
  const total = new Map()
  for (const a of areas.value.values()) for (const [u, n] of a.usuarios) total.set(u, (total.get(u) || 0) + n)
  return [...total].sort((a, b) => b[1] - a[1]).map(([nome, leituras]) => ({ nome, leituras, ...separarUsuario(nome) }))
})
const maiorLeitura = computed(() => Math.max(1, ...[...areas.value.values()].map(a => (modo.value === 'usuario' ? a.usuarios.get(usuarioFoco.value) || 0 : a.lidos + a.comProblema))))
const TONS_AZUL = ['bg-blue-100 text-blue-900', 'bg-blue-200 text-blue-900', 'bg-blue-400 text-white', 'bg-blue-600 text-white', 'bg-blue-800 text-white']

const classeDados = (d) => {
  if (!d || !d.total) return 'bg-slate-100 text-slate-400'
  if (modo.value === 'pendente') {
    if (!d.lidos && !d.comProblema) return 'bg-slate-700 text-white'
    const p = percentualPendente(d)
    if (p <= META) return 'bg-emerald-500 text-white'
    if (p <= META * 2) return 'bg-amber-400 text-amber-950'
    return 'bg-red-500 text-white'
  }
  const valor = modo.value === 'usuario' ? (d.usuarios?.get(usuarioFoco.value) || 0) : d.lidos + d.comProblema
  if (!valor) return 'bg-slate-100 text-slate-400'
  return TONS_AZUL[Math.min(4, Math.floor((valor / maiorLeitura.value) * 4.999))]
}
// Faces herdam a contagem de usuários da área (a planilha não separa usuário por face).
const classeFace = (area, face) => classeDados(modo.value === 'pendente' ? area?.faces?.[face] : area)
const valorTexto = (d) => {
  if (!d?.total) return ''
  if (modo.value === 'pendente') return `${percentualPendente(d).toFixed(1)}%`
  if (modo.value === 'usuario') return String(d.usuarios?.get(usuarioFoco.value) || '')
  return String(d.lidos + d.comProblema)
}
watch(modo, v => { if (v === 'usuario' && !usuarioFoco.value) usuarioFoco.value = usuarios.value[0]?.nome || '' })

// ---------- Seleção ----------
const selecionado = ref(null)
const hover = ref(null)
const posicaoSelecionada = computed(() => layout.value.posicoes.find(p => p.id === selecionado.value) || null)
const areaSelecionada = computed(() => (selecionado.value ? areas.value.get(selecionado.value) || { bloco: selecionado.value, tipo: interpretarLocal(selecionado.value).tipo, numero: interpretarLocal(selecionado.value).numero, lidos: 0, pendentes: 0, comProblema: 0, total: 0, faces: {}, usuarios: new Map(), locais: new Set() } : null))
const usuariosDaArea = computed(() => [...(areaSelecionada.value?.usuarios || new Map())].sort((a, b) => b[1] - a[1]).map(([nome, n]) => ({ nome, n, ...separarUsuario(nome) })))
const maiorUsuarioArea = computed(() => Math.max(1, ...usuariosDaArea.value.map(u => u.n)))
const rotuloPersonalizado = id => layout.value.posicoes.find(p => p.id === id)?.rotulo
const titulo = (area) => rotuloPersonalizado(area?.bloco) || nomeArea(area)

const criticas = computed(() => [...areas.value.values()]
  .filter(a => a.total && a.pendentes)
  .sort((a, b) => percentualPendente(b) - percentualPendente(a) || b.pendentes - a.pendentes)
  .slice(0, 6))

const verItens = (area) => {
  const locais = area.locais
  const itens = (props.auditoria?.dados || []).filter(i => interpretarLocal(i?.['Local']).bloco === area.bloco || locais.has(i?.['Local']))
  emit('ver-itens', { local: titulo(area), itens })
}

const resumo = computed(() => {
  const lista = areasMapeaveis.value
  // Conta áreas inteiras e faces de corredor sem nenhuma leitura.
  const vazio = d => d?.total && !d.lidos && !d.comProblema
  const semLeitura = lista.reduce((n, a) => n + (a.tipo === 'gondola' ? Object.values(a.faces).filter(vazio).length : vazio(a) ? 1 : 0), 0)
  const acima = lista.filter(a => a.total && percentualPendente(a) > META).length
  return { areas: lista.length, semLeitura, acima, corredores: lista.filter(a => a.tipo === 'gondola').length }
})

const faces = ['A', 'B', 'C', 'D']
const tamanhoFonte = computed(() => Math.max(9, Math.min(15, celula.value * 0.6)))
</script>

<template>
  <div class="space-y-4" tabindex="-1" @keydown="aoTeclar">
    <!-- Barra de ferramentas -->
    <div class="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
      <div class="flex flex-wrap items-center gap-2">
        <div class="flex rounded-xl bg-slate-100 p-1 text-sm">
          <button v-for="[v, r, i] in [['pendente', '% pendente', 'fas fa-percent'], ['leituras', 'Leituras', 'fas fa-barcode'], ['usuario', 'Por usuário', 'fas fa-user']]" :key="v" type="button"
            class="rounded-lg px-3 py-1.5 font-semibold transition" :class="modo === v ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'" @click="modo = v">
            <i :class="[i, 'mr-1 text-xs']"></i>{{ r }}
          </button>
        </div>
        <select v-if="modo === 'usuario'" v-model="usuarioFoco" class="ui-input w-auto max-w-72 py-2 text-sm" aria-label="Usuário">
          <option v-for="u in usuarios" :key="u.nome" :value="u.nome">{{ rotuloUsuario(u.nome) }} · {{ u.leituras }}</option>
        </select>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <template v-if="editando">
          <span class="text-xs text-slate-500"><i class="fas fa-hand-pointer mr-1"></i>Arraste para mover · canto para redimensionar · setas ajustam</span>
          <button type="button" class="ui-btn-secondary py-2" @click="restaurarPadrao"><i class="fas fa-rotate-left"></i>Layout padrão</button>
          <button type="button" class="ui-btn-primary py-2" @click="editando = false"><i class="fas fa-check"></i>Concluir</button>
        </template>
        <button v-else type="button" class="ui-btn-secondary py-2" @click="editando = true"><i class="fas fa-pen-ruler"></i>Editar layout</button>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <!-- Mapa -->
      <section class="overflow-hidden rounded-2xl bg-white p-4 shadow-sm">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span><b class="text-slate-800">{{ resumo.corredores }}</b> corredores · <b class="text-slate-800">{{ resumo.areas }}</b> áreas · <b :class="resumo.acima ? 'text-red-700' : 'text-emerald-700'">{{ resumo.acima }}</b> acima da meta · <b :class="resumo.semLeitura ? 'text-slate-900' : ''">{{ resumo.semLeitura }}</b> sem leitura</span>
          <span><i class="fas fa-arrow-left mr-1"></i>Freezers · corredores numerados da direita para a esquerda · Líquida<i class="fas fa-arrow-right ml-1"></i></span>
        </div>
        <div class="overflow-x-auto">
          <div
            ref="palco"
            class="relative min-w-[640px] rounded-xl bg-slate-50"
            :class="editando ? 'ring-2 ring-blue-200' : ''"
            :style="{
              height: `${linhasVisiveis * celula}px`,
              backgroundImage: editando ? 'linear-gradient(#e2e8f0 1px, transparent 1px), linear-gradient(90deg, #e2e8f0 1px, transparent 1px)' : 'none',
              backgroundSize: `${celula}px ${celula}px`,
              fontSize: `${tamanhoFonte}px`
            }"
            @click.self="selecionado = null"
          >
            <div
              v-for="p in layout.posicoes"
              :key="p.id"
              class="group absolute select-none"
              :class="[editando ? 'cursor-move' : 'cursor-pointer', selecionado === p.id ? 'z-20' : 'z-10']"
              :style="{ left: `${p.x * celula}px`, top: `${p.y * celula}px`, width: `${p.w * celula}px`, height: `${p.h * celula}px`, padding: `${Math.max(1, celula * 0.08)}px` }"
              @pointerdown="iniciarArraste($event, p)"
              @click="selecionado = p.id"
              @mouseenter="hover = p.id"
              @mouseleave="hover = null"
            >
              <!-- Corredor: C/D em cima e A/B embaixo (A de frente para B, C de frente para D) -->
              <div v-if="(areas.get(p.id)?.tipo || interpretarLocal(p.id).tipo) === 'gondola'" class="relative flex h-full overflow-hidden rounded-lg ring-1 ring-slate-300 transition" :class="[selecionado === p.id ? 'ring-4 ring-blue-500' : 'group-hover:ring-2 group-hover:ring-blue-400', p.w < p.h ? 'flex-col' : 'flex-row']">
                <div v-for="(par, k) in [['C', 'D'], ['A', 'B']]" :key="k" class="flex min-h-0 min-w-0 flex-1" :class="p.w < p.h ? 'flex-row' : 'flex-col'">
                  <div class="flex min-h-0 min-w-0 flex-1 items-center justify-center font-bold leading-none" :class="classeFace(areas.get(p.id), par[0])" :title="`${p.id}${par[0]}`">
                    <span class="truncate">{{ par[0] }}</span>
                  </div>
                  <div class="flex shrink-0 items-center justify-center bg-white text-[0.75em] font-black text-slate-400" :style="p.w < p.h ? { width: '28%' } : { height: '28%' }"></div>
                  <div class="flex min-h-0 min-w-0 flex-1 items-center justify-center font-bold leading-none" :class="classeFace(areas.get(p.id), par[1])" :title="`${p.id}${par[1]}`">
                    <span class="truncate">{{ par[1] }}</span>
                  </div>
                </div>
                <span class="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center rounded bg-white/95 px-1 py-0.5 leading-none shadow-sm">
                  <span class="text-[0.95em] font-black text-slate-800">{{ rotuloPersonalizado(p.id) || p.id.slice(1) }}</span>
                  <span v-if="valorTexto(areas.get(p.id))" class="mt-0.5 text-[0.7em] font-bold text-slate-500">{{ valorTexto(areas.get(p.id)) }}</span>
                </span>
              </div>

              <!-- Demais áreas -->
              <div v-else class="flex h-full flex-col items-center justify-center overflow-hidden rounded-lg px-1 text-center leading-tight ring-1 ring-black/5 transition" :class="[classeDados(areas.get(p.id)), selecionado === p.id ? 'ring-4 ring-blue-500' : 'group-hover:ring-2 group-hover:ring-blue-400']">
                <span class="max-w-full truncate font-black">{{ rotuloPersonalizado(p.id) || nomeArea(areas.get(p.id) || { bloco: p.id, ...interpretarLocal(p.id) }) }}</span>
                <span v-if="p.h > 1 && valorTexto(areas.get(p.id))" class="text-[0.85em] font-semibold opacity-90">{{ valorTexto(areas.get(p.id)) }}</span>
              </div>

              <span v-if="editando" class="absolute -bottom-1 -right-1 size-3.5 cursor-se-resize rounded-sm bg-blue-600 ring-2 ring-white" @pointerdown="iniciarArraste($event, p, 'tamanho')"></span>

              <!-- Dica ao passar o mouse -->
              <div v-if="hover === p.id && !editando && areas.get(p.id)" class="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1 w-max max-w-56 -translate-x-1/2 rounded-lg bg-slate-900 px-2.5 py-1.5 text-left text-[11px] leading-snug text-white shadow-lg">
                <b>{{ titulo(areas.get(p.id)) }}</b><br>
                {{ percentualPendente(areas.get(p.id)).toFixed(1) }}% pendente · {{ areas.get(p.id).pendentes }} pend. · {{ areas.get(p.id).lidos }} lidos
              </div>
            </div>
          </div>
        </div>

        <!-- Legenda -->
        <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600">
          <template v-if="modo === 'pendente'">
            <span><i class="mr-1 inline-block size-3 rounded bg-emerald-500 align-[-2px]"></i>Até {{ META }}%</span>
            <span><i class="mr-1 inline-block size-3 rounded bg-amber-400 align-[-2px]"></i>Até {{ META * 2 }}%</span>
            <span><i class="mr-1 inline-block size-3 rounded bg-red-500 align-[-2px]"></i>Acima de {{ META * 2 }}%</span>
            <span><i class="mr-1 inline-block size-3 rounded bg-slate-700 align-[-2px]"></i>Sem leitura</span>
          </template>
          <template v-else>
            <span>Menos</span><span v-for="t in TONS_AZUL" :key="t" class="inline-block size-3 rounded" :class="t.split(' ')[0]"></span><span>Mais leituras{{ modo === 'usuario' ? ' do usuário' : '' }}</span>
          </template>
          <span><i class="mr-1 inline-block size-3 rounded bg-slate-100 ring-1 ring-slate-200 align-[-2px]"></i>Sem itens nesta auditoria</span>
        </div>

        <div v-if="outros.length" class="mt-4 rounded-xl bg-slate-50 p-3">
          <p class="text-xs font-bold text-slate-600">Locais fora do padrão do mapa ({{ outros.length }})</p>
          <div class="mt-2 flex flex-wrap gap-1.5">
            <button v-for="o in outros" :key="o.bloco" type="button" class="rounded-lg bg-white px-2 py-1 text-xs font-semibold shadow-sm hover:ring-2 hover:ring-blue-300" @click="selecionado = o.bloco">
              {{ o.bloco }} <span :class="percentualPendente(o) > META ? 'text-red-700' : 'text-slate-500'">{{ percentualPendente(o).toFixed(1) }}%</span>
            </button>
          </div>
        </div>
      </section>

      <!-- Painel lateral -->
      <aside class="space-y-4">
        <section v-if="areaSelecionada" class="ui-fade-in rounded-2xl bg-white p-5 shadow-sm">
          <div class="flex items-start justify-between gap-2">
            <div>
              <p class="text-[11px] font-bold uppercase tracking-wider text-slate-500"><i :class="[TIPOS_AREA[areaSelecionada.tipo]?.icone, 'mr-1']"></i>{{ TIPOS_AREA[areaSelecionada.tipo]?.nome }}</p>
              <p class="text-xl font-black text-slate-900">{{ titulo(areaSelecionada) }}</p>
              <p class="text-xs text-slate-500">{{ areaSelecionada.bloco }}</p>
            </div>
            <button type="button" class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Fechar" @click="selecionado = null"><i class="fas fa-times"></i></button>
          </div>

          <div class="mt-4 grid grid-cols-3 gap-2 text-center">
            <div class="rounded-xl bg-slate-50 py-2"><p class="text-lg font-black">{{ areaSelecionada.lidos }}</p><p class="text-[10px] text-slate-500">lidos</p></div>
            <div class="rounded-xl bg-amber-50 py-2"><p class="text-lg font-black text-amber-800">{{ areaSelecionada.pendentes }}</p><p class="text-[10px] text-amber-700">pendentes</p></div>
            <div class="rounded-xl py-2" :class="percentualPendente(areaSelecionada) > META ? 'bg-red-50' : 'bg-emerald-50'">
              <p class="text-lg font-black" :class="percentualPendente(areaSelecionada) > META ? 'text-red-700' : 'text-emerald-700'">{{ percentualPendente(areaSelecionada).toFixed(1) }}%</p>
              <p class="text-[10px] text-slate-500">pendente</p>
            </div>
          </div>

          <table v-if="areaSelecionada.tipo === 'gondola'" class="mt-4 w-full text-sm">
            <thead class="text-[11px] uppercase text-slate-500"><tr><th class="py-1 text-left">Face</th><th class="text-right">Lidos</th><th class="text-right">Pend.</th><th class="text-right">%</th></tr></thead>
            <tbody>
              <tr v-for="f in faces" :key="f" class="border-t border-slate-100">
                <td class="py-1.5 font-bold">{{ areaSelecionada.bloco }}{{ f }}</td>
                <td class="text-right">{{ areaSelecionada.faces[f]?.lidos ?? '—' }}</td>
                <td class="text-right text-amber-700">{{ areaSelecionada.faces[f]?.pendentes ?? '—' }}</td>
                <td class="text-right font-bold" :class="percentualPendente(areaSelecionada.faces[f]) > META ? 'text-red-700' : 'text-emerald-700'">{{ areaSelecionada.faces[f] ? percentualPendente(areaSelecionada.faces[f]).toFixed(1) + '%' : '—' }}</td>
              </tr>
            </tbody>
          </table>

          <div class="mt-4">
            <p class="text-xs font-bold text-slate-700">Quem leu aqui</p>
            <p v-if="!usuariosDaArea.length" class="mt-1 text-xs text-slate-500">Nenhuma leitura registrada.</p>
            <ul v-else class="mt-2 space-y-2">
              <li v-for="u in usuariosDaArea" :key="u.nome" class="text-xs">
                <div class="flex justify-between gap-2"><span class="truncate font-semibold text-slate-800">{{ u.nome && u.matricula ? `${separarUsuario(u.nome).nome}` : u.nome }}<span v-if="u.matricula" class="ml-1 font-normal text-slate-400">{{ u.matricula }}</span></span><span class="shrink-0 font-bold">{{ u.n }}</span></div>
                <div class="mt-1 h-1.5 rounded-full bg-slate-100"><div class="h-full rounded-full bg-blue-600" :style="{ width: `${(u.n / maiorUsuarioArea) * 100}%` }"></div></div>
              </li>
            </ul>
          </div>

          <button v-if="areaSelecionada.total" type="button" class="ui-btn-secondary mt-4 w-full py-2" @click="verItens(areaSelecionada)"><i class="fas fa-list"></i>Ver itens</button>

          <!-- Ajustes da área (modo edição) -->
          <div v-if="editando && posicaoSelecionada" class="mt-4 space-y-3 rounded-xl bg-blue-50 p-3">
            <p class="text-xs font-bold text-blue-900"><i class="fas fa-pen-ruler mr-1"></i>Ajustar área</p>
            <label class="block">
              <span class="ui-label">Nome no mapa</span>
              <input :value="posicaoSelecionada.rotulo || ''" class="ui-input py-1.5 text-sm" :placeholder="nomeArea(areaSelecionada)" maxlength="30" @change="e => atualizarPosicao(posicaoSelecionada.id, { rotulo: e.target.value.trim() || undefined })">
            </label>
            <div class="grid grid-cols-2 gap-2">
              <label class="block"><span class="ui-label">Largura</span><input type="number" min="1" max="60" :value="posicaoSelecionada.w" class="ui-input py-1.5 text-sm" @change="e => atualizarPosicao(posicaoSelecionada.id, { w: Math.max(1, Number(e.target.value) || 1) })"></label>
              <label class="block"><span class="ui-label">Altura</span><input type="number" min="1" max="60" :value="posicaoSelecionada.h" class="ui-input py-1.5 text-sm" @change="e => atualizarPosicao(posicaoSelecionada.id, { h: Math.max(1, Number(e.target.value) || 1) })"></label>
            </div>
            <button type="button" class="ui-btn-secondary w-full py-1.5 text-xs" @click="atualizarPosicao(posicaoSelecionada.id, { w: posicaoSelecionada.h, h: posicaoSelecionada.w })"><i class="fas fa-rotate"></i>Girar</button>
          </div>
        </section>

        <section v-else class="rounded-2xl bg-white p-5 shadow-sm">
          <p class="text-sm font-bold text-slate-900">Áreas mais críticas</p>
          <p class="text-xs text-slate-500">Clique para localizar no mapa.</p>
          <p v-if="!criticas.length" class="mt-3 text-sm text-slate-500">Nenhuma área com pendências.</p>
          <ul v-else class="mt-3 space-y-1.5">
            <li v-for="a in criticas" :key="a.bloco">
              <button type="button" class="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-slate-50" @click="selecionado = a.bloco">
                <span class="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-xs" :class="classeDados(a)"><i :class="TIPOS_AREA[a.tipo]?.icone"></i></span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-semibold text-slate-800">{{ titulo(a) }}</span>
                  <span class="block text-xs text-slate-500">{{ a.pendentes }} pendentes de {{ a.total }}</span>
                </span>
                <span class="text-sm font-black" :class="percentualPendente(a) > META ? 'text-red-700' : 'text-emerald-700'">{{ percentualPendente(a).toFixed(1) }}%</span>
              </button>
            </li>
          </ul>
        </section>

        <section class="rounded-2xl bg-white p-5 shadow-sm">
          <p class="text-sm font-bold text-slate-900">Usuários no mapa</p>
          <p class="text-xs text-slate-500">Escolha um para ver onde leu.</p>
          <ul class="mt-3 space-y-1">
            <li v-for="u in usuarios" :key="u.nome">
              <button type="button" class="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-slate-50" :class="modo === 'usuario' && usuarioFoco === u.nome ? 'bg-blue-50 text-blue-800' : ''" @click="modo = 'usuario'; usuarioFoco = u.nome">
                <span class="min-w-0"><span class="block truncate font-semibold">{{ u.nome && u.matricula ? separarUsuario(u.nome).nome : u.nome }}</span><span v-if="u.matricula" class="text-[11px] text-slate-500">Matrícula: {{ u.matricula }}</span></span>
                <span class="shrink-0 font-bold">{{ u.leituras }}</span>
              </button>
            </li>
          </ul>
        </section>
      </aside>
    </div>
  </div>
</template>
