<script setup>
import UiTabela from './ui/UiTabela.vue'
import { computed, ref } from 'vue'
import { rotuloUsuario, separarUsuario } from '../utils/usuario'
import TrajetoUsuario from './TrajetoUsuario.vue'
import UiAcoes from './ui/UiAcoes.vue'
import { GRUPOS } from '../composables/useAcoes'

// Aba "Usuários" do detalhe da auditoria: produtividade, ritmo por hora e cobertura por setor.
const props = defineProps({
  auditoria: { type: Object, required: true },
  isItemLido: { type: Function, required: true },
  getItemHour: { type: Function, required: true },
  usuarioTrajeto: { type: String, default: '' } // usuário aberto no mapa histórico
})
const emit = defineEmits(['detalhes', 'imprimir'])
const acoesEquipe = [
  { id: 'equipe-imprimir', rotulo: 'Imprimir equipe', detalhe: 'Relatório da equipe nesta auditoria', icone: 'fas fa-print', nivel: 'secundaria', grupo: GRUPOS.exportar, termos: 'pdf usuarios colaboradores', executar: () => emit('imprimir') }
]

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

// ---------- Lista (tabela padrão nas três visões: filtros, ordem e paginação iguais) ----------
const visao = ref('cards')
const periodo = u => (u.inicio === null ? '' : `${formatarHora(u.inicio)}–${formatarHora(u.fim + 1)}`)
const COLUNAS_BASE = [
  { chave: 'posicao', titulo: '#', tipo: 'numero' },
  { chave: 'matricula', titulo: 'Matrícula', tipo: 'texto' },
  { chave: 'exibicao', titulo: 'Nome', tipo: 'texto' },
  { chave: 'leituras', titulo: 'Leituras', tipo: 'numero' },
  { chave: 'participacao', titulo: 'Participação', tipo: 'numero', alinhamento: 'left', formato: v => `${v.toFixed(1)}%` },
  { chave: 'ritmo', titulo: 'Ritmo (/h)', tipo: 'numero', formato: v => `${Math.round(v)}/h` },
  { chave: 'periodo', titulo: 'Período', tipo: 'texto', valor: periodo, ordenavel: false },
  { chave: 'percProblema', titulo: 'Problemas', tipo: 'numero', formato: (v, u) => `${u.comProblema} · ${v.toFixed(1)}%` },
  { chave: 'setorPrincipal', titulo: 'Setor principal', tipo: 'categoria', rapido: true },
  { chave: 'comProblema', titulo: 'Com problema', tipo: 'numero', oculta: true },
  { chave: 'estoqueZero', titulo: 'Lidos com estoque zero', tipo: 'numero', oculta: true },
  { chave: 'naoPertence', titulo: 'Lido não pertence', tipo: 'numero', oculta: true },
  { chave: 'pico', titulo: 'Hora de pico', tipo: 'numero', oculta: true, formato: v => (v === null ? '—' : formatarHora(v)) },
  { chave: 'qtdSetores', titulo: 'Setores lidos', tipo: 'numero', oculta: true }
]
// Mapa de horas: uma coluna por hora (dá para ordenar e filtrar por hora também).
const COLUNAS_CALOR = [
  { chave: 'exibicao', titulo: 'Usuário', tipo: 'texto' },
  ...HORAS.map((h, i) => ({ chave: `h${h}`, titulo: formatarHora(h), tipo: 'numero', alinhamento: 'center', valor: u => u.horas[i] })),
  { chave: 'leituras', titulo: 'Total', tipo: 'numero' },
  { chave: 'matricula', titulo: 'Matrícula', tipo: 'texto', oculta: true },
  { chave: 'setorPrincipal', titulo: 'Setor principal', tipo: 'categoria', rapido: true, oculta: true },
  { chave: 'percProblema', titulo: '% problema', tipo: 'numero', oculta: true },
  { chave: 'ritmo', titulo: 'Ritmo (/h)', tipo: 'numero', oculta: true }
]
const ATALHOS = [
  { rotulo: 'Problema acima de 5%', icone: 'fas fa-triangle-exclamation', condicoes: [{ chave: 'percProblema', op: 'maior', valor: '5' }] },
  { rotulo: 'Com estoque zero ou fora do local', icone: 'fas fa-box-open', condicoes: [{ chave: 'estoqueZero', op: 'maior', valor: '0' }] }
]

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

</script>

