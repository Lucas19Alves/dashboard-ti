import { lerArquivoBackup, montarArquivoBackup } from '../utils/backupFormato'

// Gera e lê backups fora da página, para a tela não travar com muitos dados.
self.onmessage = async ({ data }) => {
  try {
    const resultado = data.acao === 'montar'
      ? await montarArquivoBackup(data.conteudo, data.extras)
      : await lerArquivoBackup(data.file)
    self.postMessage({ id: data.id, resultado })
  } catch (error) {
    self.postMessage({ id: data.id, erro: error?.message || 'Falha ao processar o backup.' })
  }
}
