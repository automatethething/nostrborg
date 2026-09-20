export {};

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    userInfo?: Record<string, unknown>;
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    accessToken?: string;
    userInfo?: Record<string, unknown>;
  }
}
