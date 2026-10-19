<script setup>
import { computed, ref } from 'vue'
import { correspondeBusca } from '../utils/busca'
import { baixarCsv } from '../utils/csv'
import { rotuloUsuario, separarUsuario } from '../utils/usuario'
import TrajetoUsuario from './TrajetoUsuario.vue'

// Aba "Usuários" do detalhe da auditoria: produtividade, ritmo por hora e cobertura por setor.
const props = defineProps({
  auditoria: { type: Object, required: true },
  isItemLido: { type: Function, required: true },
  getItemHour: { type: Function, required: true },
  usuarioTrajeto: { type: String, default: '' } // usuário aberto no mapa histórico
})
const emit = defineEmits(['detalhes', 'imprimir'])

const HORAS = Array.from({ length: 13 }, (_, i) => i + 8) // 08h às 20h

const nomeUsuario = item => (item?.['Usuário'] || '').toString().trim()
const nomeSetor = item => (item?.['Classe de Produto Raiz'] || item?.['Setor'] || 'Não especificado').toString().trim()

// Uma passada pelos itens: horas e setores por usuário.
const atividade = computed(() => {
  const porUsuario = new Map()
  const porSetor = new Map()
  const dados = Array.isArray(props.auditoria?.dados) ? props.auditoria.dados : []
  for (const item of dados) {
    const usuario = nomeUsuario(item)
    if (!usuario || !props.isItemLido(item)) continue
    let u = porUsuario.get(usuario)
    if (!u) porUsuario.set(usuario, (u = { horas: new Map(), setores: new Map() }))
    const hora = props.getItemHour(item)
    if (hora !== null && hora !== undefined) u.horas.set(hora, (u.horas.get(hora) || 0) + 1)
    const setor = nomeSetor(item)
    u.setores.set(setor, (u.setores.get(setor) || 0) + 1)
    let s = porSetor.get(setor)
    if (!s) porSetor.set(setor, (s = new Map()))
    s.set(usuario, (s.get(usuario) || 0) + 1)
  }
  return { porUsuario, porSetor }
})

const formatarHora = h => `${String(h).padStart(2, '0')}h`

const usuarios = computed(() => {
  const analise = props.auditoria?.analise || {}
  const base = analise.porUsuario || {}
  const nomes = Array.isArray(analise.usuarios) && analise.usuarios.length ? analise.usuarios : Object.keys(base)
  const detalhesZero = analise.itensComEstoqueZeroDetalhes || []
  const detalhesLnp = analise.itensLidoNaoPertenceDetalhes || []
  const lista = nomes.map(nome => {
    const d = base[nome] || {}
    const lidos = d.lidos || 0
    const comProblema = d.comProblema || 0
    const leituras = lidos + comProblema
    const a = atividade.value.porUsuario.get(nome)
    const horas = HORAS.map(h => a?.horas.get(h) || 0)
    const horasAtivas = [...(a?.horas.keys() || [])].sort((x, y) => x - y)
    const pico = horas.reduce((m, v, i) => (v > horas[m] ? i : m), 0)
    const setoresOrdenados = [...(a?.setores || new Map())].sort((x, y) => y[1] - x[1])
    return {
      nome,
      // `nome` é a chave original da planilha; `exibicao` e `matricula` são para a tela.
      exibicao: separarUsuario(nome).nome || nome,
      matricula: separarUsuario(nome).matricula,
      lidos,
      comProblema,
      leituras,
      percProblema: leituras ? (comProblema / leituras) * 100 : 0,
      estoqueZero: detalhesZero.filter(x => x.usuario === nome).length,
      naoPertence: detalhesLnp.filter(x => x.usuario === nome).length,
      horas,
      inicio: horasAtivas[0] ?? null,
      fim: horasAtivas.at(-1) ?? null,
      horasAtivas: horasAtivas.length,
      ritmo: horasAtivas.length ? leituras / horasAtivas.length : 0,
      pico: horas[pico] ? HORAS[pico] : null,
      setorPrincipal: setoresOrdenados[0]?.[0] || null,
      qtdSetores: setoresOrdenados.length
    }
  })
  const total = lista.reduce((s, u) => s + u.leituras, 0)
  const ranking = [...lista].sort((a, b) => b.leituras - a.leituras)
  return lista.map(u => ({ ...u, participacao: total ? (u.leituras / total) * 100 : 0, posicao: ranking.indexOf(u) + 1 }))
})

