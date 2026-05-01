import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import Yandex from "next-auth/providers/yandex"
import Credentials from "next-auth/providers/credentials"
import { createClient } from "@supabase/supabase-js"

function adminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
    Yandex({
      clientId: process.env.AUTH_YANDEX_ID,
      clientSecret: process.env.AUTH_YANDEX_SECRET,
    }),
    Credentials({
      id: "magic-link",
      name: "Magic Link",
      credentials: { token: { type: "text" } },
      async authorize(credentials) {
        const token = credentials?.token as string | undefined
        if (!token) return null

        const supabase = adminSupabase()
        const { data, error } = await supabase
          .from("magic_links")
          .select("*")
          .eq("token", token)
          .is("used_at", null)
          .gt("expires_at", new Date().toISOString())
          .single()

        if (error || !data) return null

        await supabase
          .from("magic_links")
          .update({ used_at: new Date().toISOString() })
          .eq("token", token)

        return { id: data.email, email: data.email, name: data.email }
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub
      }
      return session
    },
  },
  trustHost: true,
})
