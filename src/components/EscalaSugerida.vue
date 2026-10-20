<script setup>
import { computed, ref, watch } from 'vue'
import { agregarPorArea, carregarLayoutSalvo, gerarLayoutPadrao, interpretarLocal, mesclarLayout, nomeArea } from '../utils/mapaLoja'
import { mediana, ritmosDaAuditoria, setorPorArea } from '../utils/planoAcao'
import { familiaDoTipo, montarEscala, perfisColaboradores, textoHora } from '../utils/perfilColaborador'
import { useAuditoriasStore } from '../stores/auditoriasStore'
import { correspondeBusca } from '../utils/busca'
import { rotuloUsuario } from '../utils/usuario'
import { blocoTabela, escapeHtml, imprimirRelatorio, selo } from '../utils/print'

// Escala para a próxima auditoria a partir do perfil de cada colaborador no histórico:
// onde lê (área, setor, família), ritmo em cada família, horário em que costuma ler e acerto.
// Ninguém sai do próprio perfil quando há alternativa, ninguém passa da capacidade quando dá
// para evitar e ninguém fica espalhado por áreas demais.
const props = defineProps({
  auditoria: { type: Object, required: true },
  inicio: { type: String, default: '08:00' },
  fim: { type: String, default: '20:00' }
})
const store = useAuditoriasStore()

// Base histórica: as últimas auditorias com itens, de preferência do mesmo tipo (ritmos diferem por tipo).
const BASES = [5, 10, 20]
const base = ref(10)
const comItens = computed(() => [...(store.auditorias || [])]
  .filter(a => Array.isArray(a?.dados) && a.dados.length)
  .sort((a, b) => String(b.data).localeCompare(String(a.data)) || b.id - a.id))
const mesmoTipo = computed(() => comItens.value.filter(a => a.tipo === props.auditoria?.tipo))
const historicoAuditorias = computed(() => (mesmoTipo.value.length >= 2 ? mesmoTipo.value : comItens.value).slice(0, base.value))
const baseMesmoTipo = computed(() => mesmoTipo.value.length >= 2)
const perfis = computed(() => perfisColaboradores(historicoAuditorias.value))
const ritmoMediano = computed(() => Math.round(mediana(ritmosDaAuditoria(props.auditoria).map(r => r.ritmo)) || mediana([...perfis.value.values()].map(p => p.ritmo).filter(Boolean)) || 120))

// Áreas a auditar (tamanho pela auditoria atual) e setor de cada área.
const areasAuditoria = computed(() => agregarPorArea(props.auditoria, () => false))
const areas = computed(() => [...areasAuditoria.value.values()]
  .map(a => ({ bloco: a.bloco, tipo: a.tipo, numero: a.numero, itens: a.total, locais: a.locais.size }))
  .filter(a => a.itens > 0))
const setores = computed(() => setorPorArea(props.auditoria))

// Colaboradores: todos com histórico; por padrão, os que leram nesta auditoria.
const colaboradores = computed(() => [...perfis.value.values()]
  .sort((a, b) => b.total - a.total)
  .map(p => ({ usuario: p.usuario, total: p.total, especialidade: p.especialidade?.familia || '', ritmo: p.ritmo })))
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
const incluir = (usuarios) => { selecionados.value = new Set([...selecionados.value, ...usuarios]) }
const buscaColab = ref('')
const colaboradoresVisiveis = computed(() => colaboradores.value.filter(c => correspondeBusca(buscaColab.value, [c.usuario, c.especialidade])))

const horaInicio = ref(props.inicio)
const horaFim = ref(props.fim)
const ritmoPadrao = ref(120)
watch(ritmoMediano, v => { ritmoPadrao.value = v }, { immediate: true })
const minutos = hhmm => { const [h, m] = String(hhmm).split(':').map(Number); return (h || 0) * 60 + (m || 0) }
const horas = computed(() => Math.max(0.5, (minutos(horaFim.value) - minutos(horaInicio.value)) / 60))

