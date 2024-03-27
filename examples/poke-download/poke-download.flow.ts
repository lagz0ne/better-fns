import { run, defineSteps, flow } from "better-fns"
import { logger } from "better-fns/logger"
import * as steps from "./poke-download.activities"
import path from "path"

const {
  checkAvailabiltity,
  retrievePokemonByName,
  storePokemonToDb,
  retrievePokemonFromDb,
  guaranteeTheOutputDir,
  getSprite
} = defineSteps(steps)

async function retrievePokemon(pokemonName: string) {
  const outputDir = path.join(process.cwd(), "database")
  await guaranteeTheOutputDir(outputDir)
  const isAvailable = await checkAvailabiltity(pokemonName, outputDir)

  const pokemon = isAvailable
    ? await retrievePokemonFromDb(pokemonName, outputDir)
    : await retrievePokemonByName(pokemonName)

  if (!isAvailable) {
    await storePokemonToDb(pokemon, outputDir)
  }

  await flow(function downloadSprites() {
    return Promise.all([
      getSprite(pokemon.sprites.front_default, outputDir, `${pokemon.name}-front-default`),
      getSprite(pokemon.sprites.back_default, outputDir, `${pokemon.name}-back-default`),
      getSprite(pokemon.sprites.front_shiny, outputDir, `${pokemon.name}-front-shiny`),
      getSprite(pokemon.sprites.back_shiny, outputDir, `${pokemon.name}-back-shiny`),
    ])
  })

  return pokemon
}

const main = async () => {
  const { state, value, error } = await run(
    retrievePokemon, {
    params: ["pikachu"],
    middlewares: [logger("pikachu")],
  })

  if (state === 'ok') {
    // do something with value
  } else {
    console.error(error)
  }
}

main()