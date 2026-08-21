/**
 * Wire Node global fetch through HTTPS_PROXY / HTTP_PROXY / ALL_PROXY.
 * Needed in regions where generativelanguage.googleapis.com is unreachable directly.
 */
export async function installProxyFromEnv(): Promise<void> {
  const proxy =
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy ||
    process.env.ALL_PROXY ||
    process.env.all_proxy;

  if (!proxy) return;

  const { EnvHttpProxyAgent, setGlobalDispatcher } = await import("undici");
  setGlobalDispatcher(new EnvHttpProxyAgent());
  const redacted = proxy.replace(/\/\/([^/@]+)@/, "//***@");
  console.log(`[net] proxy enabled → ${redacted}`);
}