// Ajustes manuais: área → colaborador, lembrados por auditoria neste navegador.
const chaveFixas = () => `dashboard_ti_escala_${props.auditoria?.id}`
const lerFixas = () => { try { return new Map(JSON.parse(localStorage.getItem(chaveFixas()) || '[]')) } catch { return new Map() } }
const fixas = ref(lerFixas())
watch(() => props.auditoria?.id, () => { fixas.value = lerFixas() })
const salvarFixas = (mapa) => {
  fixas.value = mapa
  try { mapa.size ? localStorage.setItem(chaveFixas(), JSON.stringify([...mapa])) : localStorage.removeItem(chaveFixas()) } catch {}
}
const fixar = (bloco, usuario) => {
  const novo = new Map(fixas.value)
  usuario ? novo.set(bloco, usuario) : novo.delete(bloco)
  salvarFixas(novo)
}
const fixasAtivas = computed(() => [...fixas.value].filter(([, u]) => selecionados.value.has(u)).length)

const escala = computed(() => montarEscala({
  areas: areas.value,
  pessoas: colaboradores.value.filter(c => selecionados.value.has(c.usuario)).map(c => ({ usuario: c.usuario })),
  perfis: perfis.value,
  todosPerfis: perfis.value,
  setores: setores.value,
  inicio: horaInicio.value,
  fim: horaFim.value,
  ritmoPadrao: Math.max(1, Number(ritmoPadrao.value) || 1),
  fixas: fixas.value
}))

// Cores das pessoas (sem vermelho, reservado para alertas).
const CORES = ['#2563eb', '#f97316', '#059669', '#7c3aed', '#0891b2', '#ca8a04', '#db2777', '#475569', '#65a30d', '#0d9488', '#4f46e5', '#9333ea']
const cor = pessoa => CORES[(pessoa - 1) % CORES.length]
const grupoDaArea = computed(() => new Map(escala.value.grupos.flatMap(g => g.areas.map(a => [a.bloco, g]))))
const areaDoGrupo = (bloco) => grupoDaArea.value.get(bloco)?.areas.find(a => a.bloco === bloco)

const nomeCurto = a => (a.tipo === 'gondola' ? `Corr. ${String(a.numero).padStart(2, '0')}` : nomeArea(a))
const resumirAreas = (lista) => {
  const corredores = lista.filter(a => a.tipo === 'gondola').map(a => String(a.numero).padStart(2, '0'))
  const outras = lista.filter(a => a.tipo !== 'gondola').map(a => nomeArea(a))
  return [corredores.length ? `Corredor${corredores.length > 1 ? 'es' : ''} ${corredores.join(', ')}` : '', ...outras].filter(Boolean).join(' · ')
}
const perfilTexto = (g) => {
  if (g.semHistorico) return 'Sem histórico: ritmo padrão'
  const partes = [g.especialidade ? `${g.especialidade.familia} ${Math.round(g.especialidade.parcela * 100)}%` : '', `${Math.round(g.ritmo)}/h`, g.acerto !== null ? `${g.acerto.toFixed(0)}% acerto` : '']
  return partes.filter(Boolean).join(' · ')
}

// Interação mapa ↔ lista: destacar a pessoa, escolher uma área para reatribuir.
const destaque = ref(null)
const areaEscolhida = ref(null)
const opacidade = (p) => {
  const g = grupoDaArea.value.get(p.id)
  if (destaque.value) return g?.usuario === destaque.value ? 1 : 0.12
  if (areaEscolhida.value) return p.id === areaEscolhida.value ? 1 : 0.5
  return g ? 0.9 : 1
}
const infoArea = computed(() => {
  if (!areaEscolhida.value) return null
  const a = areas.value.find(x => x.bloco === areaEscolhida.value)
  if (!a) return null
  const g = grupoDaArea.value.get(a.bloco)
  const atual = areaDoGrupo(a.bloco)
  // Quem tem a área no perfil aparece primeiro.
  const opcoes = escala.value.grupos.map(x => {
    const perfil = perfis.value.get(x.usuario)
    const familia = familiaDoTipo(a.tipo)
    const parcela = perfil?.total ? (perfil.porFamilia.get(familia) || 0) / perfil.total : 0
    return { ...x, parcela, noPerfil: parcela >= 0.08 || (perfil?.porArea.get(a.bloco) || 0) >= 10 }
  }).sort((x, y) => y.noPerfil - x.noPerfil || y.parcela - x.parcela)
  return { ...a, nome: rotulo({ id: a.bloco }), familia: familiaDoTipo(a.tipo), setor: setores.value.get(a.bloco) || '', grupo: g, atual, fixa: fixas.value.has(a.bloco), opcoes }
})
const escolherArea = (id) => {
  if (!areas.value.some(a => a.bloco === id)) return
  areaEscolhida.value = areaEscolhida.value === id ? null : id
}

