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
        url: `${issuer}/auth`,
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
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
      }
      if (account?.access_token) token.accessToken = account.access_token;
      if (token.accessToken) {
        try {
          const response = await fetch(`${issuer}/userinfo`, {
            headers: { Authorization: `Bearer ${token.accessToken}` },
            cache: "no-store",
          });
          if (response.ok) {
            const userInfo = await response.json();
            token.name = userInfo.name || token.name || userInfo.real_name || userInfo.preferred_username;
            token.email = userInfo.email || token.email;
            token.id = userInfo.sub || token.id;
            token.userInfo = userInfo;
          }
        } catch {
          // Keep the existing token if userinfo is unreachable.
        }
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        if (token.name) session.user.name = token.name as string;
        if (token.email) session.user.email = token.email as string;
      }
      session.accessToken = token.accessToken as string | undefined;
      session.userInfo = token.userInfo as Record<string, unknown> | undefined;
      return session;
    },
  },
  session: { strategy: "jwt" },
});

export function consentKeysConfigured() {
  return Boolean(process.env.CONSENTKEYS_CLIENT_ID && process.env.CONSENTKEYS_CLIENT_SECRET);
}
