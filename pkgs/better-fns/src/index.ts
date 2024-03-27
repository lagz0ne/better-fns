import { AsyncLocalStorage } from "node:async_hooks"

type Fn<I extends Array<any>, O> = (...args: I) => O | Promise<O>

type Step<I extends Array<any> = any[], O = any> = {
  type: 'step'
  meta: {
    id?: string
  }
} & Fn<I, O>

type Flow<I extends Array<any> = Array<any>, O = any> = {
  meta: {
    id?: string
  }
  type: 'flow'
} & Fn<I, O>

type DeferFn = Fn<[void], void>
type OnErrorFn = Fn<[any], void>
type OnSuccessFn = Fn<[void], void>

type JSONPrimitive = string | number | boolean | null | undefined;

type JSONValue = JSONPrimitive | JSONValue[] | {
  [key: string]: JSONValue;
};

export class ExecutionContext {
  constructor(
    public middlewares: Middleware[] = [],
    public parent?: ExecutionContext,
    public children: ExecutionContext[] = [],
    public stepMiddlewares: StepMiddlewareFn[] = middlewares.map(m => m.step).filter(Boolean) as StepMiddlewareFn[],
    public flowMiddlewares: FlowMiddlewareFn[] = middlewares.map(m => m.flow).filter(Boolean) as FlowMiddlewareFn[],
    public defers: DeferFn[] = [],
    public onErrors: OnErrorFn[] = [],
    public onDone: OnSuccessFn[] = [],
    public abitraryData: Map<unknown, unknown> = new Map(),
    public data: Map<string, JSONValue> = new Map(),
  ) { }

  getExecutionData(): ExecutionData {
    return {
      data: this.data,
      children: this.children.map((child) => child.getExecutionData())
    }
  }

  setAbitraryData(key: unknown, value: unknown) {
    this.abitraryData.set(key, value)
  }

  getAbitraryData<T>(key: unknown): T | undefined {
    return this.abitraryData.get(key) as T
  }
}

type ExecutionState<T> =
  | { state: 'ok', value: T, error: undefined }
  | { state: 'error', error: any, value: undefined }


type ExecutionData = {
  data: Map<unknown, unknown>
  children: Array<ExecutionData>
}

type ExecutionResult<T> = ExecutionData & ExecutionState<T>

const executionContextStorage = new AsyncLocalStorage<ExecutionContext>()

export function defer(fn: DeferFn) {
  const store = executionContextStorage.getStore()
  if (store) {
    store.defers.push(fn)
  } else {
    throw new Error('defer is being called out of better function context')
  }
}

export function onError(fn: OnErrorFn) {
  const store = executionContextStorage.getStore()
  if (store) {
    store.onErrors.push(fn)
  } else {
    throw new Error('onError is being called out of better function context')
  }
}

export function onSuccess(fn: OnSuccessFn) {
  const store = executionContextStorage.getStore()
  if (store) {
    store.onDone.push(fn)
  } else {
    throw new Error('onDone is being called out of better function context')
  }
}

export function isStep(step: any) {
  return typeof step === 'function' && step['type'] === 'step'
}

export function isFlow(flow: any) {
  return typeof flow === 'function' && flow['type'] === 'flow'
}

export function defineStep<I extends Array<any>, O>(
  step: Fn<I, O>,
  meta: Step<I, O>['meta'] = { id: step.name }
): Step<I, O> {
  const fn = async (...params: I) => {
    const store = executionContextStorage.getStore()

    let result: O | undefined

    if (store) {
      let next = async () => {
        result = await step(...params)
      }

      for (const middleware of store.stepMiddlewares) {
        const prevNext = next
        next = async () => {
          await middleware(store, { ...meta, params }, prevNext)
        }
      }

      try {
        await next()
        return result
      } catch (e) {
        throw e
      }
    } else {
      throw new Error('step is being called out of better function context')
    }
  }

  return Object.assign(fn, { meta, type: 'step' }) as any
}

export function defineSteps<O extends Record<string, Fn<any, any>>>(steps: O): O {
  return Object.entries(steps).reduce((acc, [key, step]) => {
    acc[key] = defineStep(step, { id: key })
    return acc
  }, {} as any) as O

}

export function defineFlow<I extends Array<any>, O>(
  flow: Fn<I, O>,
  opts?: Flow<I, O>['meta']
): Flow<I, O> {
  const fn = async (...params: I) => {
    const parentContext = executionContextStorage.getStore()

    const store = parentContext
      ? new ExecutionContext(
        parentContext.middlewares,
        parentContext,
      )
      : new ExecutionContext()

    if (parentContext) {
      parentContext.children.push(store)
    }

    if (!store) throw new Error('step is being called out of better function context')

    let result: O | undefined
    // chain execution of middleware
    let next = async () => {
      result = await flow(...params)
    }

    for (const middleware of store.flowMiddlewares) {
      const prevNext = next
      next = async () => {
        await middleware(store, { ...opts, params }, prevNext)
      }
    }

    return await executionContextStorage.run(store, next)
      .then(() => {
        store.onDone.forEach((onDone) => onDone())
        return result
      })
      .catch((e) => {
        store.onErrors.forEach((onError) => onError(e))
        throw e
      })
      .finally(() => {
        store.defers.forEach((defer) => defer())
      }) as any
  }

  return Object.assign(fn, { meta: opts, type: 'flow' }) as any
}

export async function flow<O>(
  input: Fn<void[], O>,
  opts?: Flow<void[], O>['meta']
): Promise<Awaited<O>> {
  return await defineFlow(input, opts)()
}

export async function step<O>(
  input: Fn<void[], O>,
  opts?: Step<void[], O>['meta']
): Promise<Awaited<O>> {
  return await defineStep(input, opts)()
}

export async function run<I extends Array<any>, O>(
  input: Flow<I, O> | Fn<I, O>,
  opts: { params: I } & RunOpts
): Promise<ExecutionResult<O>> {
  const flow = isFlow(input) ? input : defineFlow(input)
  const store = new ExecutionContext(opts.middlewares)

  return await executionContextStorage.run(store, async () => await flow(...opts.params))
    .then((result) => {
      return {
        state: 'ok',
        value: result,
        error: undefined,
        ...store.getExecutionData()
      } satisfies ExecutionResult<O>
    })
    .catch((e) => {
      return {
        state: 'error',
        error: e,
        value: undefined,
        ...store.getExecutionData()
      } satisfies ExecutionResult<O>
    })
}

export type StepMiddlewareFn = (
  c: ExecutionContext,
  meta: Step['meta'] & { params: Readonly<any[]> },
  next: () => Promise<void>
) => void | Promise<void>

export type FlowMiddlewareFn = (
  c: ExecutionContext,
  meta: Flow['meta'] & { params: Readonly<any[]> },
  next: () => Promise<void>
) => void | Promise<void>

export type Middleware = {
  flow?: FlowMiddlewareFn
  step?: StepMiddlewareFn
}

export function defineMiddleware(m: Middleware) { return m }

export type RunOpts = {
  middlewares?: Array<Middleware>
}

export const $ = {
  start: run,
  flow, step,
  defer, onError, onSuccess
}