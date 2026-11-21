export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || !process.env.INTERNAL_API_SECRET) return;
  const { register: push } = await import('./lib/content');
  let tries = 0;
  const attempt = async () => {
    try {
      await push();
    } catch {
      if (++tries < 60) setTimeout(attempt, 15_000).unref?.();
    }
  };
  void attempt();
  setInterval(() => void push()?.catch(() => undefined), 10 * 60_000).unref?.();
}