// Mapa
const layout = computed(() => mesclarLayout(gerarLayoutPadrao(areasAuditoria.value.values()), carregarLayoutSalvo()))
const posicoes = computed(() => layout.value.posicoes.filter(p => !p.oculto))
const rotulo = (p) => {
  const area = areasAuditoria.value.get(p.id) || { bloco: p.id, ...interpretarLocal(p.id) }
  return area.tipo === 'gondola' ? p.id.slice(1) : nomeArea(area)
}
const iniciais = usuario => (rotuloUsuario(usuario).split(' ').filter(Boolean).slice(0, 2).map(x => x[0]).join('') || '?').toUpperCase()

// Linha do tempo de cada pessoa sobre o horário da auditoria.
const inicioMin = computed(() => minutos(horaInicio.value))
const fimEscala = computed(() => Math.max(minutos(horaFim.value), escala.value.termino || 0))
const posicao = m => `${Math.max(0, Math.min(100, ((m - inicioMin.value) / Math.max(30, fimEscala.value - inicioMin.value)) * 100))}%`
const largura = (a, b) => `${Math.max(1, Math.min(100, ((b - a) / Math.max(30, fimEscala.value - inicioMin.value)) * 100))}%`

const TOM_AVISO = { ruim: 'bg-red-50 text-red-800', alerta: 'bg-amber-50 text-amber-900', neutro: 'bg-slate-50 text-slate-700' }
const ICONE_AVISO = { ruim: 'fas fa-user-slash', alerta: 'fas fa-clock', neutro: 'fas fa-circle-info' }

