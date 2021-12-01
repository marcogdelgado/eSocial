import CreateBrowser from './CreateBrowser/CreateBrowser'
import { appendFileSync, readdirSync, writeFileSync } from 'fs'
import { join, extname } from 'path'
import { workerData } from 'worker_threads'
import { readCsv } from './components/helprs/fileSystem'
import { Log } from './components/helprs/log'
import { v4 as uuid } from 'uuid'
import clearPath from './components/clearPath'
import { notIncludesItemArray } from './components/helprs/array'

const InputPath = join(__dirname, 'entrada')
const processingPath = join(__dirname, 'processando')
const OutputPath = join(__dirname, 'saida')
const pathStatus = workerData ? join(__dirname, workerData) : join(__dirname, 'log', uuid())
const log = new Log(pathStatus)
let clienteAtual: string
let tentativas: number = 5

appendFileSync(join(OutputPath, 'error.csv'), 'RAZÃO SOCIAL' + ';' + 'CNPJ' + ';' + 'ERRO' + '\n')
appendFileSync(join(OutputPath, 'saida.csv'), 'RAZÃO SOCIAL' + ';' + 'CNPJ' + ';' + 'MÊS' + ';' + 'SITUAÇÃO DA FOLHA' + '\n')

async function main () {
  const newBrowser = new CreateBrowser()
  let wereNotProcessed: any
  let fileCurrent: string

  try {
    const filesInput = readdirSync(InputPath)
    for (let i = 0; i < filesInput.length; i++) {
      fileCurrent = filesInput[i]
      const CLIENTES = readCsv(join(InputPath, filesInput[i]), join(processingPath, fileCurrent.replace(extname(fileCurrent), '.json')))
      if (!Array.isArray(CLIENTES)) {
        log.write(CLIENTES.error)
        continue
      }
      wereNotProcessed = CLIENTES

      const { page } = await newBrowser.init()
      await page.goto('https://login.esocial.gov.br/login.aspx', { waitUntil: 'domcontentloaded' })
      await page.waitForSelector('#login-acoes > div.d-block.mt-3.d-sm-inline.mt-sm-0.ml-sm-3 > p > button')
      await page.click('#login-acoes > div.d-block.mt-3.d-sm-inline.mt-sm-0.ml-sm-3 > p > button')
      await page.waitForTimeout(2000)
      await page.click('#modal-tips > div > div > button.button-cancel').catch(e => '')
      await page.waitForTimeout(2000)
      await page.waitForSelector('#cert-digital > a')
      await page.click('#cert-digital > a')
      await page.waitForTimeout(2000)

      for (let index = 0; index < CLIENTES.length; index++) {
        clienteAtual = CLIENTES[index].Nome
        await page.waitForSelector('#header > div.informacoes > a')
        await page.click('#header > div.informacoes > a')

        await page.select('#perfilAcesso', 'PROCURADOR_PJ')
        await page.type('#procuradorCnpj', CLIENTES[index].CNPJ.padStart(14, '0'))
        await page.waitForTimeout(2000)
        await page.click('#btn-verificar-procuracao-cnpj')
        await page.waitForTimeout(2000)
        const procurador = await page.$eval('#mensagemGeral > div > span', element => element.textContent).catch(e => '')
        // O procurador não possui perfil com autorização de acesso à Web
        if (procurador !== '') {
          appendFileSync(join(OutputPath, 'error.csv'), CLIENTES[index].Nome + ';' + CLIENTES[index].CNPJ.padStart(14, '0') + ';' + procurador.trim() + '\n')
          CLIENTES.shift()
          // writeFileSync('./src/processando/cliente.json', JSON.stringify(CLIENTES))
          throw new Error('CNPJ impossibilitado de prosseguir')
        }
        const valida = await page.$eval('#procuradorCnpj-error', element => element.textContent).catch(e => '')
        if (valida === 'CNPJ inválido.') {
          appendFileSync(join(OutputPath, 'error.csv'), CLIENTES[index].Nome + ';' + CLIENTES[index].CNPJ.padStart(14, '0') + ';' + 'cnpj invalido' + '\n')
          CLIENTES.shift()
          // writeFileSync('./src/processando/cliente.json', JSON.stringify(CLIENTES))
          throw new Error('CNPJ inválido.')
        }

        await page.waitForTimeout(2000)
        await page.waitForSelector('#btnProcuracao')
        await page.click('#btnProcuracao')

        const faltaDados = await page.$eval('#InicioAdesao > h2', element => element.textContent).catch(e => '')
        if (faltaDados === 'Dados do Empregador') {
          appendFileSync(join(OutputPath, 'error.csv'), CLIENTES[index].Nome + ';' + CLIENTES[index].CNPJ.padStart(14, '0') + ';' + 'Faltam Dados do Empregador' + '\n')
          CLIENTES.shift()
          // writeFileSync('./src/processando/cliente.json', JSON.stringify(CLIENTES))
          throw new Error('Dados do Empregador')
        }

        await page.waitForSelector('#menuFolhaPagamento')
        await page.click('#menuFolhaPagamento')
        await page.waitForSelector('#menuGestaoFolha')
        await page.click('#menuGestaoFolha')
        await page.waitForTimeout(2000)
        // const verificaAno = await page.$$eval('#conteudo-pagina > div.remuneracoes-trabalhadores > div.marcadores-anos div.ano, #conteudo-pagina > div.remuneracoes-trabalhadores > div.marcadores-anos div.ano', element => element.length)
        // const verificaMes = await page.$$eval('#conteudo-pagina > div.remuneracoes-trabalhadores > div.marcadores-meses.containerMeses div.mes, #conteudo-pagina > div.remuneracoes-trabalhadores > div.marcadores-meses.containerMeses div.mes', element => element.length)
        const anoSelecionado = workerData ? workerData.anos : ['2021']
        const mesesSelecionado = workerData ? workerData.meses : ['mai', 'jun', 'jul', 'dez']
        const ano = await page.$$eval('#conteudo-pagina > div.remuneracoes-trabalhadores > div.marcadores-anos div.ano, #conteudo-pagina > div.remuneracoes-trabalhadores > div.marcadores-anos div.ano', element => element.map(item => item.textContent.trim()))
        notIncludesItemArray(anoSelecionado, ano).forEach(item => {
          appendFileSync(join(OutputPath, 'saida.csv'), CLIENTES[index].Nome + ';' + CLIENTES[index].CNPJ.padStart(14, '0') + ';' + item + 'indisponivel' + '\n')
        })

        for (let a = 1; a <= ano.length; a++) {
          await page.waitForTimeout(1000)
          await page.waitForSelector(`#conteudo-pagina > div.remuneracoes-trabalhadores > div.marcadores-anos > div:nth-child(${a}) > a`)

          if (anoSelecionado.includes(ano[a - 1])) {
            await page.click(`#conteudo-pagina > div.remuneracoes-trabalhadores > div.marcadores-anos > div:nth-child(${a}) > a`)
            console.log(ano[a - 1])
          } else {
            continue
          }
          await page.waitForSelector('#conteudo-pagina > div.remuneracoes-trabalhadores > div.marcadores-meses.containerMeses div.mes, #conteudo-pagina > div.remuneracoes-trabalhadores > div.marcadores-meses.containerMeses div.mes')
          const mes = await page.$$eval('#conteudo-pagina > div.remuneracoes-trabalhadores > div.marcadores-meses.containerMeses div.mes, #conteudo-pagina > div.remuneracoes-trabalhadores > div.marcadores-meses.containerMeses div.mes', element => element.map(item => item.textContent.trim().toLowerCase()))

          for (let m = 1; m <= mes.length; m++) {
            await page.waitForTimeout(1000)
            await page.waitForSelector(`#conteudo-pagina > div.remuneracoes-trabalhadores > div.marcadores-meses.containerMeses > div:nth-child(${m})`)

            if (mesesSelecionado.includes(mes[m - 1])) {
              console.log(mes[m - 1])
              await page.click(`#conteudo-pagina > div.remuneracoes-trabalhadores > div.marcadores-meses.containerMeses > div:nth-child(${m})`)
            } else {
              continue
            }
            // await page.click(`#conteudo-pagina > div.remuneracoes-trabalhadores > div.marcadores-meses.containerMeses > div:nth-child(${m})`)
            const situacao = await newBrowser.waitForSituacao()
            appendFileSync(join(OutputPath, 'saida.csv'), CLIENTES[index].Nome + ';' + CLIENTES[index].CNPJ.padStart(14, '0') + ';' + mes[m - 1] + '/' + ano[a - 1] + ';' + situacao + '\n')
          }
          notIncludesItemArray(mesesSelecionado, mes).forEach(item => {
            appendFileSync(join(OutputPath, 'saida.csv'), CLIENTES[index].Nome + ';' + CLIENTES[index].CNPJ.padStart(14, '0') + ';' + item + '/' + ano[a - 1] + ';' + 'indisponivel' + '\n')
          })
        }
        CLIENTES.shift()
        // writeFileSync('./src/processando/cliente.json', JSON.stringify(CLIENTES))
        wereNotProcessed = CLIENTES
        tentativas = 5
        index--
      }
    }
    return { status: true }
  } catch (error) {
    console.log(error.message)
    await newBrowser.closeAll()
    return { status: false, remainingClients: wereNotProcessed, file: fileCurrent.replace(extname(fileCurrent), '.json') }
  }
}

(async () => {
  clearPath(processingPath, OutputPath)
  let canFinish : any
  do {
    canFinish = await main()
    if (!canFinish.status) {
      if (tentativas === 0) {
        log.write('não foi possivel buscar o cliente ' + clienteAtual)
        tentativas = 5
      } else {
        tentativas -= 1
      }
      writeFileSync(join(processingPath, canFinish.file), JSON.stringify(canFinish.remainingClients))
    }
  } while (canFinish.status === false)
})()
