type PV<T> = T | Promise<T>;

export interface WaitUntilOptions {
  sleepTime?: number;
  timeout?: number;
}

export function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function _waitUntil(func: () => PV<boolean>, opt?: WaitUntilOptions) {
  const sleepTime = opt?.sleepTime ?? 50;
  const timeout = opt?.timeout ?? 5000;
  const cycles = timeout / sleepTime;
  for (let i = 0; i < cycles; i++) {
    const res = await Promise.resolve(func());
    if (res)
      return;
    await wait(sleepTime);
  }
  throw new Error(`timeout`);
}

export async function waitUntil(funcs: (() => PV<boolean>) | (() => PV<boolean>)[], opt?: WaitUntilOptions) {
  if (!Array.isArray(funcs))
    return _waitUntil(funcs, opt);
  const pro = funcs.map(func => _waitUntil(func, opt));
  return Promise.all(pro);
}

async function _retry(func: () => void, opt?: WaitUntilOptions) {
  const sleepTime = opt?.sleepTime ?? 50;
  const timeout = opt?.timeout ?? 5000;
  const cycles = Math.ceil(timeout / sleepTime);
  for (let i = 0; i < cycles; i++) {
    try {
      await Promise.resolve(func());
      return;
    }
    catch (ex) {
      if (i === cycles - 1)
        throw ex;
    }
    await wait(sleepTime);
  }
  throw new Error(`invalid arguments`);
}

export async function retry(func: (() => void) | (() => void)[], opt?: WaitUntilOptions) {
  if (!Array.isArray(func))
    return _retry(func, opt);
  return Promise.all(func.map(f => _retry(f, opt)));
}

export async function equals<T>(value1: PV<T>, value2: PV<T>): Promise<boolean> {
  const v1 = await Promise.resolve(value1);
  const v2 = await Promise.resolve(value2);
  return (v1 === v2);
}

export function every<T>(...values: PV<T>[]): Promise<boolean> {
  return Promise.all(values).then(res => res.every(v => v === true));
}

export function some<T>(...values: PV<T>[]): Promise<boolean> {
  return Promise.all(values).then(res => res.some(v => v === true));
}