<template>
  <div class="space-y-6">
    <div v-if="!usuarios.length" class="rounded-xl bg-white px-6 py-14 text-center shadow-sm">
      <i class="fas fa-users text-3xl text-slate-300"></i>
      <p class="mt-3 font-semibold text-slate-700">Nenhuma informação de usuários nesta auditoria</p>
      <p class="mt-1 text-sm text-slate-500">A planilha importada não tem a coluna "Usuário" preenchida.</p>
    </div>

    <template v-else>
      <!-- Resumo do time -->
      <div class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <div class="rounded-xl bg-white p-4 shadow-sm">
          <p class="text-xs font-semibold text-slate-500">Usuários</p>
          <p class="mt-1 text-2xl font-bold text-slate-900">{{ resumo.total }}</p>
          <p class="text-xs text-slate-500">participaram da contagem</p>
        </div>
        <div class="rounded-xl bg-white p-4 shadow-sm">
          <p class="text-xs font-semibold text-slate-500">Leituras</p>
          <p class="mt-1 text-2xl font-bold text-slate-900">{{ resumo.leituras.toLocaleString('pt-BR') }}</p>
          <p class="text-xs text-slate-500">média {{ Math.round(resumo.media).toLocaleString('pt-BR') }} por usuário</p>
        </div>
        <div class="rounded-xl bg-white p-4 shadow-sm">
          <p class="text-xs font-semibold text-slate-500">Ritmo médio</p>
          <p class="mt-1 text-2xl font-bold text-slate-900">{{ Math.round(resumo.ritmoMedio).toLocaleString('pt-BR') }}<span class="text-sm font-semibold text-slate-500">/h</span></p>
          <p class="text-xs text-slate-500">leituras por hora ativa</p>
        </div>
        <div class="rounded-xl bg-white p-4 shadow-sm">
          <p class="text-xs font-semibold text-slate-500">Leituras com problema</p>
          <p class="mt-1 text-2xl font-bold" :class="resumo.percProblema > 5 ? 'text-red-700' : 'text-slate-900'">{{ resumo.percProblema.toFixed(1) }}%</p>
          <p class="text-xs text-slate-500">sem estoque ou fora do local</p>
        </div>
        <div class="col-span-2 rounded-xl bg-white p-4 shadow-sm md:col-span-1">
          <p class="text-xs font-semibold text-slate-500">Pico do time</p>
          <p class="mt-1 text-2xl font-bold text-slate-900">{{ resumo.picoHora === null ? '—' : formatarHora(resumo.picoHora) }}</p>
          <p class="text-xs text-slate-500">{{ resumo.picoQtd.toLocaleString('pt-BR') }} leituras na hora</p>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <!-- Pódio -->
        <section class="rounded-xl bg-white p-5 shadow-sm">
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
        <section class="rounded-xl bg-white p-5 shadow-sm">
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
          <div class="flex rounded-xl bg-slate-100 p-1">
            <button v-for="[v, icone, rotulo] in [['cards', 'fas fa-grip', 'Cartões'], ['tabela', 'fas fa-list', 'Tabela'], ['calor', 'fas fa-table-cells', 'Mapa de horas']]" :key="v" type="button"
              class="rounded-lg px-2.5 py-1.5 text-xs font-semibold transition" :class="visao === v ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'"
              :title="rotulo" :aria-label="rotulo" @click="visao = v">
              <i :class="icone"></i><span class="ml-1 hidden lg:inline">{{ rotulo }}</span>
            </button>
          </div>
          <UiAcoes :acoes="acoesEquipe" contexto="Usuários da auditoria" />
        </div>
      </div>

      <!-- Cartões -->
      <UiTabela v-if="visao === 'cards'" id="auditoria-usuarios" modo="grade" titulo="Desempenho individual" :itens="usuarios" :colunas="COLUNAS_BASE" :atalhos="ATALHOS" :ordem-inicial="{ chave: 'leituras', direcao: 'desc' }" chave-item="nome" :tamanho-pagina="25" classe-grade="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" placeholder="Nome, matrícula ou setor...">
        <template #item="{ item: u }">
          <button type="button" class="group flex flex-col rounded-xl bg-white p-5 text-left shadow-sm transition" @click="emit('detalhes', u.nome)">
            <div class="flex items-center gap-3">
              <div class="min-w-0 flex-1">
                <p class="truncate font-bold text-slate-900" :title="u.exibicao">{{ u.exibicao }}</p>
                <p v-if="u.matricula" class="text-xs font-medium text-slate-600">Matrícula: {{ u.matricula }}</p>
                <p class="truncate text-xs text-slate-500"><template v-if="u.inicio !== null">{{ formatarHora(u.inicio) }}–{{ formatarHora(u.fim + 1) }} · </template>{{ u.setorPrincipal || 'sem setor' }}</p>
              </div>
              <span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">{{ u.posicao }}º</span>
            </div>
            <div class="mt-4 flex items-baseline justify-between">
              <p class="text-2xl font-bold text-slate-900">{{ u.leituras.toLocaleString('pt-BR') }} <span class="text-xs font-semibold text-slate-500">leituras</span></p>
              <p class="text-xs font-semibold text-slate-600">{{ u.participacao.toFixed(1) }}% do total</p>
            </div>
            <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100"><div class="h-full rounded-full bg-blue-600" :style="{ width: `${u.participacao}%` }"></div></div>
            <div class="mt-4 grid grid-cols-3 gap-2 text-center">
              <div class="rounded-xl bg-slate-50 py-2"><p class="text-sm font-bold text-slate-900">{{ Math.round(u.ritmo) }}/h</p><p class="text-[10px] text-slate-500">ritmo</p></div>
              <div class="rounded-xl bg-slate-50 py-2"><p class="text-sm font-bold text-slate-900">{{ u.pico === null ? '—' : formatarHora(u.pico) }}</p><p class="text-[10px] text-slate-500">pico</p></div>
              <div class="rounded-xl py-2" :class="classeProblema(u.percProblema)"><p class="text-sm font-bold">{{ u.percProblema.toFixed(1) }}%</p><p class="text-[10px] opacity-80">problemas</p></div>
            </div>
            <div class="mt-4 flex gap-0.5" :aria-label="`Leituras por hora de ${u.exibicao}`">
              <span v-for="(v, i) in u.horas" :key="i" class="h-3 flex-1 rounded-sm" :class="corCalor(v)" :title="`${formatarHora(HORAS[i])}: ${v}`"></span>
            </div>
            <div class="mt-1 flex justify-between text-[10px] text-slate-400"><span>08h</span><span>14h</span><span>20h</span></div>
            <p v-if="u.estoqueZero || u.naoPertence" class="mt-3 text-xs text-slate-500"><i class="fas fa-triangle-exclamation mr-1 text-amber-500"></i>{{ u.estoqueZero }} sem estoque · {{ u.naoPertence }} fora do local</p>
          </button>
        </template>
      </UiTabela>

      <!-- Tabela -->
      <UiTabela v-else-if="visao === 'tabela'" id="auditoria-usuarios" titulo="Desempenho individual" :itens="usuarios" :colunas="COLUNAS_BASE" :atalhos="ATALHOS" :ordem-inicial="{ chave: 'leituras', direcao: 'desc' }" chave-item="nome" clicavel placeholder="Nome, matrícula ou setor..." @linha="emit('detalhes', $event.nome)">
        <template #celula-participacao="{ item: u }">
          <div class="flex items-center gap-2"><div class="h-1.5 w-28 overflow-hidden rounded-full bg-slate-100"><div class="h-full rounded-full bg-blue-600" :style="{ width: `${u.participacao}%` }"></div></div><span class="text-xs text-slate-600">{{ u.participacao.toFixed(1) }}%</span></div>
        </template>
        <template #celula-percProblema="{ item: u, texto }"><span class="rounded-full px-2 py-0.5 text-xs font-semibold" :class="classeProblema(u.percProblema)">{{ texto }}</span></template>
      </UiTabela>

      <!-- Mapa de calor usuário × hora -->
      <div v-else class="rounded-xl bg-white p-5 shadow-sm">
        <UiTabela id="auditoria-usuarios" titulo="Leituras por hora" :itens="usuarios" :colunas="COLUNAS_CALOR" :ordem-inicial="{ chave: 'leituras', direcao: 'desc' }" chave-item="nome" clicavel :agrupavel="false" placeholder="Nome, matrícula ou setor..." @linha="emit('detalhes', $event.nome)">
          <template #celula-exibicao="{ item: u }">
            <p class="max-w-52 truncate text-sm font-medium text-slate-800" :title="u.exibicao">{{ u.exibicao }}</p>
            <p v-if="u.matricula" class="text-[10px] font-normal text-slate-500">Matrícula: {{ u.matricula }}</p>
          </template>
          <template v-for="(h, i) in HORAS" :key="h" #[`celula-h${h}`]="{ item: u }">
            <span class="inline-flex h-8 min-w-8 items-center justify-center rounded-md px-1 text-[10px] font-semibold" :class="[corCalor(u.horas[i]), u.horas[i] / maiorHora > 0.55 ? 'text-white' : 'text-slate-700']" :title="`${u.exibicao} · ${formatarHora(h)}: ${u.horas[i]} leituras`">{{ u.horas[i] || '' }}</span>
          </template>
        </UiTabela>
        <div class="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-slate-500">
          Menos <span v-for="t in tonsCalor" :key="t" class="size-3 rounded-sm" :class="t"></span> Mais
        </div>
      </div>

      <!-- Cobertura por setor -->
      <section v-if="cobertura.length" class="rounded-xl bg-white p-5 shadow-sm">
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
