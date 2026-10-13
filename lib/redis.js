'use strict';

/** Upstash Redis REST client (env: KV_REST_API_URL, KV_REST_API_TOKEN). */
function createRedis({ url = process.env.KV_REST_API_URL, token = process.env.KV_REST_API_TOKEN, fetchImpl = fetch } = {}) {
  async function command(cmd, args = []) {
    if (!url || !token) throw new Error('Redis not configured');
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([cmd, ...args]),
    });
    if (!res.ok) throw new Error(`Redis error: ${res.status}`);
    const data = await res.json();
    return data.result;
  }
  return { command };
}

module.exports = { createRedis };
