<script setup>
import { computed, ref, watch } from 'vue'
import UiAcoes from './ui/UiAcoes.vue'
import { GRUPOS } from '../composables/useAcoes'
import { agregarPorArea, carregarLayoutSalvo, gerarLayoutPadrao, interpretarLocal, mesclarLayout, nomeArea } from '../utils/mapaLoja'
import { mediana, ritmosDaAuditoria } from '../utils/planoAcao'
import { familiaDoTipo, montarEscala, nomeUnidade, perfisColaboradores, textoHora, unidadeDoLocal } from '../utils/perfilColaborador'
import { localDoItem, setorDoItem } from '../utils/itemAuditoria'
import { useAuditoriasStore } from '../stores/auditoriasStore'
import { correspondeBusca } from '../utils/busca'
import { rotuloUsuario, separarUsuario } from '../utils/usuario'
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

// Locais a auditar (tamanho pela auditoria atual): cada face de corredor é um local (G05A, G05B...).
const areasAuditoria = computed(() => agregarPorArea(props.auditoria, () => false))
const areas = computed(() => {
  const mapa = new Map()
  for (const [local, d] of Object.entries(props.auditoria?.analise?.porLocal || {})) {
    const info = interpretarLocal(local)
    const id = unidadeDoLocal(info)
    const u = mapa.get(id) || { id, bloco: info.bloco, tipo: info.tipo, numero: info.numero, face: info.tipo === 'gondola' ? info.face : undefined, itens: 0, locais: 0 }
    u.itens += (d?.lidos || 0) + (d?.pendentes || 0) + (d?.comProblema || 0)
    u.locais++
    mapa.set(id, u)
  }
  return [...mapa.values()].filter(u => u.itens > 0).map(u => ({ ...u, nome: nomeUnidade(u) }))
})
// Setor predominante de cada local (pelos itens da auditoria).
const setores = computed(() => {
  const contagem = new Map()
  for (const item of Array.isArray(props.auditoria?.dados) ? props.auditoria.dados : []) {
    const id = unidadeDoLocal(interpretarLocal(localDoItem(item)))
    const m = contagem.get(id) || new Map()
    const setor = setorDoItem(item)
    m.set(setor, (m.get(setor) || 0) + 1)
    contagem.set(id, m)
  }
  return new Map([...contagem].map(([id, m]) => [id, [...m].sort((a, b) => b[1] - a[1])[0]?.[0] || '']))
})

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
// Lista agrupada por perfil (família em que a pessoa mais lê), por volume de leituras.
const leramNestaAuditoria = computed(() => new Set(Object.keys(props.auditoria?.analise?.porUsuario || {})))
const gruposColab = computed(() => {
  const mapa = new Map()
  for (const c of colaboradoresVisiveis.value) {
    const chave = c.especialidade || 'Sem perfil'
    mapa.set(chave, [...(mapa.get(chave) || []), c])
  }
  return [...mapa].map(([perfil, lista]) => ({
    perfil,
    lista: lista.sort((a, b) => b.total - a.total),
    escalados: lista.filter(c => selecionados.value.has(c.usuario)).length
  })).sort((a, b) => b.lista.length - a.lista.length)
})
const definirGrupo = (lista, marcar) => {
  const novo = new Set(selecionados.value)
  for (const c of lista) marcar ? novo.add(c.usuario) : novo.delete(c.usuario)
  selecionados.value = novo
}
const selecionarAtalho = (tipo) => {
  if (tipo === 'auditoria') selecionados.value = new Set(colaboradores.value.filter(c => leramNestaAuditoria.value.has(c.usuario)).map(c => c.usuario))
  else if (tipo === 'todos') selecionados.value = new Set(colaboradores.value.map(c => c.usuario))
  else selecionados.value = new Set()
}
const nomeDe = u => separarUsuario(u).nome || u
const matriculaDe = u => separarUsuario(u).matricula

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
const grupoDaArea = computed(() => new Map(escala.value.grupos.flatMap(g => g.areas.map(a => [a.id, g]))))
const areaDoGrupo = id => grupoDaArea.value.get(id)?.areas.find(a => a.id === id)

