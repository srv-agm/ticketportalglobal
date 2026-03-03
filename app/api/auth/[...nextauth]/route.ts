import NextAuth, { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import AzureADProvider from "next-auth/providers/azure-ad"
import { findOrCreateSSOUser, getUserByEmail, loginUser } from "@/lib/actions/auth"

// Check if Microsoft SSO is configured
const isMicrosoftConfigured = 
  process.env.MICROSOFT_CLIENT_ID && 
  process.env.MICROSOFT_CLIENT_SECRET

// Only warn about Microsoft config if not configured (it's optional)
if (!isMicrosoftConfigured) {
  console.log("ℹ️ Microsoft SSO is not configured. Only credentials login will be available.")
}

// Build providers array dynamically
const providers: NextAuthOptions["providers"] = []

// Always add Credentials provider for email/password login
providers.push(
  CredentialsProvider({
    name: "Credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) {
        return null
      }
      
      const result = await loginUser(credentials.email, credentials.password)
      
      if (result.success && result.user) {
        return {
          id: result.user.id.toString(),
          email: result.user.email,
          name: result.user.full_name,
          role: result.user.role,
          business_unit_group_id: result.user.business_unit_group_id,
          group_name: result.user.group_name,
        }
      }
      
      return null
    },
  })
)

// Add Azure AD provider only if configured
if (isMicrosoftConfigured) {
  providers.push(
    AzureADProvider({
      clientId: process.env.MICROSOFT_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
      tenantId: process.env.MICROSOFT_TENANT_ID || "common",
      authorization: {
        params: {
          scope: "openid profile email User.Read",
        },
      },
    })
  )
}

export const authOptions: NextAuthOptions = {
  providers,

  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "azure-ad") return true

      if (!user.email) {
        console.error("SSO sign-in attempted without email")
        return false
      }

      // ✅ FIX #3 (optional): Restrict to company domain — uncomment if internal-only
      // if (!user.email.endsWith("@yourcompany.com")) {
      //   console.warn("SSO sign-in rejected: external domain", user.email)
      //   return false
      // }

      try {
        const profileData = profile as Record<string, unknown> | undefined
        const result = await findOrCreateSSOUser({
          email: user.email,
          name:
            user.name ??
            (profileData?.displayName as string | undefined) ??
            user.email.split("@")[0],
          microsoftId: account.providerAccountId,
          image: user.image ?? (profileData?.picture as string | undefined) ?? null,
        })

        if (!result.success || !result.user) {
          console.error("Failed to find or create SSO user:", result.error)
          // Check if it's a database connection error
          const errorMsg = result.error || ""
          if (errorMsg.includes("fetch failed") || errorMsg.includes("ECONNREFUSED") || errorMsg.includes("DATABASE_URL")) {
            console.error("Database connection error during SSO authentication")
            // Return false but NextAuth will show AccessDenied - we'll handle this in the error page
          }
          return false
        }

        return true
      } catch (err) {
        console.error("signIn callback error:", err)
        const errorMessage = err instanceof Error ? err.message : "Unknown error"
        // Check if it's a database connection error
        if (errorMessage.includes("fetch failed") || errorMessage.includes("ECONNREFUSED") || errorMessage.includes("DATABASE_URL")) {
          console.error("Database connection error during SSO authentication:", errorMessage)
        }
        return false
      }
    },

    async jwt({ token, user, account, trigger }) {
      // Populate token from user data (works for both credentials and SSO)
      if (user) {
        token.id = user.id
        token.email = user.email
        token.name = user.name
        // Handle custom fields from credentials provider
        if ("role" in user) token.role = user.role
        if ("business_unit_group_id" in user) token.business_unit_group_id = user.business_unit_group_id
        if ("group_name" in user) token.group_name = user.group_name
        token.auth_provider = account?.provider === "azure-ad" ? "microsoft" : "credentials"
      }

      // Store access token for Microsoft Graph API calls
      if (account?.access_token) {
        token.accessToken = account.access_token
      }

      const shouldHydrate =
        (user != null && account?.provider === "azure-ad") ||
        trigger === "update" ||
        (token.email != null && !token.id) // Re-hydrate if token.id is missing (handles server restart/edge cold start)

      if (shouldHydrate && token.email) {
        try {
          const dbUser = await getUserByEmail(token.email)
          if (dbUser) {
            token.id                    = dbUser.id.toString()
            token.name                  = dbUser.full_name
            token.role                  = dbUser.role
            token.business_unit_group_id = dbUser.business_unit_group_id ?? null
            token.group_name            = dbUser.group_name ?? null
            token.auth_provider         = dbUser.auth_provider ?? "credentials"
          }
        } catch (err) {
          console.error("jwt callback DB hydration error:", err)
          // Don't throw - allow auth to continue with cached token data
          // This prevents auth failures during temporary DB outages or cold starts
          // The token will retain any previously hydrated values
        }
      }

      return token
    },

    async session({ session, token }) {
      session.user = {
        ...session.user,
        id:                      (token.id as string) ?? "",
        role:                    (token.role as string) ?? "user",
        business_unit_group_id:  token.business_unit_group_id as number | undefined,
        group_name:              token.group_name as string | undefined,
        auth_provider:           (token.auth_provider as string) ?? "credentials",
      }
      // Store access token in session for API calls
      session.accessToken = token.accessToken as string | undefined
      return session
    },
  },

  pages: {
    signIn: "/login",
    error:  "/login",
  },

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  // Use AUTH_SECRET, fall back to NEXTAUTH_SECRET for compatibility
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  
  // Automatically detect URL in production (Vercel sets VERCEL_URL)
  ...(process.env.NEXTAUTH_URL ? {} : process.env.VERCEL_URL ? {
    // On Vercel, use VERCEL_URL if NEXTAUTH_URL is not set
  } : {}),
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