const resumo = computed(() => {
  const lista = usuarios.value
  const leituras = lista.reduce((s, u) => s + u.leituras, 0)
  const problemas = lista.reduce((s, u) => s + u.comProblema, 0)
  const porHora = HORAS.map((_, i) => lista.reduce((s, u) => s + u.horas[i], 0))
  const iPico = porHora.reduce((m, v, i) => (v > porHora[m] ? i : m), 0)
  const ritmos = lista.filter(u => u.horasAtivas).map(u => u.ritmo)
  return {
    total: lista.length,
    leituras,
    media: lista.length ? leituras / lista.length : 0,
    percProblema: leituras ? (problemas / leituras) * 100 : 0,
    picoHora: porHora[iPico] ? HORAS[iPico] : null,
    picoQtd: porHora[iPico],
    ritmoMedio: ritmos.length ? ritmos.reduce((s, v) => s + v, 0) / ritmos.length : 0,
    porHora
  }
})

const usuariosTrajeto = computed(() => [...usuarios.value].sort((a, b) => b.leituras - a.leituras))

const podio = computed(() => [...usuarios.value].sort((a, b) => b.leituras - a.leituras).slice(0, 3).filter(u => u.leituras > 0))

// ---------- Lista ----------
const busca = ref('')
const ordem = ref('leituras')
const visao = ref('cards')
const ordens = [
  { valor: 'leituras', rotulo: 'Mais leituras' },
  { valor: 'ritmo', rotulo: 'Maior ritmo' },
  { valor: 'percProblema', rotulo: 'Mais problemas' },
  { valor: 'nome', rotulo: 'Nome' }
]
const listaVisivel = computed(() => usuarios.value
  .filter(u => correspondeBusca(busca.value, [u.nome, u.exibicao, u.matricula, u.setorPrincipal]))
  .sort((a, b) => (ordem.value === 'nome' ? a.exibicao.localeCompare(b.exibicao, 'pt-BR') : b[ordem.value] - a[ordem.value])))

const maiorHora = computed(() => Math.max(1, ...usuarios.value.flatMap(u => u.horas)))
// Intensidade sequencial (um só tom de azul): mais escuro = mais leituras.
const tonsCalor = ['bg-slate-100', 'bg-blue-100', 'bg-blue-200', 'bg-blue-400', 'bg-blue-600', 'bg-blue-800']
const corCalor = v => (v ? tonsCalor[Math.min(5, 1 + Math.floor((v / maiorHora.value) * 4.999))] : tonsCalor[0])
const maiorHoraTime = computed(() => Math.max(1, ...resumo.value.porHora))

