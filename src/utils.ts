import { Context } from 'koishi'

function noop() { }

export class Resolver<T> {
  public readonly promise: Promise<T>

  private resolver: (result?: T | PromiseLike<T>) => void
  private rejecter: (reason: any | PromiseLike<any>) => void

  constructor() {
    this.promise = new Promise<T>((resolve, reject) => {
      this.resolver = resolve
      this.rejecter = reject
    })
  }

  get resolve() { return this.resolver }
  get reject() { return this.rejecter }
}

export class Lock {
  private tip: Promise<void>

  constructor() {
    this.tip = Promise.resolve<void>(undefined)
  }

  public async acquire(): Promise<() => void> {
    const oldTip = this.tip
    let resolver = noop
    const promise = new Promise<void>(resolve => { resolver = resolve })
    this.tip = oldTip.then(() => promise)
    return oldTip.then(() => resolver)
  }
}

export function serialized<T, F extends (...args: any[]) => Promise<T>>(ctx: Context, callback: F): F {
  const lock = new Lock()
  const wrapper = async (...args: Parameters<F>): Promise<T> => {
    const release = await lock.acquire()
    ctx.scope.assertActive()

    try {
      return await callback(...args)
    } finally {
      release()
    }
  }
  return wrapper as F
}

export function throttle<T, F extends (...args: any[]) => Promise<T>>(ctx: Context, callback: F, delay: number, noTrailing?: boolean): F {
  const inner: any = ctx.throttle(((...args: Parameters<F>) => {
    inner.result = callback(...args)
  }) as F, delay, noTrailing)
  const wrapper = (...args: Parameters<F>) => {
    inner(...args)
    return inner.result
  }
  return wrapper as F
}

export function parsePlatform(target: string): [platform: string, id: string] {
  const index = target.indexOf(':')
  const platform = target.slice(0, index)
  const id = target.slice(index + 1)
  return [platform, id] as any
}
