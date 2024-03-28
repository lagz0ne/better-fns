import { defineMiddleware, ExecutionContext } from "./index.js"
import { lowerCase } from "lodash"
import { pino, Logger, LoggerOptions } from "pino"

const loggerSymbol = Symbol('logger')

const getLogger = (context: ExecutionContext, opts: LoggerOptions) => {
  const parentLogger = context.parent?.getArbitraryData<Logger>(loggerSymbol)

  if (!parentLogger) {
    const logger = pino({
      ...opts,
      transport: {
        target: 'pino-pretty',
        options: {
          include: 'level,time,duration,module,name,caller,params',
          colorize: true,
          singleLine: true
        }
      }
    })

    context.setArbitraryData(loggerSymbol, logger)
    return logger
  } else {
    const logger = parentLogger.child({
      ...opts,
      module: opts.name
    })
    context.setArbitraryData(loggerSymbol, logger)
    return logger
  }
}

export const logger = (name: string, pretty: boolean = true) => defineMiddleware({
  flow: async (context, meta, next) => {
    const pinoPrettyConfig = pretty ? { target: 'pino-pretty' } : {}
    const logger = getLogger(context, { name: `${name}.${lowerCase(meta.id || "flow")}`, ...pinoPrettyConfig })

    const st = Date.now()
    logger.info({ params: meta.params }, "started")
    await next()
    logger.info({ duration: Date.now() - st }, "completed")
  },

  step: async (context, meta, next) => {
    const logger = getLogger(context, { name: `${name}.${lowerCase(meta.id)}` })

    const st = Date.now()
    logger.info({ params: meta.params }, "started",)
    await next()
    logger.info({ duration: Date.now() - st }, "completed")
  },

})