const _registry = [];

/** @param {string} name  @param {() => Promise<unknown>} loader */
export function register(name, loader) {
  _registry.push({ name, loader });
}

/** Runs all registered loaders in parallel. Returns a map of name → result. */
export async function loadAll() {
  const settled = await Promise.allSettled(_registry.map(({ name, loader }) =>
    loader().then(r => ({ name, result: r }))
  ));
  return Object.fromEntries(
    settled.map((s, i) => [
      _registry[i].name,
      s.status === 'fulfilled' ? s.value.result : false,
    ])
  );
}
