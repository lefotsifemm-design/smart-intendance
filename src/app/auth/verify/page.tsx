import { signIn } from '@/auth'
import { AuthError } from 'next-auth'
import { redirect } from 'next/navigation'

type Props = {
  searchParams: Promise<{ token?: string }>
}

export default async function VerifyPage({ searchParams }: Props) {
  const { token } = await searchParams

  if (!token) {
    redirect('/auth/signin?error=invalid_link')
  }

  try {
    await signIn('magic-link', { token, redirectTo: '/dashboard' })
  } catch (error) {
    if (error instanceof AuthError) {
      redirect('/auth/signin?error=invalid_link')
    }
    // Re-throw NEXT_REDIRECT so Next.js handles navigation
    throw error
  }
}