// Escala impressa para afixar ou entregar à equipe: uma linha por pessoa, com assinatura.
const imprimirEscala = () => {
  const e = escala.value
  if (!e.grupos.length) return
  imprimirRelatorio({
    titulo: 'Escala da auditoria',
    subtitulo: `${props.auditoria.tipo} · ${horaInicio.value} às ${horaFim.value}`,
    contexto: [
      { rotulo: 'Base', valor: `${baseMesmoTipo.value ? props.auditoria.tipo : 'Todos os tipos'} · últimas ${historicoAuditorias.value.length} auditorias` },
      { rotulo: 'Horário', valor: `${horaInicio.value} às ${horaFim.value}` },
      { rotulo: 'Colaboradores', valor: `${e.grupos.length} (necessárias: ${e.pessoasNecessarias})` },
      { rotulo: 'Término previsto', valor: e.termino ? textoHora(e.termino) : '—' }
    ],
    indicadores: [
      { rotulo: 'Itens a auditar', valor: e.totalItens.toLocaleString('pt-BR'), tom: 'neutro' },
      { rotulo: 'Pessoas necessárias', valor: e.pessoasNecessarias, tom: e.pessoasNecessarias > e.grupos.length ? 'ruim' : 'bom' },
      { rotulo: 'Término previsto', valor: e.termino ? textoHora(e.termino) : '—', tom: e.cabeNoHorario ? 'bom' : 'ruim' },
      { rotulo: 'No perfil', valor: `${e.aderencia.toFixed(0)}%`, detalhe: 'itens com quem já lê aquele tipo de área', tom: 'neutro' }
    ],
    secoes: [{
      titulo: 'Divisão por colaborador',
      html: blocoTabela({
        colunas: [
          { chave: 'pessoa', titulo: '#', alinhamento: 'right' }, { chave: 'nome', titulo: 'Colaborador' }, { chave: 'areas', titulo: 'Áreas' },
          { chave: 'itens', titulo: 'Itens', alinhamento: 'right', format: v => v.toLocaleString('pt-BR') }, { chave: 'ritmo', titulo: 'Ritmo (/h)', alinhamento: 'right' },
          { chave: 'periodo', titulo: 'Horário', alinhamento: 'right', html: (v, l) => (l.estoura ? selo(v, 'ruim') : escapeHtml(v)) },
          { chave: 'visto', titulo: 'Visto', html: () => '&nbsp;'.repeat(18) }
        ],
        linhas: e.grupos.map(g => ({ pessoa: g.pessoa, nome: rotuloUsuario(g.usuario), areas: resumirAreas(g.areas) || '—', itens: g.itens, ritmo: Math.round(g.ritmo), periodo: `${textoHora(g.disponivel.inicio)}–${textoHora(g.termino)}`, estoura: g.passa }))
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
        <p class="text-xs text-slate-500">Cada pessoa só recebe áreas do próprio perfil (onde já lê), no ritmo dela naquele tipo de área, no horário em que costuma ler e sem ficar espalhada pela loja.</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button v-if="fixas.size" type="button" class="ui-btn-secondary py-1.5 text-xs" title="Volta à divisão automática" @click="salvarFixas(new Map()); areaEscolhida = null"><i class="fas fa-rotate-left"></i>Desfazer ajustes ({{ fixasAtivas }})</button>
        <button type="button" class="ui-btn-secondary py-1.5 text-xs" :disabled="!escala.grupos.length" @click="imprimirEscala"><i class="fas fa-print"></i>Imprimir escala</button>
        <label class="flex items-center gap-2 text-xs font-semibold text-slate-600">
          Histórico
          <select v-model.number="base" class="ui-input w-auto py-1.5 text-xs">
            <option v-for="n in BASES" :key="n" :value="n">últimas {{ n }}</option>
          </select>
        </label>
      </div>
    </div>
    <p class="mt-1 text-[11px] text-slate-500">
      Base: {{ historicoAuditorias.length }} auditoria(s) {{ baseMesmoTipo ? `de ${auditoria.tipo}` : 'de todos os tipos (poucas do mesmo tipo)' }}.
    </p>

    <!-- Colaboradores -->
    <div class="mt-4 rounded-xl bg-slate-50 p-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <p class="text-xs font-bold text-slate-700">Colaboradores na escala: {{ selecionados.size }}</p>
        <input v-model="buscaColab" type="search" class="ui-input w-full py-1.5 text-xs sm:w-56" placeholder="Buscar colaborador ou perfil..." aria-label="Buscar colaborador">
      </div>
      <p v-if="!colaboradores.length" class="mt-2 text-xs text-slate-500">Sem histórico de leituras por usuário nas auditorias salvas.</p>
      <div class="mt-2 flex max-h-36 flex-wrap gap-1.5 overflow-y-auto">
        <button v-for="c in colaboradoresVisiveis" :key="c.usuario" type="button" :aria-pressed="selecionados.has(c.usuario)"
          class="rounded-full px-2.5 py-1 text-xs font-semibold ring-1 transition" :class="selecionados.has(c.usuario) ? 'bg-blue-600 text-white ring-blue-600' : 'bg-white text-slate-700 ring-slate-200 hover:ring-blue-300'"
          :title="`${c.total.toLocaleString('pt-BR')} leituras no histórico${c.ritmo ? ` · ${Math.round(c.ritmo)}/h` : ''}`" @click="alternar(c.usuario)">
          <i :class="selecionados.has(c.usuario) ? 'fas fa-check mr-1' : 'fas fa-plus mr-1 opacity-50'"></i>{{ rotuloUsuario(c.usuario) }}
          <span v-if="c.especialidade" class="ml-1 font-medium opacity-75">· {{ c.especialidade }}</span>
        </button>
      </div>
    </div>

    <div class="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
      <label class="block"><span class="ui-label">Início</span><input v-model="horaInicio" type="time" class="ui-input"></label>
      <label class="block"><span class="ui-label">Fim</span><input v-model="horaFim" type="time" class="ui-input"></label>
      <label class="block"><span class="ui-label">Ritmo padrão (/h)</span><input v-model.number="ritmoPadrao" type="number" min="1" class="ui-input"></label>
    </div>
    <p class="mt-1 text-[11px] text-slate-500">O ritmo padrão vale só para quem não tem histórico com horário e para o cálculo de pessoas necessárias.</p>

    <div class="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
      <div class="rounded-xl bg-slate-50 p-3"><p class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Itens a auditar</p><p class="text-xl font-black text-slate-900">{{ escala.totalItens.toLocaleString('pt-BR') }}</p><p class="text-[11px] text-slate-500">{{ areas.length }} áreas</p></div>
      <div class="rounded-xl bg-slate-50 p-3">
        <p class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Pessoas necessárias</p>
        <p class="text-xl font-black" :class="escala.pessoasNecessarias > selecionados.size ? 'text-red-700' : 'text-slate-900'">{{ escala.pessoasNecessarias }} <span class="text-sm font-semibold text-slate-500">/ {{ selecionados.size }} escaladas</span></p>
        <p class="text-[11px] text-slate-500">{{ horas.toFixed(1).replace('.', ',') }}h a {{ ritmoPadrao }}/h</p>
      </div>
      <div class="rounded-xl bg-slate-50 p-3">
        <p class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Término previsto</p>
        <p class="text-xl font-black" :class="escala.cabeNoHorario ? 'text-slate-900' : 'text-red-700'">{{ escala.grupos.length && escala.termino ? textoHora(escala.termino) : '—' }}</p>
        <p class="text-[11px] text-slate-500">{{ escala.cabeNoHorario ? `dentro do horário (${horaFim})` : `passa de ${horaFim}` }}</p>
      </div>
      <div class="rounded-xl bg-slate-50 p-3">
        <p class="text-[11px] font-bold uppercase tracking-wider text-slate-500">No perfil</p>
        <p class="text-xl font-black" :class="escala.aderencia >= 95 ? 'text-slate-900' : 'text-amber-700'">{{ escala.aderencia.toFixed(0) }}%</p>
        <p class="text-[11px] text-slate-500">dos itens com quem já lê ali</p>
      </div>
    </div>

    <!-- Avisos e sugestões -->
    <ul v-if="escala.avisos.length" class="mt-3 space-y-1.5">
      <li v-for="(a, i) in escala.avisos" :key="i" class="flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-xs" :class="TOM_AVISO[a.tom]">
        <i :class="ICONE_AVISO[a.tom]" aria-hidden="true"></i>
        <span class="min-w-0 flex-1">{{ a.texto }}<template v-if="a.sugestao"> <b>{{ a.sugestao }}.</b></template></span>
        <button v-if="a.usuarios.length" type="button" class="rounded-md bg-white px-2 py-1 font-semibold text-slate-800 shadow-sm hover:bg-slate-50" @click="incluir(a.usuarios.slice(0, 1))"><i class="fas fa-user-plus mr-1"></i>Incluir</button>
      </li>
    </ul>

    <p v-if="!areas.length" class="mt-4 rounded-xl bg-slate-50 py-8 text-center text-sm text-slate-500">Sem contagem por local nesta auditoria.</p>
    <p v-else-if="!escala.grupos.length" class="mt-4 rounded-xl bg-slate-50 py-8 text-center text-sm text-slate-500">Escolha ao menos um colaborador.</p>
    <div v-else class="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_440px]">
      <div class="min-w-0">
        <div class="overflow-x-auto rounded-xl bg-slate-50 p-3">
          <svg :viewBox="`-0.5 -0.5 ${layout.colunas + 1} ${layout.linhas + 1}`" class="w-full min-w-[600px]" role="img" aria-label="Divisão das áreas por colaborador">
            <g v-for="p in posicoes" :key="p.id">
              <rect :x="p.x + 0.08" :y="p.y + 0.08" :width="p.w - 0.16" :height="p.h - 0.16" rx="0.35" :fill="grupoDaArea.has(p.id) ? cor(grupoDaArea.get(p.id).pessoa) : '#e2e8f0'"
                :fill-opacity="opacidade(p)" :stroke="areaEscolhida === p.id ? '#0f172a' : areaDoGrupo(p.id)?.foraDoPerfil ? '#dc2626' : '#fff'" :stroke-width="areaEscolhida === p.id || areaDoGrupo(p.id)?.foraDoPerfil ? 0.18 : 0.08"
                :stroke-dasharray="areaDoGrupo(p.id)?.foraDoPerfil && areaEscolhida !== p.id ? '0.3 0.2' : undefined"
                class="cursor-pointer transition-[fill-opacity,fill] duration-300" @mouseenter="grupoDaArea.has(p.id) && !areaEscolhida && (destaque = grupoDaArea.get(p.id).usuario)" @mouseleave="destaque = null" @click="destaque = null; escolherArea(p.id)">
                <title>{{ rotulo(p) }}{{ grupoDaArea.has(p.id) ? ` · ${rotuloUsuario(grupoDaArea.get(p.id).usuario)}` : '' }}{{ setores.get(p.id) ? ` · ${setores.get(p.id)}` : '' }}{{ areaDoGrupo(p.id)?.foraDoPerfil ? ' · fora do perfil' : '' }}</title>
              </rect>
              <text class="pointer-events-none" :x="p.x + p.w / 2" :y="p.y + p.h / 2 - (grupoDaArea.has(p.id) && p.h > 2 ? 0.45 : 0)" text-anchor="middle" dominant-baseline="central" font-size="0.75" font-weight="800" :fill="grupoDaArea.has(p.id) ? '#fff' : '#64748b'">{{ rotulo(p) }}</text>
              <text v-if="fixas.has(p.id) && grupoDaArea.has(p.id)" :x="p.x + p.w - 0.45" :y="p.y + 0.55" text-anchor="middle" dominant-baseline="central" font-size="0.55" fill="#fff" class="pointer-events-none">●</text>
              <text v-if="grupoDaArea.has(p.id) && p.h > 2" class="pointer-events-none" :x="p.x + p.w / 2" :y="p.y + p.h / 2 + 0.55" text-anchor="middle" dominant-baseline="central" font-size="0.62" font-weight="700" fill="#fff">{{ iniciais(grupoDaArea.get(p.id).usuario) }}</text>
            </g>
          </svg>
        </div>

        <transition name="fade" mode="out-in">
          <div v-if="infoArea" :key="infoArea.bloco" class="mt-3 rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
            <div class="flex flex-wrap items-baseline justify-between gap-2">
              <p class="text-sm font-bold text-slate-900">{{ infoArea.nome }} <span class="text-xs font-medium text-slate-500">· {{ infoArea.familia }} · {{ infoArea.itens.toLocaleString('pt-BR') }} itens{{ infoArea.setor ? ` · ${infoArea.setor}` : '' }}</span></p>
              <button type="button" class="text-xs font-semibold text-slate-500 hover:text-slate-800" @click="areaEscolhida = null"><i class="fas fa-xmark mr-1"></i>Fechar</button>
            </div>
            <p v-if="infoArea.atual?.foraDoPerfil" class="mt-1 text-[11px] text-red-700"><i class="fas fa-triangle-exclamation mr-1"></i>Ninguém escalado tem {{ infoArea.familia }} no perfil.</p>
            <p class="mt-2 text-[11px] text-slate-500">Passar para:</p>
            <div class="mt-1.5 flex flex-wrap gap-1.5">
              <button v-for="g in infoArea.opcoes" :key="g.usuario" type="button" class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 transition"
                :class="infoArea.grupo?.usuario === g.usuario ? 'bg-slate-900 text-white ring-slate-900' : g.noPerfil ? 'bg-white text-slate-700 ring-slate-200 hover:ring-slate-400' : 'bg-white text-slate-400 ring-slate-100 hover:ring-slate-300'"
                :title="g.noPerfil ? `${Math.round(g.parcela * 100)}% das leituras em ${infoArea.familia}` : `Não costuma ler ${infoArea.familia}`" @click="fixar(infoArea.bloco, g.usuario)">
                <span class="size-2.5 rounded-full" :style="{ background: cor(g.pessoa) }"></span>{{ rotuloUsuario(g.usuario) }}
                <i v-if="!g.noPerfil" class="fas fa-ban text-[10px]" aria-label="fora do perfil"></i>
              </button>
              <button v-if="infoArea.fixa" type="button" class="rounded-full px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-200 hover:bg-blue-50" @click="fixar(infoArea.bloco, null)"><i class="fas fa-wand-magic-sparkles mr-1"></i>Automático</button>
            </div>
          </div>
          <p v-else class="mt-2 text-[11px] text-slate-500">Clique numa área para passá-la a outra pessoa (● = ajuste manual) · passe o mouse num nome para ver as áreas dela · borda vermelha tracejada = fora do perfil.</p>
        </transition>
      </div>

      <!-- Divisão por pessoa -->
      <div class="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
        <div class="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
          <span>Divisão por pessoa</span><span>{{ horaInicio }} – {{ textoHora(fimEscala) }}</span>
        </div>
        <ol class="max-h-[600px] divide-y divide-slate-100 overflow-y-auto">
          <li v-for="g in escala.grupos" :key="g.usuario" class="px-4 py-3 transition-colors"
            :class="destaque === g.usuario || infoArea?.grupo?.usuario === g.usuario ? 'bg-slate-50' : ''"
            @mouseenter="destaque = g.usuario" @mouseleave="destaque = null">
            <div class="flex items-start gap-3">
              <span class="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white" :style="{ background: cor(g.pessoa) }">{{ iniciais(g.usuario) }}</span>
              <div class="min-w-0 flex-1">
                <div class="flex items-baseline justify-between gap-2">
                  <p class="truncate text-sm font-bold text-slate-900">{{ rotuloUsuario(g.usuario) }}</p>
                  <p class="shrink-0 text-xs font-bold tabular-nums" :class="g.passa ? 'text-red-700' : 'text-slate-700'">{{ textoHora(g.disponivel.inicio) }}–{{ textoHora(g.termino) }}</p>
                </div>
                <p class="truncate text-[11px] text-slate-500">{{ perfilTexto(g) }}</p>

                <div class="relative mt-2 h-1.5 rounded-full bg-slate-100" :title="`Carga ${g.carga.toFixed(0)}% da capacidade`">
                  <div class="absolute inset-y-0 rounded-full transition-all duration-500" :style="{ left: posicao(g.disponivel.inicio), width: largura(g.disponivel.inicio, g.termino), background: g.passa ? '#dc2626' : cor(g.pessoa) }"></div>
                  <div class="absolute -inset-y-1 w-px bg-slate-400" :style="{ left: posicao(minutos(horaFim)) }"></div>
                </div>

                <div class="mt-2 flex flex-wrap gap-1">
                  <span v-for="a in g.areas" :key="a.bloco" class="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold"
                    :class="a.foraDoPerfil ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-700'" :title="`${a.itens} itens · ${Math.round(a.horas * 60)} min${a.foraDoPerfil ? ' · fora do perfil' : ''}`">
                    <i v-if="a.fixa" class="fas fa-thumbtack text-[9px] text-slate-400" aria-label="ajuste manual"></i>{{ nomeCurto(a) }}
                  </span>
                  <span v-if="!g.areas.length" class="text-[11px] text-slate-400">Sem áreas</span>
                </div>
                <p class="mt-1.5 text-[11px] text-slate-500">
                  {{ g.itens.toLocaleString('pt-BR') }} itens · {{ g.areas.length }} área(s) · {{ g.locais }} local(is) · carga {{ g.carga.toFixed(0) }}%
                </p>
              </div>
            </div>
          </li>
        </ol>
      </div>
    </div>
  </section>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
