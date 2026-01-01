import { createHash } from 'crypto'
import { createReadStream } from 'fs'
import fs from 'fs/promises'

// Hyottoko moving boxes:
//
//   .----.                                     ______
//  /| o..o)                                   |      |
//  \|__==O ______                         ____|______|_______
//   |==\==|     |                        |       |          |
//   |  /  |_____|                        |_______|__________|
//
// Comment added during para stream as result of viewer reward for duke
// 2025-08-03

const exists = async (file: string): Promise<boolean> => await fs.access(file).then(() => true).catch(() => false)
const readFile = async (file: string): Promise<string> => await fs.readFile(file, 'utf-8')
const readFileRaw = async (file: string): Promise<Buffer> => await fs.readFile(file)
const writeFile = async (file: string, text: string) => await fs.writeFile(file, text)
const appendFile = async (file: string, text: string) => await fs.appendFile(file, text)
const mkdir = async (dir: string) => await fs.mkdir(dir, { recursive: true })
const readdir = async (dir: string) => await fs.readdir(dir)
const unlink = async (file: string) => await fs.unlink(file)
const checksum = (file: string): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(file)
    hash.on('error', (error) => reject(error))
    stream.on('error', (error) => reject(error))

    stream.on('data', chunk => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

export default {
  checksum,
  exists,
  readFile,
  readFileRaw,
  writeFile,
  appendFile,
  mkdir,
  readdir,
  unlink,
}
