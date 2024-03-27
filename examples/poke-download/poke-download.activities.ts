import Pokedex from "pokedex-promise-v2"
import { defer } from "better-fns"
import fs from "fs"
import path from "path"
import fetch from "node-fetch"

const P = new Pokedex()

export const checkAvailabiltity = async (pokemonName: string, outputDir: string) => {
  return fs.existsSync(path.join(outputDir, `${pokemonName}.meta.json`))
}

export const retrievePokemonByName = async (pokemonName: string) => {
  return await P.getPokemonByName(pokemonName)
}

export const storePokemonToDb = async (pokemon: Pokedex.Pokemon, outputDir: string) => {
  fs.writeFileSync(path.join(outputDir, `${pokemon.name}.meta.json`), JSON.stringify(pokemon))
}

export const retrievePokemonFromDb = async (pokemonName: string, outputDir: string) => {
  return JSON.parse(fs.readFileSync(path.join(outputDir, `${pokemonName}.meta.json`), "utf-8")) as Pokedex.Pokemon
}

export const guaranteeTheOutputDir = async (outputDir: string) => {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir)
  }
}

export const getSprite = async (spriteUrl: string | undefined | null, outputDir: string, name: string) => {
  if (!spriteUrl) return

  const { body, ok, statusText } = await fetch(spriteUrl)
  if (!ok) throw new Error(`Failed to download sprite ${name}, ${statusText}`)
  if (!body) return

  const filePath = path.join(outputDir, `${name}.sprite.png`)
  // check if sprite is already downloaded
  if (fs.existsSync(filePath)) {
    return
  }

  const filestream = fs.createWriteStream(filePath, { flags: 'wx', encoding: 'binary' })

  defer(() => {
    filestream.close()
  })

  await new Promise((resolve, reject) => {
    filestream.on('finish', resolve)
    filestream.on('error', reject)
    body.on('error', reject)
    body.pipe(filestream)
  })
}