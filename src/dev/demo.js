// Dados fictícios para testar o sistema localmente (só no `npm run dev`, abrindo com ?demo).
// As planilhas são geradas em CSV no mesmo formato do ERP e passam pelo mesmo processamento
// das reais. Apaga os dados deste navegador antes de criar os novos.
import { db } from '../db/appDb'
import { useAuditoriasStore } from '../stores/auditoriasStore'
import { useVencimentosStore } from '../stores/vencimentosStore'
import { mesclarImportacao, tratarPlanilha } from '../utils/naoVinculados'

// Aleatório com semente: os mesmos dados a cada carga.
let semente = 20261113
const rnd = () => {
  semente = (semente + 0x6D2B79F5) | 0
  let t = Math.imul(semente ^ (semente >>> 15), 1 | semente)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1))
const um = lista => lista[Math.floor(rnd() * lista.length)]
const chance = p => rnd() < p

const SETORES = {
  'MERCEARIA DOCE': ['G08A', 'G08B', 'G08C', 'G08D', 'G09C'],
  'MERCEARIA SALGADA': ['G06B', 'G06C', 'G06D', 'G07A', 'G07B', 'G09A', 'G09B'],
  'LIMPEZA': ['G04A', 'G04C', 'G04D'],
  'BAZAR': ['G04B', 'G05A', 'G05B', 'G05C'],
  'HIGIENE PESSOAL': ['G02A', 'G02B', 'G03A'],
  'BEBIDAS': ['G01A', 'G01B', 'G02C', 'G02D', 'PL01'],
  'BASICOS': ['G10A', 'G10B'],
  'LACTEO E PERECIVEL FRESCO': ['PF01', 'PF02', 'PF03'],
  'PERECIVEL INDUSTRIALIZADO': ['F01', 'F02', 'F03', 'EMP01'],
  'FLV': ['FLV'],
  'ACOUGUE / CARNE EMBALADA': ['ACG01']
}
const NOMES = {
  'MERCEARIA DOCE': ['CHOC', 'BISC RECH', 'BALA', 'ACHOCOLATADO', 'CEREAL MATINAL', 'DOCE LEITE', 'GELATINA', 'PANETTONE'],
  'MERCEARIA SALGADA': ['MOLHO TOM', 'MACARRAO', 'AZEITE', 'MILHO VERDE', 'ATUM', 'BISC SALG', 'MAIONESE', 'TEMPERO'],
  'LIMPEZA': ['DETERGENTE', 'SABAO PO', 'AMACIANTE', 'DESINF', 'ESPONJA', 'AGUA SANIT'],
  'BAZAR': ['POTE PLAST', 'PANO PRATO', 'COPO DESC', 'PILHA', 'LAMPADA', 'VASSOURA'],
  'HIGIENE PESSOAL': ['SH', 'COND', 'SABONETE', 'CR DENTAL', 'DESOD', 'PAPEL HIG'],
  'BEBIDAS': ['REFRIG', 'SUCO', 'AGUA MIN', 'CERVEJA', 'ENERGETICO', 'CHA GELADO'],
  'BASICOS': ['ARROZ', 'FEIJAO', 'ACUCAR', 'FARINHA TRIGO', 'CAFE', 'OLEO SOJA'],
  'LACTEO E PERECIVEL FRESCO': ['IOGURTE', 'QJ MUSSARELA', 'REQ CREM', 'MANTEIGA', 'LEITE FERM'],
  'PERECIVEL INDUSTRIALIZADO': ['SALSICHA', 'LING TOSCANA', 'PIZZA CONG', 'HAMBURGUER', 'NUGGETS'],
  'FLV': ['BANANA PRATA', 'TOMATE', 'BATATA', 'CEBOLA', 'MACA', 'ALFACE'],
  'ACOUGUE / CARNE EMBALADA': ['CAR BOV PATINHO', 'CAR BOV ALCATRA', 'P FGO COXA', 'CAR SU LOMBO']
}
const MARCAS = ['YPE', 'NESTLE', 'PREDILECTA', 'SADIA', 'SEARA', 'PIRACANJUBA', 'CAMIL', 'OMO', 'COLGATE', 'COCA-COLA', 'ITALAC', 'QUALY', 'ORQUIDEA', 'TIROLEZ']
const FORNECEDORES = ['8092 - PIRACANJUBA', '1201 - NESTLE BRASIL', '3310 - BRF', '4410 - JBS SEARA', '5520 - UNILEVER', '6630 - COCA-COLA FEMSA', '7740 - CAMIL ALIMENTOS', '9950 - DIST LOCAL']
const USUARIOS = ['5485398 (GISELE FERREIRA DE NORONHA)', '5512044 (JOAO PEDRO ALVES)', '5498120 (MARIA CLARA SOUZA)', '5530771 (CARLOS EDUARDO LIMA)', '5477310 (ANA BEATRIZ ROCHA)', '5521903 (RAFAEL OLIVEIRA)', '5503318 (PATRICIA GOMES)', '5541276 (LUCAS MENDES)']

