import opentelemetry, { Span, SpanStatusCode, Tracer, Attributes } from '@opentelemetry/api';
import {
  BasicTracerProvider,
  BatchSpanProcessor,
  ConsoleSpanExporter,
  SimpleSpanProcessor
} from '@opentelemetry/sdk-trace-base'

import { defineMiddleware } from "."
import { lowerCase } from "lodash"

const flowSymbol = Symbol('opentelemetry.flow')

class TracerContainer {
  constructor(
    public name: string,
    public opts?: TracerOpts
  ) {
    this.init()
  }

  provider = new BasicTracerProvider();
  tracer: Tracer

  hasInitProvider = false
  hasInitTracer = false
  hasInit = false

  private initProvider() {
    return new BasicTracerProvider()
  }

  private initTracer() {
    return opentelemetry.trace.getTracer(this.name, this.opts?.version)
  }

  private initSpanProcessor() {
    if (this.opts?.batch) {
      this.provider.addSpanProcessor(new BatchSpanProcessor(new ConsoleSpanExporter()));
    } else {
      this.provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));
    }

    this.provider.register();
  }

  init() {
    if (!this.hasInit) {
      this.provider = this.initProvider()
      this.initSpanProcessor()
      this.tracer = this.initTracer()

      this.hasInit = true
    }
  }

  getTracer() {
    return this.tracer
  }
}

// This is what we'll access in all instrumentation code

type TracerOpts = {
  version?: string
  batch?: boolean
}

export const tracer = (name: string, tracerOpts?: TracerOpts) => {
  const tracerContainer = new TracerContainer(name, tracerOpts)

  return defineMiddleware({
    flow: async (context, meta, next) => {
      const parentSpan = context.parent?.getArbitraryData<Span | undefined>(flowSymbol)

      let span: Span
      if (parentSpan) {
        const ctx = opentelemetry.trace.setSpan(
          opentelemetry.context.active(),
          parentSpan,
        );

        span = tracerContainer.getTracer().startSpan(lowerCase(name), {
          attributes: {
          }
        }, ctx)
      } else {
        span = tracerContainer.getTracer().startSpan(lowerCase(name))
      }

      context.setArbitraryData(flowSymbol, span)

      await next()
        .then(() => {
          span.setStatus({ code: SpanStatusCode.OK })
        })
        .catch(e => {
          span.setStatus({ code: SpanStatusCode.ERROR, message: e.message })
          throw e
        })
        .finally(() => {
          span.end()
        })
    },

    step: async (context, meta, next) => {
      const flowSpan = context.getArbitraryData<Span>(flowSymbol)

      const ctx = opentelemetry.trace.setSpan(
        opentelemetry.context.active(),
        flowSpan,
      );

      const stepSpan = tracerContainer.getTracer().startSpan(
        lowerCase(meta.id), {
        attributes: {
        }
      }, ctx)
      await next()
        .then(() => {
          stepSpan.setStatus({ code: SpanStatusCode.OK })
        })
        .catch(e => {
          stepSpan.setStatus({ code: SpanStatusCode.ERROR, message: e.message })
          throw e
        })
        .finally(() => {
          stepSpan.end()
        })
    },

  })
}