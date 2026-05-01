import { Suspense } from 'react'
import SignInForm from './sign-in-form'

type Props = {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>
}

export default async function SignInPage({ searchParams }: Props) {
  const { callbackUrl = '/dashboard', error } = await searchParams
  return (
    <Suspense>
      <SignInForm callbackUrl={callbackUrl} error={error} />
    </Suspense>
  )
}
