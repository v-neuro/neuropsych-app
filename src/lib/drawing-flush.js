const flushers = new Set();
export function registerDrawingFlush(flush) {
  flushers.add(flush);
  return () => flushers.delete(flush);
}
export async function flushMountedDrawings() {
  await Promise.all([...flushers].map((flush) => flush()));
}
