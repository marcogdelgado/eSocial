import { join } from 'path'
import { readdirSync, unlinkSync } from 'fs'

export default (...file: Array<string>) => {
  for (let index = 0; index < file.length; index++) {
    const arrayFiles = readdirSync(file[index], { encoding: 'utf-8' })
    for (let i = 0; i < arrayFiles.length; i++) {
      const nomeArquivo = join(file[index], arrayFiles[i])
      console.log(nomeArquivo)
      unlinkSync(nomeArquivo)
    }
  }
}
