import { stripJwtSecrets, stripSessionSecrets } from "@/lib/session-public.mjs";
import NextAuth from "next-auth";

const issuer = process.env.CONSENTKEYS_ISSUER || "https://api.consentkeys.com";
const authSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "";

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: authSecret || undefined,
  trustHost: true,
  providers: [
    {
      id: "consentkeys",
      name: "ConsentKeys",
      type: "oidc",
      clientId: process.env.CONSENTKEYS_CLIENT_ID || "",
      clientSecret: process.env.CONSENTKEYS_CLIENT_SECRET || "",
      issuer,
      checks: ["pkce", "state"],
      authorization: {
        url: "https://auth.consentkeys.com/auth",
        params: { scope: "openid profile email" },
      },
      token: {
        url: `${issuer}/token`,
        params: { grant_type: "authorization_code" },
      },
      userinfo: `${issuer}/userinfo`,
      jwks_endpoint: `${issuer}/.well-known/jwks.json`,
      client: { token_endpoint_auth_method: "client_secret_post" },
      profile(profile) {
        return { id: profile.sub, name: profile.name, email: profile.email };
      },
    },
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
      }
      return stripJwtSecrets(token);
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        if (token.name) session.user.name = token.name as string;
        if (token.email) session.user.email = token.email as string;
      }
      return stripSessionSecrets(session);
    },
  },
  session: { strategy: "jwt" },
});

export function consentKeysConfigured() {
  return Boolean(process.env.CONSENTKEYS_CLIENT_ID && process.env.CONSENTKEYS_CLIENT_SECRET);
}
