export function createPreloader({ fetch: fetcher = (...args) => globalThis.fetch(...args), concurrency = 2,
  maxBytes = 16 * 1024 * 1024, maxFiles = 40 } = {}) {
  let controller = null;
  const completed = new Set();
  let latest = { done: 0, failed: 0, total: 0, bytes: 0 };
  return {
    get status() { return { ...latest }; },
    cancel() { controller?.abort(); },
    async run(urls, onProgress) {
      controller?.abort();
      const batch = controller = new AbortController();
      const list = [...new Set(urls.filter(url => typeof url === 'string' && url))]
        .filter(url => !completed.has(url)).slice(0, maxFiles);
      const progress = latest = { done: 0, failed: 0, total: list.length, bytes: 0 };
      let next = 0;
      async function worker() {
        while (!batch.signal.aborted && next < list.length && progress.bytes < maxBytes) {
          const url = list[next++];
          const request = new AbortController();
          const abort = () => request.abort();
          batch.signal.addEventListener('abort', abort, { once: true });
          const timeout = setTimeout(abort, 8000);
          try {
            const response = await fetcher(url, { signal: request.signal, cache: 'default', credentials: 'same-origin' });
            if (!response.ok || !response.body?.getReader) throw new Error('preload unavailable');
            const size = Number(response.headers.get('content-length'));
            if (size > maxBytes - progress.bytes) { await response.body.cancel(); throw new Error('preload budget'); }
            const reader = response.body.getReader();
            while (true) {
              const chunk = await reader.read();
              if (chunk.done) break;
              progress.bytes += chunk.value.byteLength;
              if (progress.bytes > maxBytes || request.signal.aborted) {
                await reader.cancel();
                throw new Error('preload budget');
              }
            }
            if (!batch.signal.aborted) {
              completed.add(url);
              while (completed.size > 256) completed.delete(completed.values().next().value);
              progress.done++;
              try { onProgress?.({ ...progress }); } catch {}
            }
          } catch {
            if (!batch.signal.aborted) {
              progress.failed++;
              try { onProgress?.({ ...progress }); } catch {}
            }
          }
          finally {
            clearTimeout(timeout);
            batch.signal.removeEventListener('abort', abort);
          }
        }
      }
      await Promise.all(Array.from({ length: Math.min(concurrency, list.length) }, worker));
      return { ...progress };
    },
  };
}
