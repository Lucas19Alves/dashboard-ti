const dataISOValida = (ano, mes, dia) => {
  if (ano < 2020 || ano > 2040) return null
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

export const extrairHoraPlanilha = (valor) => {
  if (valor === null || valor === undefined || valor === '') return null

  if (typeof valor === 'string') {
    const horaTexto = valor.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/)
    if (horaTexto) return Math.max(0, Math.min(23, parseInt(horaTexto[1], 10)))
    const data = new Date(valor)
    return isNaN(data.getTime()) ? null : data.getUTCHours()
  }

  if (typeof valor === 'number') {
    if (valor > 1e12) {
      const data = new Date(valor)
      return isNaN(data.getTime()) ? null : data.getUTCHours()
    }
    const data = new Date(Date.UTC(1899, 11, 30) + valor * 864e5)
    return isNaN(data.getTime()) ? null : data.getUTCHours()
  }

  if (valor instanceof Date && !isNaN(valor.getTime())) return valor.getUTCHours()
  return null
}

export const extrairDataISOPlanilha = (valor) => {
  if (typeof valor === 'number' && valor > 100 && valor < 200000) {
    const data = new Date(Date.UTC(1899, 11, 30) + valor * 864e5)
    if (isNaN(data.getTime())) return null
    return dataISOValida(data.getUTCFullYear(), data.getUTCMonth() + 1, data.getUTCDate())
  }

  if (typeof valor === 'string') {
    const iso = valor.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (iso) return dataISOValida(Number(iso[1]), Number(iso[2]), Number(iso[3]))

    const br = valor.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
    if (br) return dataISOValida(Number(br[3]), Number(br[2]), Number(br[1]))

    const data = new Date(valor)
    if (isNaN(data.getTime())) return null
    return dataISOValida(data.getUTCFullYear(), data.getUTCMonth() + 1, data.getUTCDate())
  }

  if (valor instanceof Date && !isNaN(valor.getTime())) {
    return dataISOValida(valor.getUTCFullYear(), valor.getUTCMonth() + 1, valor.getUTCDate())
  }

  return null
}
