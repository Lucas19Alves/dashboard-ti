import { reactive, watch } from 'vue'
import { definirMetaPendente } from '../utils/metricasAuditoria'

// Configurações gerais do sistema, salvas apenas neste navegador.
const CHAVE = 'dashboard_ti_config'
export const CONFIG_PADRAO = {
  auditoria: { inicio: '08:00', fim: '20:00', meta: 3 },
  relatorio: { orientacao: 'paisagem', empresa: '', unidade: '', emissor: '', assinaturas: 'Responsável, Liderança, Data' },
  backup: { lembrete: true, dias: 1 }
}
const copiar = v => JSON.parse(JSON.stringify(v))

const ler = () => {
  const base = copiar(CONFIG_PADRAO)
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE) || '{}')
    for (const grupo of Object.keys(base)) Object.assign(base[grupo], salvo?.[grupo] || {})
  } catch {}
  return base
}

export const configuracoes = reactive(ler())

watch(configuracoes, () => {
  try { localStorage.setItem(CHAVE, JSON.stringify(configuracoes)) } catch {}
}, { deep: true })
watch(() => configuracoes.auditoria.meta, v => {
  const meta = Number(v)
  definirMetaPendente(Number.isFinite(meta) && meta > 0 ? meta : CONFIG_PADRAO.auditoria.meta)
}, { immediate: true })

export const rotulosAssinatura = () => {
  const lista = String(configuracoes.relatorio.assinaturas || '').split(',').map(s => s.trim()).filter(Boolean)
  return lista.length ? lista.slice(0, 4) : ['Responsável', 'Liderança', 'Data']
}

export const restaurarGrupo = (grupo) => Object.assign(configuracoes[grupo], copiar(CONFIG_PADRAO[grupo]))

export const useConfiguracoes = () => ({ configuracoes, restaurarGrupo, rotulosAssinatura })
