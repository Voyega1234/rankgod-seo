export interface FetchResult {
  url: string;
  html: string | null;
  status: number | null;
  finalUrl: string | null;
  error: string | null;
}

export async function fetchPage(url: string): Promise<FetchResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "th-TH,th;q=0.9,en-US;q=0.8,en;q=0.7",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
      },
      redirect: "follow",
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const html = await res.text();
    return {
      url,
      html,
      status: res.status,
      finalUrl: res.url,
      error: null,
    };
  } catch (err: unknown) {
    return {
      url,
      html: null,
      status: null,
      finalUrl: null,
      error: err instanceof Error ? err.message : "Fetch failed",
    };
  }
}
