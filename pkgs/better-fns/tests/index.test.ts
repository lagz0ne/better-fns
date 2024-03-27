import { afterEach, vi, describe, it, expect } from "vitest"
import { defer, onError, onSuccess, defineFlow, defineStep, isStep, isFlow, run, $ } from "../src"

describe('basic function', () => {
  let executed: string[] = []

  const svc = {
    get: async () => { executed.push('get') },
    start: async () => { executed.push('start') },
    close: async () => { executed.push('close') },
    rollback: async () => { executed.push('rollback') },
    execute: async () => { executed.push('execute') },
    done: async () => { executed.push('done') },
  }

  afterEach(() => {
    executed = []
  })

  it('ok order is correct', async () => {
    const flow = defineFlow(async () => {
      await svc.start()

      defer(() => svc.close())
      onError(e => svc.rollback())
      onSuccess(() => svc.done())

      await svc.execute()
    })

    const result = await run(flow, { params: [] })

    expect(result).toMatchObject(expect.objectContaining({ state: 'ok' }))
    expect(executed).toMatchObject(['start', 'execute', 'done', 'close'])
  })

  it('inline flow order is correct', async () => {
    const result = await $.start(async () => {
      await svc.start()

      defer(() => svc.close())
      onError(e => svc.rollback())
      onSuccess(() => svc.done())

      await svc.execute()
    }, { params: [] })

    expect(result).toMatchObject(expect.objectContaining({ state: 'ok' }))
    expect(executed).toMatchObject(['start', 'execute', 'done', 'close'])
  })

  it('not ok order is correct', async () => {
    const flow = defineFlow(async () => {
      svc.start()

      defer(() => svc.close())
      onError(e => svc.rollback())
      onSuccess(() => svc.done())

      await svc.execute()
      throw new Error('error')
    })

    const result = await run(flow, { params: [] })

    expect(result).toMatchObject(expect.objectContaining({ state: 'error' }))
    expect(executed).toMatchObject(['start', 'execute', 'rollback', 'close'])
  })

  it('basic step thing', async () => {
    const step1 = defineStep(() => {
      executed.push('step 1')
      return 1
    }, { id: 'step 1' })

    const step2 = defineStep(() => {
      executed.push('step 2')
      return 2
    }, { id: 'step 2' })

    const flow = defineFlow(async () => {
      await svc.start()

      defer(() => svc.close())
      onError(e => svc.rollback())
      onSuccess(() => svc.done())

      return await $.flow(() => Promise.all([step1(), step2()]))
    })

    const result = await run(flow, { params: [] })

    expect(result).toMatchObject(expect.objectContaining({ state: 'ok', value: [1, 2] }))
    expect(executed).toMatchObject(['start', 'step 1', 'step 2', 'done', 'close'])
  })

})

describe('utilities', () => {
  const step = defineStep(async () => { })
  const flow = defineFlow(() => { })

  it('isStep should work', () => {
    expect(isStep(step)).toBeTruthy()
    expect(isStep(undefined)).toBeFalsy()
    expect(isStep(() => { })).toBeFalsy()
  })

  it('isFlow should work', () => {
    expect(isFlow(flow)).toBeTruthy()
    expect(isFlow(undefined)).toBeFalsy()
    expect(isFlow(() => { })).toBeFalsy()
  })

})
