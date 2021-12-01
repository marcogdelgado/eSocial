import { writeFileSync, readFileSync, existsSync } from 'fs'
import { extname } from 'path'

export function readCsv (inputPath : string, processingFile: string, isHeader = true) {
  if (extname(inputPath) !== '.csv') {
    return { status: false, error: 'O arquivo de entrada não e compativel com o formato pre cadastrado' }
  }

  if (existsSync(processingFile)) {
    return JSON.parse(readFileSync(processingFile, { encoding: 'utf-8' }))
  }
  const arrayCsv = []
  const conteudo = readFileSync(inputPath, { encoding: 'utf-8' })
  let header : Array<string>
  if (isHeader) {
    header = conteudo.split('\n')[0].split(';')
  }
  conteudo.split('\n').splice(1).forEach((item) => {
    const obj = {}
    item.split(';').forEach((value, index) => {
      obj[header ? header[index].trim() : String.fromCharCode(index + 97)] = value.trim()
    })
    arrayCsv.push(obj)
  })
  writeFileSync(processingFile.replace(extname(processingFile), '.json'), JSON.stringify(arrayCsv), { encoding: 'utf-8' })
  return arrayCsv
};