// Locais da pessoa agrupados por área: corredor inteiro vira "G05"; parte dele, "G05 A·B".
const facesPorBloco = computed(() => {
  const m = new Map()
  for (const a of areas.value) m.set(a.bloco, (m.get(a.bloco) || 0) + 1)
  return m
})
const chipsDe = (g) => {
  const blocos = new Map()
  for (const a of g.areas) blocos.set(a.bloco, [...(blocos.get(a.bloco) || []), a])
  return [...blocos.values()].map((lista) => {
    const a = lista[0]
    const inteiro = a.tipo !== 'gondola' || lista.length >= (facesPorBloco.value.get(a.bloco) || 1)
    return {
      chave: a.bloco,
      texto: a.tipo !== 'gondola' ? a.nome : inteiro ? a.bloco : `${a.bloco} ${lista.map(x => x.face).sort().join('·')}`,
      itens: lista.reduce((t, x) => t + x.itens, 0),
      minutos: Math.round(lista.reduce((t, x) => t + x.horas, 0) * 60),
      foraDoPerfil: lista.some(x => x.foraDoPerfil),
      fixa: lista.some(x => x.fixa),
      parcial: !inteiro
    }
  })
}

// "G05 A, B · G06 C · FLV" para a impressão.
const resumirAreas = (lista) => {
  const porCorredor = new Map()
  const outras = []
  for (const a of lista) {
    if (a.tipo === 'gondola' && a.face) porCorredor.set(a.bloco, [...(porCorredor.get(a.bloco) || []), a.face])
    else outras.push(a.nome || nomeArea(a))
  }
  return [...[...porCorredor].map(([b, f]) => `${b} ${f.sort().join(', ')}`), ...outras].join(' · ')
}
const perfilTexto = (g) => {
  if (g.semHistorico) return 'Sem histórico: ritmo padrão'
  const partes = [g.especialidade ? `${g.especialidade.familia} ${Math.round(g.especialidade.parcela * 100)}%` : '', `${Math.round(g.ritmo)}/h`, g.acerto !== null ? `${g.acerto.toFixed(0)}% acerto` : '']
  return partes.filter(Boolean).join(' · ')
}