const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const br = d => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
const somar = (d, dias) => { const n = new Date(d); n.setDate(n.getDate() + dias); return n }
const csv = (nome, colunas, linhas) => {
  const cel = v => `"${String(v ?? '').replaceAll('"', '""')}"`
  const texto = [colunas.map(cel).join(';'), ...linhas.map(l => colunas.map(c => cel(l[c])).join(';'))].join('\n')
  return new File([texto], `${nome}.csv`, { type: 'text/csv' })
}

// Catálogo: ~500 produtos, cada um com local, setor e classe.
const catalogo = []
let codigo = 100100
for (const [setor, locais] of Object.entries(SETORES)) {
  const raiz = `${10 + Object.keys(SETORES).indexOf(setor)} - ${setor}`
  for (let i = 0; i < locais.length * 12; i++) {
    const tipo = um(NOMES[setor])
    catalogo.push({
      codigo: String(codigo++),
      produto: `${tipo} ${um(MARCAS)} ${int(1, 20) * 50}${um(['G', 'ML', 'G', 'UN'])}`,
      setor: raiz,
      classe: `${raiz.split(' - ')[0]}.${NOMES[setor].indexOf(tipo) + 1} - ${tipo}`,
      local: locais[i % locais.length],
      fornecedor: um(FORNECEDORES),
      custo: (int(300, 4000) / 100).toFixed(2).replace('.', ',')
    })
  }
}
// Itens que ficam fisicamente em outro local (viram "lido não pertence" e vínculo suspeito).
const foraDoLugar = new Map(catalogo.filter(() => chance(0.02)).map(p => [p.codigo, um(Object.values(SETORES).flat().filter(l => l !== p.local))]))

const colunasAuditoria = ['Código', 'Produto', 'Classe de Produto Raiz', 'Classe de Produto', 'Fornecedor', 'Local', 'Usuário', 'Situação', 'Auditado em', 'Estoque atual', 'Lido não pertence', 'Dias sem venda', 'Custo Ruptura']

const linhaAuditoria = (p, dia, tipo, qualidade) => {
  const estoque = chance(0.08) ? 0 : int(1, 120)
  const lido = chance(qualidade)
  const hora = `${String(int(8, 19)).padStart(2, '0')}:${String(int(0, 59)).padStart(2, '0')}:00`
  const base = {
    'Código': p.codigo, Produto: p.produto, 'Classe de Produto Raiz': p.setor, 'Classe de Produto': p.classe, Fornecedor: p.fornecedor,
    Local: `${p.local} - ${p.local}`, 'Estoque atual': estoque, 'Lido não pertence': 'Não', 'Dias sem venda': int(0, 40), 'Custo Ruptura': p.custo
  }
  const usuario = um(USUARIOS)
  if (tipo === 'Etiqueta') {
    const situacao = !lido ? (estoque ? 'Não lido com estoque' : 'Não lido sem estoque') : estoque ? (chance(0.9) ? 'Atualizado' : 'Desatualizado') : 'Lido sem estoque'
    return { ...base, Usuário: lido ? usuario : '', Situação: situacao, 'Auditado em': lido ? `${br(dia)} ${hora}` : '' }
  }
  const situacao = `${lido ? 'Com Prese' : 'Sem Prese'} Encerrada - ${estoque ? 'Com Estoque' : 'Sem Estoque'}`
  return { ...base, Usuário: lido ? usuario : '', Situação: situacao, 'Auditado em': lido ? `${br(dia)} ${hora}` : '' }
}

const planilhaAuditoria = (dia, tipo, qualidade) => {
  // Item fisicamente em outro local não é achado no local vinculado.
  const linhas = catalogo.map(p => linhaAuditoria(p, dia, tipo, foraDoLugar.has(p.codigo) ? 0 : qualidade))
  for (const [cod, local] of foraDoLugar) {
    const p = catalogo.find(x => x.codigo === cod)
    if (chance(0.8)) linhas.push({ ...linhaAuditoria(p, dia, tipo, 1), Local: `${local} - ${local}`, 'Lido não pertence': 'Sim', Usuário: um(USUARIOS) })
  }
  return linhas
}

