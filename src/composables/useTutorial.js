import { reactive } from 'vue'

// Estado único do tutorial: aberto pelo menu, pela busca rápida ou por qualquer tela.
export const tutorial = reactive({ aberto: false })
export const abrirTutorial = () => { tutorial.aberto = true }
