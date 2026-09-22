export function stripSessionSecrets(session) {
  if (!session || typeof session !== "object") return session;

  const user = session.user && typeof session.user === "object" ? session.user : null;
  const next = {
    ...session,
    user: user
      ? {
          id: typeof user.id === "string" ? user.id : undefined,
          name: typeof user.name === "string" ? user.name : null,
          email: typeof user.email === "string" ? user.email : null,
        }
      : session.user,
  };
  delete next.accessToken;
  delete next.userInfo;
  return next;
}

export function stripJwtSecrets(token) {
  if (!token || typeof token !== "object") return token;
  const next = { ...token };
  delete next.accessToken;
  delete next.userInfo;
  return next;
}