// Interação mapa ↔ lista: destacar a pessoa, escolher uma área para reatribuir.
const destaque = ref(null)
const areaEscolhida = ref(null)
const opacidade = (id) => {
  const g = grupoDaArea.value.get(id)
  if (destaque.value) return g?.usuario === destaque.value ? 1 : 0.12
  if (areaEscolhida.value) return id === areaEscolhida.value ? 1 : 0.5
  return g ? 0.9 : 1
}
const corDe = id => (grupoDaArea.value.has(id) ? cor(grupoDaArea.value.get(id).pessoa) : '#e2e8f0')
const contorno = id => (areaEscolhida.value === id ? { stroke: '#0f172a', 'stroke-width': 0.16 } : areaDoGrupo(id)?.foraDoPerfil ? { stroke: '#dc2626', 'stroke-width': 0.14, 'stroke-dasharray': '0.3 0.2' } : { stroke: '#fff', 'stroke-width': 0.06 })
const entrar = id => { if (grupoDaArea.value.has(id) && !areaEscolhida.value) destaque.value = grupoDaArea.value.get(id).usuario }
const dica = id => {
  const a = areas.value.find(x => x.id === id)
  const g = grupoDaArea.value.get(id)
  return [a?.nome || id, a ? `${a.itens} itens` : 'sem itens', g ? rotuloUsuario(g.usuario) : '', setores.value.get(id) || '', areaDoGrupo(id)?.foraDoPerfil ? 'fora do perfil' : ''].filter(Boolean).join(' · ')
}
// Faces do corredor no desenho: D/B de um lado, C/A do outro (igual ao mapa da loja).
const facesDe = (p) => {
  const vertical = p.w < p.h
  const m = 0.08
  const [x, y, w, h] = [p.x + m, p.y + m, p.w - 2 * m, p.h - 2 * m]
  if (vertical) {
    const cw = w * 0.32
    return [['D', x, y, cw, h / 2], ['B', x, y + h / 2, cw, h / 2], ['C', x + w - cw, y, cw, h / 2], ['A', x + w - cw, y + h / 2, cw, h / 2]]
      .map(([f, fx, fy, fw, fh]) => ({ face: f, id: `${p.id}${f}`, x: fx, y: fy, w: fw, h: fh }))
  }
  const ch = h * 0.32
  return [['D', x, y, w / 2, ch], ['B', x + w / 2, y, w / 2, ch], ['C', x, y + h - ch, w / 2, ch], ['A', x + w / 2, y + h - ch, w / 2, ch]]
    .map(([f, fx, fy, fw, fh]) => ({ face: f, id: `${p.id}${f}`, x: fx, y: fy, w: fw, h: fh }))
}
const ehCorredor = p => (areasAuditoria.value.get(p.id)?.tipo || interpretarLocal(p.id).tipo) === 'gondola'
const infoArea = computed(() => {
  if (!areaEscolhida.value) return null
  const a = areas.value.find(x => x.id === areaEscolhida.value)
  if (!a) return null
  const g = grupoDaArea.value.get(a.id)
  const atual = areaDoGrupo(a.id)
  // Quem tem a área no perfil aparece primeiro.
  const opcoes = escala.value.grupos.map(x => {
    const perfil = perfis.value.get(x.usuario)
    const familia = familiaDoTipo(a.tipo)
    const parcela = perfil?.total ? (perfil.porFamilia.get(familia) || 0) / perfil.total : 0
    return { ...x, parcela, noPerfil: parcela >= 0.08 || (perfil?.porArea.get(a.bloco) || 0) >= 10 }
  }).sort((x, y) => y.noPerfil - x.noPerfil || y.parcela - x.parcela)
  return { ...a, familia: familiaDoTipo(a.tipo), setor: setores.value.get(a.id) || '', grupo: g, atual, fixa: fixas.value.has(a.id), opcoes }
})
const escolherArea = (id) => {
  if (!areas.value.some(a => a.id === id)) return
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
// Ações da escala (padrão do sistema; também no Ctrl+K).
const acoesEscala = computed(() => [
  { id: 'escala-imprimir', rotulo: 'Imprimir escala', icone: 'fas fa-print', nivel: 'secundaria', grupo: GRUPOS.exportar, desativado: !escala.value.grupos.length, termos: 'pdf escala equipe', executar: () => imprimirEscala() },
  { id: 'escala-desfazer', rotulo: `Desfazer ajustes (${fixasAtivas.value})`, detalhe: 'Volta à divisão automática', icone: 'fas fa-rotate-left', grupo: GRUPOS.dados, oculta: !fixas.value.size, executar: () => { salvarFixas(new Map()); areaEscolhida.value = null } }
])
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
  <section class="rounded-xl bg-white p-5 shadow-sm">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 class="text-lg font-bold text-slate-900"><i class="fas fa-people-arrows mr-2 text-blue-600"></i>Escala sugerida para a próxima auditoria</h3>
        <p class="text-xs text-slate-500">Cada local (face de corredor) vai para quem costuma lê-lo nas auditorias. Faces do mesmo corredor com setores diferentes podem ficar com pessoas diferentes. Ninguém sai do próprio perfil, passa da capacidade ou fica espalhado pela loja.</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <UiAcoes :acoes="acoesEscala" contexto="Escala sugerida" tamanho="sm" />
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
    <div class="mt-4 overflow-hidden rounded-xl ring-1 ring-slate-200">
      <div class="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
        <p class="text-xs font-bold text-slate-700">Na escala: <span class="text-blue-700">{{ selecionados.size }}</span> <span class="font-medium text-slate-500">de {{ colaboradores.length }}</span></p>
        <div class="flex flex-wrap gap-1">
          <button type="button" class="rounded-md px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-white hover:text-slate-900" @click="selecionarAtalho('auditoria')">Quem leu nesta auditoria ({{ colaboradores.filter(c => leramNestaAuditoria.has(c.usuario)).length }})</button>
          <button type="button" class="rounded-md px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-white hover:text-slate-900" @click="selecionarAtalho('todos')">Todos</button>
          <button type="button" class="rounded-md px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-white hover:text-slate-900" @click="selecionarAtalho('nenhum')">Nenhum</button>
        </div>
        <label class="relative ml-auto w-full sm:w-56">
          <span class="sr-only">Buscar colaborador</span>
          <i class="fas fa-search pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400" aria-hidden="true"></i>
          <input v-model="buscaColab" type="search" class="ui-input w-full py-1.5 pl-7 text-xs" placeholder="Nome, matrícula ou perfil...">
        </label>
      </div>
      <p v-if="!colaboradores.length" class="px-3 py-4 text-xs text-slate-500">Sem histórico de leituras por usuário nas auditorias salvas.</p>
      <p v-else-if="!gruposColab.length" class="px-3 py-4 text-xs text-slate-500">Ninguém encontrado.</p>
      <div v-else class="max-h-72 divide-y divide-slate-100 overflow-y-auto">
        <section v-for="grupo in gruposColab" :key="grupo.perfil" class="px-3 py-2">
          <div class="mb-1 flex items-center gap-2">
            <p class="text-xs font-semibold text-slate-500">{{ grupo.perfil }}</p>
            <span class="text-[11px] text-slate-400">{{ grupo.escalados }}/{{ grupo.lista.length }}</span>
            <button type="button" class="ml-auto text-[11px] font-semibold text-blue-700 hover:underline" @click="definirGrupo(grupo.lista, grupo.escalados < grupo.lista.length)">{{ grupo.escalados < grupo.lista.length ? 'Marcar grupo' : 'Desmarcar grupo' }}</button>
          </div>
          <div class="grid grid-cols-1 gap-x-3 sm:grid-cols-2 xl:grid-cols-3">
            <label v-for="c in grupo.lista" :key="c.usuario" class="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 transition hover:bg-slate-50" :class="selecionados.has(c.usuario) ? 'text-slate-900' : 'text-slate-500'">
              <input type="checkbox" class="size-3.5 shrink-0 accent-blue-600" :checked="selecionados.has(c.usuario)" @change="alternar(c.usuario)">
              <span class="min-w-0 flex-1 truncate text-xs" :class="selecionados.has(c.usuario) ? 'font-semibold' : ''">{{ nomeDe(c.usuario) }}<span v-if="matriculaDe(c.usuario)" class="ml-1 font-normal text-slate-400">{{ matriculaDe(c.usuario) }}</span></span>
              <i v-if="leramNestaAuditoria.has(c.usuario)" class="fas fa-circle text-[5px] text-emerald-500" title="Leu nesta auditoria"></i>
              <span class="shrink-0 text-[10px] tabular-nums text-slate-400">{{ c.ritmo ? `${Math.round(c.ritmo)}/h` : '—' }}</span>
            </label>
          </div>
        </section>
      </div>
    </div>

    <div class="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
      <label class="block"><span class="ui-label">Início</span><input v-model="horaInicio" type="time" class="ui-input"></label>
      <label class="block"><span class="ui-label">Fim</span><input v-model="horaFim" type="time" class="ui-input"></label>
      <label class="block"><span class="ui-label">Ritmo padrão (/h)</span><input v-model.number="ritmoPadrao" type="number" min="1" class="ui-input"></label>
    </div>
    <p class="mt-1 text-[11px] text-slate-500">O ritmo padrão vale só para quem não tem histórico com horário e para o cálculo de pessoas necessárias.</p>

    <div class="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
      <div class="rounded-xl bg-slate-50 p-3"><p class="text-xs font-semibold text-slate-500">Itens a auditar</p><p class="text-xl font-black text-slate-900">{{ escala.totalItens.toLocaleString('pt-BR') }}</p><p class="text-[11px] text-slate-500">{{ areas.length }} locais</p></div>
      <div class="rounded-xl bg-slate-50 p-3">
        <p class="text-xs font-semibold text-slate-500">Pessoas necessárias</p>
        <p class="text-xl font-black" :class="escala.pessoasNecessarias > selecionados.size ? 'text-red-700' : 'text-slate-900'">{{ escala.pessoasNecessarias }} <span class="text-sm font-semibold text-slate-500">/ {{ selecionados.size }} escaladas</span></p>
        <p class="text-[11px] text-slate-500">{{ horas.toFixed(1).replace('.', ',') }}h a {{ ritmoPadrao }}/h</p>
      </div>
      <div class="rounded-xl bg-slate-50 p-3">
        <p class="text-xs font-semibold text-slate-500">Término previsto</p>
        <p class="text-xl font-black" :class="escala.cabeNoHorario ? 'text-slate-900' : 'text-red-700'">{{ escala.grupos.length && escala.termino ? textoHora(escala.termino) : '—' }}</p>
        <p class="text-[11px] text-slate-500">{{ escala.cabeNoHorario ? `dentro do horário (${horaFim})` : `passa de ${horaFim}` }}</p>
      </div>
      <div class="rounded-xl bg-slate-50 p-3">
        <p class="text-xs font-semibold text-slate-500">No perfil</p>
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
          <svg :viewBox="`-0.5 -0.5 ${layout.colunas + 1} ${layout.linhas + 1}`" class="w-full min-w-[600px]" role="img" aria-label="Divisão dos locais por colaborador">
            <g v-for="p in posicoes" :key="p.id">
              <!-- Corredor: número no meio e as 4 faces (locais) em volta, cada uma com a sua pessoa. -->
              <template v-if="ehCorredor(p)">
                <rect :x="p.x + 0.08" :y="p.y + 0.08" :width="p.w - 0.16" :height="p.h - 0.16" rx="0.3" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="0.05" />
                <text class="pointer-events-none" :x="p.x + p.w / 2" :y="p.y + p.h / 2" text-anchor="middle" dominant-baseline="central" font-size="0.7" font-weight="800" fill="#334155">{{ rotulo(p) }}</text>
                <g v-for="f in facesDe(p)" :key="f.id">
                  <rect :x="f.x" :y="f.y" :width="f.w" :height="f.h" rx="0.15" :fill="corDe(f.id)" :fill-opacity="opacidade(f.id)" v-bind="contorno(f.id)"
                    class="cursor-pointer transition-[fill-opacity,fill] duration-300" @mouseenter="entrar(f.id)" @mouseleave="destaque = null" @click="destaque = null; escolherArea(f.id)">
                    <title>{{ dica(f.id) }}</title>
                  </rect>
                  <text class="pointer-events-none" :x="f.x + f.w / 2" :y="f.y + f.h / 2" text-anchor="middle" dominant-baseline="central" font-size="0.5" font-weight="800" :fill="grupoDaArea.has(f.id) ? '#fff' : '#94a3b8'">{{ grupoDaArea.has(f.id) && f.h > 1.2 ? iniciais(grupoDaArea.get(f.id).usuario) : f.face }}</text>
                  <text v-if="fixas.has(f.id) && grupoDaArea.has(f.id)" class="pointer-events-none" :x="f.x + f.w - 0.25" :y="f.y + 0.3" text-anchor="middle" dominant-baseline="central" font-size="0.4" fill="#fff">●</text>
                </g>
              </template>
              <template v-else>
                <rect :x="p.x + 0.08" :y="p.y + 0.08" :width="p.w - 0.16" :height="p.h - 0.16" rx="0.35" :fill="corDe(p.id)" :fill-opacity="opacidade(p.id)" v-bind="contorno(p.id)"
                  class="cursor-pointer transition-[fill-opacity,fill] duration-300" @mouseenter="entrar(p.id)" @mouseleave="destaque = null" @click="destaque = null; escolherArea(p.id)">
                  <title>{{ dica(p.id) }}</title>
                </rect>
                <text class="pointer-events-none" :x="p.x + p.w / 2" :y="p.y + p.h / 2 - (grupoDaArea.has(p.id) && p.h > 2 ? 0.45 : 0)" text-anchor="middle" dominant-baseline="central" font-size="0.75" font-weight="800" :fill="grupoDaArea.has(p.id) ? '#fff' : '#64748b'">{{ rotulo(p) }}</text>
                <text v-if="grupoDaArea.has(p.id) && p.h > 2" class="pointer-events-none" :x="p.x + p.w / 2" :y="p.y + p.h / 2 + 0.55" text-anchor="middle" dominant-baseline="central" font-size="0.62" font-weight="700" fill="#fff">{{ iniciais(grupoDaArea.get(p.id).usuario) }}</text>
                <text v-if="fixas.has(p.id) && grupoDaArea.has(p.id)" :x="p.x + p.w - 0.45" :y="p.y + 0.55" text-anchor="middle" dominant-baseline="central" font-size="0.55" fill="#fff" class="pointer-events-none">●</text>
              </template>
            </g>
          </svg>
        </div>

        <transition name="fade" mode="out-in">
          <div v-if="infoArea" :key="infoArea.id" class="mt-3 rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
            <div class="flex flex-wrap items-baseline justify-between gap-2">
              <p class="text-sm font-bold text-slate-900">{{ infoArea.nome }} <span class="text-xs font-medium text-slate-500">· {{ infoArea.familia }} · {{ infoArea.itens.toLocaleString('pt-BR') }} itens{{ infoArea.setor ? ` · ${infoArea.setor}` : '' }}</span></p>
              <button type="button" class="text-xs font-semibold text-slate-500 hover:text-slate-800" @click="areaEscolhida = null"><i class="fas fa-xmark mr-1"></i>Fechar</button>
            </div>
            <p v-if="infoArea.atual?.foraDoPerfil" class="mt-1 text-[11px] text-red-700"><i class="fas fa-triangle-exclamation mr-1"></i>Ninguém escalado tem {{ infoArea.familia }} no perfil.</p>
            <p class="mt-2 text-[11px] text-slate-500">Passar para:</p>
            <div class="mt-1.5 flex flex-wrap gap-1.5">
              <button v-for="g in infoArea.opcoes" :key="g.usuario" type="button" class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 transition"
                :class="infoArea.grupo?.usuario === g.usuario ? 'bg-slate-900 text-white ring-slate-900' : g.noPerfil ? 'bg-white text-slate-700 ring-slate-200 hover:ring-slate-400' : 'bg-white text-slate-400 ring-slate-100 hover:ring-slate-300'"
                :title="g.noPerfil ? `${Math.round(g.parcela * 100)}% das leituras em ${infoArea.familia}` : `Não costuma ler ${infoArea.familia}`" @click="fixar(infoArea.id, g.usuario)">
                <span class="size-2.5 rounded-full" :style="{ background: cor(g.pessoa) }"></span>{{ rotuloUsuario(g.usuario) }}
                <i v-if="!g.noPerfil" class="fas fa-ban text-[10px]" aria-label="fora do perfil"></i>
              </button>
              <button v-if="infoArea.fixa" type="button" class="rounded-full px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-200 hover:bg-blue-50" @click="fixar(infoArea.id, null)"><i class="fas fa-list-check mr-1"></i>Automático</button>
            </div>
          </div>
          <p v-else class="mt-2 text-[11px] text-slate-500">Cada face de corredor é um local. Clique num local para passá-lo a outra pessoa (● = ajuste manual) · passe o mouse num nome para ver os locais dela · borda vermelha tracejada = fora do perfil.</p>
        </transition>
      </div>

      <!-- Divisão por pessoa -->
      <div class="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
        <div class="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 text-xs font-semibold text-slate-500">
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
                  <span v-for="c in chipsDe(g)" :key="c.chave" class="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold"
                    :class="c.foraDoPerfil ? 'bg-red-50 text-red-700' : c.parcial ? 'bg-white text-slate-600 ring-1 ring-slate-200' : 'bg-slate-100 text-slate-700'"
                    :title="`${c.itens} itens · ${c.minutos} min${c.parcial ? ' · parte do corredor' : ''}${c.foraDoPerfil ? ' · fora do perfil' : ''}`">
                    <i v-if="c.fixa" class="fas fa-thumbtack text-[9px] text-slate-400" aria-label="ajuste manual"></i>{{ c.texto }}
                  </span>
                  <span v-if="!g.areas.length" class="text-[11px] text-slate-400">Sem áreas</span>
                </div>
                <p class="mt-1.5 text-[11px] text-slate-500">
                  {{ g.itens.toLocaleString('pt-BR') }} itens · {{ g.areas.length }} local(is) em {{ new Set(g.areas.map(a => a.bloco)).size }} área(s) · carga {{ g.carga.toFixed(0) }}%
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
