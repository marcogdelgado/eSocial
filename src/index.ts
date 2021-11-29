import CreateBrowser from './CreateBrowser/CreateBrowser'
import { appendFileSync, readdirSync, unlinkSync, copyFileSync, writeFileSync } from 'fs'
import { join, extname } from 'path'
import { workerData } from 'worker_threads'
import { readCsv } from './components/helprs/fileSystem'
import { Log } from './components/helprs/log'
import { v4 as uuid } from 'uuid'

const InputPath = join(__dirname, 'entrada')
const processingPath = join(__dirname, 'processando')
const OutputPath = join(__dirname, 'saida')
const pathStatus = workerData ? join(__dirname, workerData) : join(__dirname, 'log', uuid())
const log = new Log(pathStatus)
let clienteAtual: string
let tentativas: number = 5

appendFileSync('./src/saida/error.csv', 'RAZÃO SOCIAL' + ';' + 'CNPJ' + ';' + 'ERRO' + '\n')
appendFileSync('./src/saida/saida.csv', 'RAZÃO SOCIAL' + ';' + 'CNPJ' + ';' + 'MÊS' + ';' + 'SITUAÇÃO DA FOLHA' + '\n')

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
        const valida = await page.$eval('#procuradorCnpj-error', element => element.textContent).catch(e => 'sem errro')
        if (valida === 'CNPJ inválido.') {
          appendFileSync('./src/saida/error.csv', CLIENTES[index].Nome + ';' + CLIENTES[index].CNPJ.padStart(14, '0') + ';' + 'cnpj invalido' + '\n')
          CLIENTES.shift()
          // await browser.close()
          writeFileSync('./src/processando/cliente.json', JSON.stringify(CLIENTES))
          throw new Error('CNPJ inválido.')
        }

        await page.waitForTimeout(2000)
        await page.waitForSelector('#btnProcuracao')
        await page.click('#btnProcuracao')

        const faltaDados = await page.$eval('#InicioAdesao > h2', element => element.textContent).catch(e => '')
        if (faltaDados === 'Dados do Empregador') {
          appendFileSync('./src/saida/error.csv', CLIENTES[index].Nome + ';' + CLIENTES[index].CNPJ.padStart(14, '0') + ';' + faltaDados + '\n')
          CLIENTES.shift()
          // await browser.close()
          writeFileSync('./src/processando/cliente.json', JSON.stringify(CLIENTES))
          throw new Error('Dados do Empregador')
        }

        await page.waitForSelector('#menuFolhaPagamento')
        await page.click('#menuFolhaPagamento')
        await page.waitForSelector('#menuGestaoFolha')
        await page.click('#menuGestaoFolha')
        await page.waitForTimeout(2000)
        const verificaMes = await page.$eval('#conteudo-pagina > div.remuneracoes-trabalhadores > div.marcadores-meses.containerMeses', element => element.textContent)
        const diMes = verificaMes.length / 3
        let auxMes = verificaMes
        let auxMes2 = auxMes
        for (let f = 1; f <= diMes; f++) {
          auxMes = auxMes2.substr(0, 3)
          await page.click(`#conteudo-pagina > div.remuneracoes-trabalhadores > div.marcadores-meses.containerMeses > div:nth-child(${f})`)
          await page.waitForTimeout(1000)
          const fechado = await page.$eval('#painel-identificacao-evento > span:nth-child(1) > span.valor > span', element => element.textContent)
          if (fechado === 'Fechada') {
            appendFileSync('./src/saida/saida.csv', CLIENTES[index].Nome + ';' + CLIENTES[index].CNPJ.padStart(14, '0') + ';' + auxMes + ';' + fechado + '\n')
          } else {
            appendFileSync('./src/saida/saida.csv', CLIENTES[index].Nome + ';' + CLIENTES[index].CNPJ.padStart(14, '0') + ';' + auxMes + ';' + fechado + '\n')
          }
          auxMes2 = auxMes2.replace(auxMes2.substr(0, 3), '')
          if (auxMes2 === '') {
            break
          }
        }
        CLIENTES.shift()
        writeFileSync('./src/processando/cliente.json', JSON.stringify(CLIENTES))
        wereNotProcessed = CLIENTES
        tentativas = 5
        index--
      }

      copyFileSync(join(InputPath, filesInput[i]), join(OutputPath, filesInput[i]))
      unlinkSync(join(InputPath, filesInput[i]))
      unlinkSync(join(processingPath, fileCurrent.replace(extname(fileCurrent), '.json')))
    }
    return { status: true }
  } catch (error) {
    console.log(error)
    await newBrowser.closeAll()
    return { status: false, remainingClients: wereNotProcessed, file: fileCurrent.replace(extname(fileCurrent), '.json') }
  }
}

(async () => {
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
