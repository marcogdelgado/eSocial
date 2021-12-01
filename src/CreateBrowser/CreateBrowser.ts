import puppeteer, { Browser, Page } from 'puppeteer-core'
import { config } from 'dotenv'
import { parentPort } from 'worker_threads'

config({ path: `${process.cwd()}/src/CreateBrowser/config/.env` })

export default class CreateBrowser {
  private browser: Browser
  private page: Page

  async init () {
    const CONFIG = this.setConfig()
    this.browser = await puppeteer.launch(CONFIG)
    this.page = await this.browser.newPage()

    this.page.setDefaultTimeout(80000)
    this.page.setDefaultNavigationTimeout(80000)

    await this.page.setViewport(CONFIG.defaultViewport)

    this.page.on('dialog', async (dialog) => {
      await dialog.accept()
    })

    this.closeWorker()

    // this.page = await this.setLocalDownloadFiles(this.page, CONFIG.pathDownload)
    return { browser: this.browser, page: this.page }
  }

  public async setLocalDownloadFiles (page: Page, localDownload: string) {
    // @ts-ignore
    await page._client.send('Page.setDownloadBehavior', {
      downloadPath: localDownload,
      behavior: 'allow'
    })

    return page
  }

  public async closeAll () {
    const pages = await this.browser.pages()
    await this.closeAllPages(pages)
    await this.browser.close().catch(e => console.log('browser ja foi fechado'))
  }

  public closeWorker () {
    try {
      parentPort.on('message', msg => {
        if (msg === 'close') { process.exit(0) }
      })
    } catch (error) {
    }
  }

  private async closeAllPages (pages : Array<Page>) {
    if (pages.length === 0) {
      return true
    }
    await pages.pop().close().catch(e => 'pagina ja foi fechada')
    return this.closeAllPages(pages)
  }

  private setConfig () {
    return {
      pathDownload: process.env.pathDownload,
      executablePath: process.env.executablePath,
      userDataDir: process.env.userDataDir,
      slowMo: parseInt(process.env.slowMo, 10),
      args: process.env.args.split(','),
      defaultViewport: JSON.parse(process.env.defaultViewport),
      ignoreDefaultArgs: process.env.ignoreDefaultArgs.split(','),
      ignoreHTTPSErrors: this.strToBoolean(process.env.ignoreHTTPSErrors),
      headless: this.strToBoolean(process.env.headless)
    }
  }

  private strToBoolean (str: string) {
    return str === 'true'
  }

  public async waitForSituacao () {
    await this.page.waitForTimeout(1000)
    // @ts-ignore
    const situacao = await this.page.$eval('#painel-identificacao-evento > span:nth-child(1) > span.valor > span', element => element.textContent.trim())
    if (!situacao) {
      return await this.waitForSituacao()
    }
    return situacao
  }
}
