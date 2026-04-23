const _bus = {};
export const on   = (ev, fn) => (_bus[ev] ??= []).push(fn);
export const off  = (ev, fn) => { _bus[ev] = (_bus[ev] ?? []).filter(f => f !== fn); };
export const emit = (ev, data) => (_bus[ev] ?? []).slice().forEach(f => f(data));
