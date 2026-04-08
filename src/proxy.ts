import { auth } from "@/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  const isAuthed = !!req.auth
  const { pathname } = req.nextUrl

  const isProtected = pathname.startsWith("/dashboard")
  const isAuthPage = pathname.startsWith("/auth")

  if (isProtected && !isAuthed) {
    const signInUrl = new URL("/auth/signin", req.nextUrl)
    signInUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(signInUrl)
  }

  if (isAuthPage && isAuthed) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl))
  }
})

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}