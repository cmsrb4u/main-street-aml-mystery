import { Sha256 } from '@aws-crypto/sha256-js';
import { HttpRequest } from '@smithy/protocol-http';
import { SignatureV4 } from '@smithy/signature-v4';
import { fetchAuthSession } from 'aws-amplify/auth';

import type { AnalysisResponse, RuntimeConfig } from './types';

export async function analyzeCase(
  config: RuntimeConfig,
  prompt: string,
): Promise<AnalysisResponse> {
  const session = await fetchAuthSession();
  if (!session.credentials) {
    throw new Error('Your AWS session is unavailable. Sign in again.');
  }

  const endpoint = new URL(config.apiEndpoint);
  const body = JSON.stringify({ prompt });
  const request = new HttpRequest({
    protocol: endpoint.protocol,
    hostname: endpoint.hostname,
    port: endpoint.port ? Number(endpoint.port) : undefined,
    method: 'POST',
    path: endpoint.pathname,
    query: Object.fromEntries(endpoint.searchParams),
    headers: {
      'content-type': 'application/json',
      host: endpoint.host,
    },
    body,
  });
  const signer = new SignatureV4({
    credentials: session.credentials,
    region: config.region,
    service: config.signingService,
    sha256: Sha256,
  });
  const signed = await signer.sign(request);
  const response = await fetch(endpoint, {
    method: signed.method,
    headers: signed.headers,
    body: signed.body,
  });

  const payload = (await response.json().catch(() => null)) as
    | AnalysisResponse
    | { message?: string }
    | null;
  if (!response.ok) {
    const message =
      payload && 'message' in payload && payload.message
        ? payload.message
        : `Analysis request failed (${response.status}).`;
    throw new Error(message);
  }
  return payload as AnalysisResponse;
}
