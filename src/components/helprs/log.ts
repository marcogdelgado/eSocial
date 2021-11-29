import { appendFileSync, mkdirSync, unlinkSync, rmdirSync } from 'fs'
import { join } from 'path'
export class Log {
  private path : string
  private file : string
  constructor (path: string) {
    this.path = path
    mkdirSync(this.path)
    this.file = join(this.path, 'log.txt')
  }

  public write (content: string) {
    appendFileSync(this.file, content + '\n', { encoding: 'utf-8' })
  }

  public delete () {
    try {
      unlinkSync(this.file)
    } catch (error) {
      console.log('nao existe arquivo de log')
    } finally {
      rmdirSync(this.path)
    }
  }
}
