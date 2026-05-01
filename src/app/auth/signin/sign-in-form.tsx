'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { Package } from 'lucide-react'

type Props = {
  callbackUrl: string
  error?: string
}

const ERROR_MESSAGES: Record<string, string> = {
  OAuthAccountNotLinked: 'Этот email уже привязан к другому аккаунту.',
  invalid_link: 'Ссылка недействительна или истекла. Запросите новую.',
  missing_token: 'Ссылка повреждена. Запросите новую.',
}

export default function SignInForm({ callbackUrl, error }: Props) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle')
  const [errMsg, setErrMsg] = useState('')

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    try {
      const res = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Ошибка сервера')
      }
      setStatus('sent')
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : 'Что-то пошло не так')
      setStatus('error')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
            <Package className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Smart Intendance</h1>
          <p className="text-gray-600">Учёт и оптимизация финансов</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">
              {ERROR_MESSAGES[error] ?? 'Ошибка при входе. Попробуйте снова.'}
            </p>
          </div>
        )}

        {status === 'sent' ? (
          <div className="text-center p-6 bg-green-50 border border-green-200 rounded-xl">
            <div className="text-4xl mb-3">📨</div>
            <h2 className="text-lg font-semibold text-green-800 mb-2">Письмо отправлено!</h2>
            <p className="text-sm text-green-700">
              Проверьте почту <strong>{email}</strong> и перейдите по ссылке для входа.
            </p>
            <p className="text-xs text-green-600 mt-2">Ссылка действует 15 минут</p>
            <button
              onClick={() => { setStatus('idle'); setEmail('') }}
              className="mt-4 text-sm text-green-700 underline underline-offset-2"
            >
              Ввести другой email
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Email form */}
            <form onSubmit={handleEmail} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.ru"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>

              {status === 'error' && (
                <p className="text-sm text-red-600">{errMsg}</p>
              )}

              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 text-sm"
              >
                {status === 'loading' ? 'Отправляем...' : 'Войти через email'}
              </button>
            </form>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-3 bg-white text-gray-400">или</span>
              </div>
            </div>

            {/* Google */}
            <button
              onClick={() => signIn('google', { callbackUrl })}
              className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition font-semibold text-gray-700 text-sm shadow-sm"
            >
              <GoogleIcon />
              Войти через Google
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}
