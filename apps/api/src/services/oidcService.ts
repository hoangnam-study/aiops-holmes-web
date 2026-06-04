import * as oidc from "openid-client";
import { env } from "../config/env.js";

let cachedConfig: oidc.Configuration | undefined;

export function oidcEnabled() {
  return Boolean(env.OIDC_ISSUER_URL && env.OIDC_CLIENT_ID && env.OIDC_REDIRECT_URI);
}

export async function getOidcConfig() {
  if (!oidcEnabled()) throw new Error("OIDC is not configured");
  if (cachedConfig) return cachedConfig;
  cachedConfig = await oidc.discovery(
    new URL(env.OIDC_ISSUER_URL!),
    env.OIDC_CLIENT_ID!,
    env.OIDC_CLIENT_SECRET || undefined
  );
  return cachedConfig;
}

export async function buildOidcAuthorizationUrl() {
  const config = await getOidcConfig();
  const codeVerifier = oidc.randomPKCECodeVerifier();
  const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);
  const state = oidc.randomState();
  const nonce = oidc.randomNonce();
  const redirectTo = oidc.buildAuthorizationUrl(config, {
    redirect_uri: env.OIDC_REDIRECT_URI!,
    scope: env.OIDC_SCOPES,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
    nonce
  });
  return { redirectTo, codeVerifier, state, nonce };
}

export async function completeOidcAuthorization(currentUrl: URL, checks: {
  codeVerifier: string;
  state: string;
  nonce: string;
}) {
  const config = await getOidcConfig();
  const tokens = await oidc.authorizationCodeGrant(config, currentUrl, {
    pkceCodeVerifier: checks.codeVerifier,
    expectedState: checks.state,
    expectedNonce: checks.nonce,
    idTokenExpected: true
  });
  return tokens.claims();
}