const classeProblema = p => (p > 5 ? 'bg-red-50 text-red-700' : p > 2 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700')

// ---------- Cobertura por setor ----------
const cobertura = computed(() => [...atividade.value.porSetor]
  .map(([setor, mapa]) => {
    const total = [...mapa.values()].reduce((s, v) => s + v, 0)
    const pessoas = [...mapa].sort((a, b) => b[1] - a[1]).map(([nome, qtd]) => ({ nome, qtd, perc: total ? (qtd / total) * 100 : 0 }))
    return { setor, total, pessoas, principal: pessoas[0], dependencia: pessoas[0]?.perc || 0 }
  })
  .sort((a, b) => b.total - a.total))
const setoresDependentes = computed(() => cobertura.value.filter(s => s.pessoas.length >= 1 && s.dependencia >= 80 && s.total >= 10).length)

const exportarCsv = () => {
  const colunas = [
    { chave: 'posicao', titulo: 'Posição' }, { chave: 'matricula', titulo: 'Matrícula' }, { chave: 'exibicao', titulo: 'Nome' }, { chave: 'leituras', titulo: 'Leituras' },
    { chave: 'lidos', titulo: 'Lidos corretamente' }, { chave: 'comProblema', titulo: 'Com problema' }, { chave: 'percProblemaFmt', titulo: '% Problema' },
    { chave: 'participacaoFmt', titulo: '% do total' }, { chave: 'periodo', titulo: 'Período ativo' }, { chave: 'ritmoFmt', titulo: 'Leituras/hora' },
    { chave: 'setorPrincipal', titulo: 'Setor principal' }
  ]
  const linhas = listaVisivel.value.map(u => ({
    ...u,
    percProblemaFmt: u.percProblema.toFixed(2).replace('.', ','),
    participacaoFmt: u.participacao.toFixed(2).replace('.', ','),
    ritmoFmt: u.ritmo.toFixed(1).replace('.', ','),
    periodo: u.inicio === null ? '' : `${formatarHora(u.inicio)}–${formatarHora(u.fim + 1)}`
  }))
  baixarCsv(linhas, colunas, `auditoria-${props.auditoria?.id}-usuarios`)
}
</script>

<template>
  <div class="space-y-6">
    <div v-if="!usuarios.length" class="rounded-2xl bg-white px-6 py-14 text-center shadow-sm">
      <i class="fas fa-users text-3xl text-slate-300"></i>
      <p class="mt-3 font-semibold text-slate-700">Nenhuma informação de usuários nesta auditoria</p>
      <p class="mt-1 text-sm text-slate-500">A planilha importada não tem a coluna "Usuário" preenchida.</p>
    </div>

    <template v-else>
      <!-- Resumo do time -->
      <div class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <div class="rounded-2xl bg-white p-4 shadow-sm">
          <p class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Usuários</p>
          <p class="mt-1 text-2xl font-bold text-slate-900">{{ resumo.total }}</p>
          <p class="text-xs text-slate-500">participaram da contagem</p>
        </div>
        <div class="rounded-2xl bg-white p-4 shadow-sm">
          <p class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Leituras</p>
          <p class="mt-1 text-2xl font-bold text-slate-900">{{ resumo.leituras.toLocaleString('pt-BR') }}</p>
          <p class="text-xs text-slate-500">média {{ Math.round(resumo.media).toLocaleString('pt-BR') }} por usuário</p>
        </div>
        <div class="rounded-2xl bg-white p-4 shadow-sm">
          <p class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Ritmo médio</p>
          <p class="mt-1 text-2xl font-bold text-slate-900">{{ Math.round(resumo.ritmoMedio).toLocaleString('pt-BR') }}<span class="text-sm font-semibold text-slate-500">/h</span></p>
          <p class="text-xs text-slate-500">leituras por hora ativa</p>
        </div>
        <div class="rounded-2xl bg-white p-4 shadow-sm">
          <p class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Leituras com problema</p>
          <p class="mt-1 text-2xl font-bold" :class="resumo.percProblema > 5 ? 'text-red-700' : 'text-slate-900'">{{ resumo.percProblema.toFixed(1) }}%</p>
          <p class="text-xs text-slate-500">sem estoque ou fora do local</p>
        </div>
        <div class="col-span-2 rounded-2xl bg-white p-4 shadow-sm md:col-span-1">
          <p class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Pico do time</p>
          <p class="mt-1 text-2xl font-bold text-slate-900">{{ resumo.picoHora === null ? '—' : formatarHora(resumo.picoHora) }}</p>
          <p class="text-xs text-slate-500">{{ resumo.picoQtd.toLocaleString('pt-BR') }} leituras na hora</p>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <!-- Pódio -->
        <section class="rounded-2xl bg-white p-5 shadow-sm">
          <div class="flex items-center justify-between">
            <h3 class="text-base font-bold text-slate-900">Destaques da contagem</h3>
            <i class="fas fa-trophy text-amber-500"></i>
          </div>
          <div class="mt-5 flex items-end justify-center gap-3">
            <button
              v-for="u in [podio[1], podio[0], podio[2]].filter(Boolean)"
              :key="u.nome"
              type="button"
              class="flex w-1/3 max-w-40 flex-col items-center text-center"
              @click="emit('detalhes', u.nome)"
            >
              <span class="line-clamp-2 w-full text-sm font-bold leading-tight text-slate-900" :title="u.exibicao">{{ u.exibicao }}</span>
              <span v-if="u.matricula" class="text-[11px] text-slate-500">Matrícula: {{ u.matricula }}</span>
              <span class="text-xs text-slate-500">{{ u.leituras.toLocaleString('pt-BR') }} leituras</span>
              <span
                class="mt-2 flex w-full items-start justify-center rounded-t-xl pt-2 text-lg font-black text-white"
                :class="u.posicao === 1 ? 'h-24 bg-amber-400' : u.posicao === 2 ? 'h-16 bg-slate-300' : 'h-12 bg-orange-300'"
              >{{ u.posicao }}º</span>
            </button>
          </div>
        </section>

        <!-- Ritmo do time por hora -->
        <section class="rounded-2xl bg-white p-5 shadow-sm">
          <h3 class="text-base font-bold text-slate-900">Leituras do time por hora</h3>
          <p class="text-xs text-slate-500">Soma de todos os usuários, das 08h às 20h.</p>
          <div class="mt-4 flex h-40 items-end gap-1.5">
            <div v-for="(v, i) in resumo.porHora" :key="i" class="group relative flex h-full flex-1 flex-col justify-end">
              <span class="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] text-white group-hover:block">{{ formatarHora(HORAS[i]) }}: {{ v.toLocaleString('pt-BR') }}</span>
              <span class="w-full rounded-t transition-all duration-500" :class="HORAS[i] === resumo.picoHora ? 'bg-blue-700' : 'bg-blue-400 group-hover:bg-blue-500'" :style="{ height: `${(v / maiorHoraTime) * 100}%`, minHeight: v ? '3px' : '0' }"></span>
            </div>
          </div>
          <div class="mt-1.5 flex gap-1.5">
            <span v-for="h in HORAS" :key="h" class="flex-1 text-center text-[10px] text-slate-400">{{ h }}</span>
          </div>
        </section>
      </div>

      <!-- Mapa histórico: leituras ao longo do dia e caminho pela loja -->
      <TrajetoUsuario id="trajeto-usuario" class="scroll-mt-24" :auditoria="auditoria" :is-item-lido="isItemLido" :usuarios="usuariosTrajeto" :usuario-inicial="usuarioTrajeto" />

      <!-- Barra de ferramentas -->
      <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 class="text-lg font-bold text-slate-900">Desempenho individual</h3>
          <p class="text-xs text-slate-500">Clique em um usuário para ver itens com problema e locais mais lidos.</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <div class="relative min-w-0 flex-1 sm:w-52 sm:flex-none">
            <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400"></i>
            <input v-model="busca" type="search" class="ui-input py-2 pl-8 text-sm" placeholder="Usuário ou setor...">
          </div>
          <select v-model="ordem" class="ui-input w-auto py-2 text-sm" aria-label="Ordenar">
            <option v-for="o in ordens" :key="o.valor" :value="o.valor">{{ o.rotulo }}</option>
          </select>
          <div class="flex rounded-xl bg-slate-100 p-1">
            <button v-for="[v, icone, rotulo] in [['cards', 'fas fa-grip', 'Cartões'], ['tabela', 'fas fa-list', 'Tabela'], ['calor', 'fas fa-table-cells', 'Mapa de horas']]" :key="v" type="button"
              class="rounded-lg px-2.5 py-1.5 text-xs font-semibold transition" :class="visao === v ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'"
              :title="rotulo" :aria-label="rotulo" @click="visao = v">
              <i :class="icone"></i><span class="ml-1 hidden lg:inline">{{ rotulo }}</span>
            </button>
          </div>
          <button type="button" class="ui-btn-secondary py-2" @click="exportarCsv"><i class="fas fa-file-csv"></i>CSV</button>
          <button type="button" class="ui-btn-secondary py-2" @click="emit('imprimir')"><i class="fas fa-print"></i>Imprimir</button>
        </div>
      </div>

      <p v-if="!listaVisivel.length" class="rounded-2xl bg-white py-10 text-center text-sm text-slate-500 shadow-sm">Nenhum usuário encontrado.</p>

      <!-- Cartões -->
      <div v-else-if="visao === 'cards'" class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        <button
          v-for="u in listaVisivel"
          :key="u.nome"
          type="button"
          class="group flex flex-col rounded-2xl bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
          @click="emit('detalhes', u.nome)"
        >
          <div class="flex items-center gap-3">
            <div class="min-w-0 flex-1">
              <p class="truncate font-bold text-slate-900" :title="u.exibicao">{{ u.exibicao }}</p>
              <p v-if="u.matricula" class="text-xs font-medium text-slate-600">Matrícula: {{ u.matricula }}</p>
              <p class="truncate text-xs text-slate-500">
                <template v-if="u.inicio !== null">{{ formatarHora(u.inicio) }}–{{ formatarHora(u.fim + 1) }} · </template>{{ u.setorPrincipal || 'sem setor' }}
              </p>
            </div>
            <span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">{{ u.posicao }}º</span>
          </div>

          <div class="mt-4 flex items-baseline justify-between">
            <p class="text-2xl font-bold text-slate-900">{{ u.leituras.toLocaleString('pt-BR') }} <span class="text-xs font-semibold text-slate-500">leituras</span></p>
            <p class="text-xs font-semibold text-slate-600">{{ u.participacao.toFixed(1) }}% do total</p>
          </div>
          <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div class="h-full rounded-full bg-blue-600" :style="{ width: `${u.participacao}%` }"></div>
          </div>

          <div class="mt-4 grid grid-cols-3 gap-2 text-center">
            <div class="rounded-xl bg-slate-50 py-2">
              <p class="text-sm font-bold text-slate-900">{{ Math.round(u.ritmo) }}/h</p>
              <p class="text-[10px] text-slate-500">ritmo</p>
            </div>
            <div class="rounded-xl bg-slate-50 py-2">
              <p class="text-sm font-bold text-slate-900">{{ u.pico === null ? '—' : formatarHora(u.pico) }}</p>
              <p class="text-[10px] text-slate-500">pico</p>
            </div>
            <div class="rounded-xl py-2" :class="classeProblema(u.percProblema)">
              <p class="text-sm font-bold">{{ u.percProblema.toFixed(1) }}%</p>
              <p class="text-[10px] opacity-80">problemas</p>
            </div>
          </div>

          <!-- Faixa de horas -->
          <div class="mt-4 flex gap-0.5" :aria-label="`Leituras por hora de ${u.exibicao}`">
            <span v-for="(v, i) in u.horas" :key="i" class="h-3 flex-1 rounded-sm" :class="corCalor(v)" :title="`${formatarHora(HORAS[i])}: ${v}`"></span>
          </div>
          <div class="mt-1 flex justify-between text-[10px] text-slate-400"><span>08h</span><span>14h</span><span>20h</span></div>

          <p v-if="u.estoqueZero || u.naoPertence" class="mt-3 text-xs text-slate-500">
            <i class="fas fa-triangle-exclamation mr-1 text-amber-500"></i>{{ u.estoqueZero }} sem estoque · {{ u.naoPertence }} fora do local
          </p>
        </button>
      </div>

      <!-- Tabela -->
      <div v-else-if="visao === 'tabela'" class="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table class="w-full text-sm">
          <thead class="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th class="px-4 py-3 text-left font-semibold">#</th>
              <th class="px-4 py-3 text-left font-semibold">Matrícula</th>
              <th class="px-4 py-3 text-left font-semibold">Nome</th>
              <th class="px-4 py-3 text-right font-semibold">Leituras</th>
              <th class="px-4 py-3 text-left font-semibold">Participação</th>
              <th class="px-4 py-3 text-right font-semibold">Ritmo</th>
              <th class="px-4 py-3 text-right font-semibold">Período</th>
              <th class="px-4 py-3 text-right font-semibold">Problemas</th>
              <th class="px-4 py-3 text-left font-semibold">Setor principal</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="u in listaVisivel" :key="u.nome" class="cursor-pointer hover:bg-blue-50/40" @click="emit('detalhes', u.nome)">
              <td class="px-4 py-2.5 text-slate-500">{{ u.posicao }}</td>
              <td class="px-4 py-2.5 font-mono text-slate-600">{{ u.matricula || '—' }}</td>
              <td class="px-4 py-2.5 font-semibold text-slate-900">{{ u.exibicao }}</td>
              <td class="px-4 py-2.5 text-right font-semibold">{{ u.leituras.toLocaleString('pt-BR') }}</td>
              <td class="px-4 py-2.5">
                <div class="flex items-center gap-2">
                  <div class="h-1.5 w-28 overflow-hidden rounded-full bg-slate-100"><div class="h-full rounded-full bg-blue-600" :style="{ width: `${u.participacao}%` }"></div></div>
                  <span class="text-xs text-slate-600">{{ u.participacao.toFixed(1) }}%</span>
                </div>
              </td>
              <td class="px-4 py-2.5 text-right text-slate-700">{{ Math.round(u.ritmo) }}/h</td>
              <td class="px-4 py-2.5 text-right text-slate-500">{{ u.inicio === null ? '—' : `${formatarHora(u.inicio)}–${formatarHora(u.fim + 1)}` }}</td>
              <td class="px-4 py-2.5 text-right"><span class="rounded-full px-2 py-0.5 text-xs font-semibold" :class="classeProblema(u.percProblema)">{{ u.comProblema }} · {{ u.percProblema.toFixed(1) }}%</span></td>
              <td class="max-w-48 truncate px-4 py-2.5 text-slate-600">{{ u.setorPrincipal || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Mapa de calor usuário × hora -->
      <div v-else class="overflow-x-auto rounded-2xl bg-white p-5 shadow-sm">
        <table class="w-full border-separate" style="border-spacing: 3px">
          <thead>
            <tr>
              <th class="w-52 text-left text-xs font-semibold text-slate-500">Usuário</th>
              <th v-for="h in HORAS" :key="h" class="text-center text-[10px] font-semibold text-slate-400">{{ formatarHora(h) }}</th>
              <th class="text-right text-xs font-semibold text-slate-500">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in listaVisivel" :key="u.nome" class="cursor-pointer" @click="emit('detalhes', u.nome)">
              <td class="max-w-52 pr-2">
                <p class="truncate text-sm font-medium text-slate-800" :title="u.exibicao">{{ u.exibicao }}</p>
                <p v-if="u.matricula" class="text-[10px] text-slate-500">Matrícula: {{ u.matricula }}</p>
              </td>
              <td v-for="(v, i) in u.horas" :key="i" class="h-8 min-w-8 rounded-md text-center text-[10px] font-semibold" :class="[corCalor(v), v / maiorHora > 0.55 ? 'text-white' : 'text-slate-700']" :title="`${u.exibicao} · ${formatarHora(HORAS[i])}: ${v} leituras`">{{ v || '' }}</td>
              <td class="pl-2 text-right text-sm font-bold text-slate-900">{{ u.leituras.toLocaleString('pt-BR') }}</td>
            </tr>
          </tbody>
        </table>
        <div class="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-slate-500">
          Menos <span v-for="t in tonsCalor" :key="t" class="size-3 rounded-sm" :class="t"></span> Mais
        </div>
      </div>

      <!-- Cobertura por setor -->
      <section v-if="cobertura.length" class="rounded-2xl bg-white p-5 shadow-sm">
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 class="text-base font-bold text-slate-900">Quem leu cada setor</h3>
            <p class="text-xs text-slate-500">Participação de cada pessoa nas leituras do setor.</p>
          </div>
          <span v-if="setoresDependentes" class="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
            <i class="fas fa-user-lock"></i>{{ setoresDependentes }} setor(es) dependem de uma só pessoa (≥ 80%)
          </span>
        </div>
        <ul class="mt-4 grid grid-cols-1 gap-x-8 gap-y-3 lg:grid-cols-2 2xl:grid-cols-3">
          <li v-for="s in cobertura" :key="s.setor" class="min-w-0">
            <div class="flex items-baseline justify-between gap-2 text-sm">
              <span class="truncate font-semibold text-slate-800" :title="s.setor">{{ s.setor }}</span>
              <span class="shrink-0 text-xs text-slate-500">{{ s.total.toLocaleString('pt-BR') }} leituras · {{ s.pessoas.length }} pessoa(s)</span>
            </div>
            <div class="mt-1.5 flex h-2 overflow-hidden rounded-full bg-slate-100">
              <span class="h-full rounded-full" :class="s.dependencia >= 80 ? 'bg-amber-500' : 'bg-blue-600'" :style="{ width: `${s.dependencia}%` }"></span>
            </div>
            <p class="mt-1 truncate text-xs text-slate-500">
              <b class="text-slate-700">{{ rotuloUsuario(s.principal?.nome) }}</b> {{ s.principal?.perc.toFixed(0) }}%
              <template v-for="p in s.pessoas.slice(1, 3)" :key="p.nome"> · {{ rotuloUsuario(p.nome) }} {{ p.perc.toFixed(0) }}%</template>
              <template v-if="s.pessoas.length > 3"> · +{{ s.pessoas.length - 3 }}</template>
            </p>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
