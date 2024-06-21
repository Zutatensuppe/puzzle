import fs from 'fs/promises'

const exists = async (file: string): Promise<boolean> => await fs.access(file).then(() => true).catch(() => false)
const readFile = async (file: string): Promise<string> => await fs.readFile(file, 'utf-8')
const readFileRaw = async (file: string): Promise<Buffer> => await fs.readFile(file)
const writeFile = async (file: string, text: string) => await fs.writeFile(file, text)
const appendFile = async (file: string, text: string) => await fs.appendFile(file, text)
const mkdir = async (dir: string) => await fs.mkdir(dir, { recursive: true })
const readdir = async (dir: string) => await fs.readdir(dir)
const unlink = async (file: string) => await fs.unlink(file)

export default {
  exists,
  readFile,
  readFileRaw,
  writeFile,
  appendFile,
  mkdir,
  readdir,
  unlink,
}