const criarAuditorias = async (store, hoje) => {
  const segunda = somar(hoje, -((hoje.getDay() + 6) % 7))
  const plano = [[0, 'Etiqueta'], [1, 'Presença'], [2, 'Ruptura'], [3, 'Etiqueta']]
  for (let semana = -7; semana <= 0; semana++) {
    for (const [desloc, tipo] of plano) {
      const dia = somar(segunda, semana * 7 + desloc)
      if (dia > hoje) continue
      const qualidade = Math.min(0.995, 0.9 + (semana + 7) * 0.012 + rnd() * 0.02)
      const arquivo = csv(`${tipo}-${iso(dia)}`, colunasAuditoria, planilhaAuditoria(dia, tipo, tipo === 'Ruptura' ? qualidade + 0.02 : qualidade))
      const data = iso(dia)
      const opts = { dataAuditoria: data, tipoAuditoria: tipo }
      const dados = tipo === 'Etiqueta' ? await store.processarExcelEtiqueta(arquivo)
        : tipo === 'Ruptura' ? await store.processarExcelRuptura(arquivo, opts)
          : await store.processarExcelPresenca(arquivo)
      const sku = catalogo.length
      const analise = tipo === 'Etiqueta' ? store.analisarDadosEtiqueta(dados, sku)
        : tipo === 'Ruptura' ? store.analisarDadosRuptura(dados, sku, { dataReferencia: data })
          : store.analisarDadosPresenca(dados, sku)
      const nova = await store.addAuditoria({ sku, tipo, data, dados, analise, parcial: analise.parcialPercentual, total: analise.totalItens })
      if (semana < 0) await store.updateAuditoria(nova.id, { status: 'fechada' })
    }
  }
}

const criarVencimentos = async (hoje) => {
  const linhas = catalogo.filter(p => !/BAZAR|LIMPEZA/.test(p.setor) && chance(0.35)).map(p => {
    const validade = somar(hoje, int(-6, 45))
    return {
      'Código': p.codigo, Produto: p.produto, Situação: 'Ativo', 'Data de validade': br(validade), 'Estoque atual': int(0, 60),
      'Classe de Produto Raiz': p.setor, Fornecedor: p.fornecedor, Locais: p.local, Usuário: um(USUARIOS), 'Última compra': br(somar(hoje, -int(2, 40)))
    }
  })
  await useVencimentosStore().processarExcelVencimentos(csv('validades', Object.keys(linhas[0]), linhas))
}

const criarNaoVinculados = async (hoje, auditorias) => {
  const novo = n => {
    const p = um(catalogo)
    return { 'Código': String(900000 + n), Nome: `${p.produto.split(' ')[0]} LANCAMENTO ${um(MARCAS)} ${int(1, 9) * 100}G`, Estoque: int(0, 300), 'Dias sem venda': chance(0.3) ? '' : int(0, 25), 'Classe de Produto': chance(0.85) ? p.classe : '99.1 - NOVA CLASSE', 'Classe de Produto Raiz': p.setor, Fornecedor: p.fornecedor }
  }
  const doCatalogo = p => ({ 'Código': p.codigo, Nome: p.produto, Estoque: int(1, 200), 'Dias sem venda': int(0, 20), 'Classe de Produto': p.classe, 'Classe de Produto Raiz': p.setor, Fornecedor: p.fornecedor })
  const achados = [...foraDoLugar.keys()].slice(0, 4).map(c => doCatalogo(catalogo.find(p => p.codigo === c)))
  const ontem = [...achados, ...Array.from({ length: 10 }, (_, i) => novo(i)), ...catalogo.slice(0, 3).map(doCatalogo)]
  const hojeLista = [...achados.slice(1), ...Array.from({ length: 14 }, (_, i) => novo(i + 4))]
  let itens = mesclarImportacao([], tratarPlanilha(ontem, auditorias), iso(somar(hoje, -3)))
  itens = mesclarImportacao(itens, tratarPlanilha(ontem.slice(0, 12), auditorias), iso(somar(hoje, -1)))
  itens = mesclarImportacao(itens, tratarPlanilha(hojeLista, auditorias), iso(hoje))
  await db.naoVinculados.bulkPut(JSON.parse(JSON.stringify(itens)))
}

export const carregarDemo = async (pinia) => {
  await Promise.all([db.auditorias.clear(), db.vencimentos.clear(), db.planosAcao.clear(), db.naoVinculados.clear()])
  const store = useAuditoriasStore(pinia)
  store.auditorias = []
  const hoje = new Date()
  await criarAuditorias(store, hoje)
  await criarVencimentos(hoje)
  await criarNaoVinculados(hoje, store.auditorias)
}
