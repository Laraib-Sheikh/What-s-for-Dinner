import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "./prisma";

function adminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

async function resolveRole(email: string | null | undefined, currentRole: string) {
  if (!email) return currentRole;
  if (adminEmails().has(email.toLowerCase()) && currentRole !== "admin") {
    await prisma.user.update({
      where: { email },
      data: { role: "admin" },
    });
    return "admin";
  }
  return currentRole;
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        name: { label: "Name", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email) return null;

        let user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) {
          const role = adminEmails().has(credentials.email.toLowerCase()) ? "admin" : "user";
          user = await prisma.user.create({
            data: {
              email: credentials.email,
              name: credentials.name || credentials.email.split("@")[0],
              role,
            },
          });
        } else if (user.suspendedAt) {
          return null;
        } else {
          const role = await resolveRole(user.email, user.role);
          user = { ...user, role };
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user }) {
      if (!user?.email) return true;
      const dbUser = await prisma.user.findUnique({ where: { email: user.email } });
      if (dbUser?.suspendedAt) return false;
      await resolveRole(user.email, dbUser?.role || "user");
      return true;
    },
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role || "user";
      }

      // Refresh role periodically / on update
      if (token.id && (user || trigger === "update" || !token.role)) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, suspendedAt: true, email: true },
        });
        if (!dbUser || dbUser.suspendedAt) {
          token.role = "user";
        } else {
          token.role = await resolveRole(dbUser.email, dbUser.role);
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as string) || "user";
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
};
