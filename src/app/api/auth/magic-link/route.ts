import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { randomBytes } from 'crypto'

function adminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: NextRequest) {
  if (!process.env.RESEND_API_KEY) {
    console.error('[magic-link] RESEND_API_KEY not set')
    return NextResponse.json({ error: 'Email-сервис не настроен' }, { status: 500 })
  }

  const body = await req.json().catch(() => ({}))
  const email = (body.email ?? '').trim().toLowerCase()

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Неверный формат email' }, { status: 400 })
  }

  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000)

  const supabase = adminSupabase()
  const { error: dbError } = await supabase.from('magic_links').insert({
    token,
    email,
    expires_at: expiresAt.toISOString(),
  })

  if (dbError) {
    console.error('[magic-link] DB error:', dbError.message)
    return NextResponse.json({ error: `DB: ${dbError.message}` }, { status: 500 })
  }

  const verifyUrl = `${process.env.NEXTAUTH_URL}/auth/verify?token=${token}`
  const resend = new Resend(process.env.RESEND_API_KEY)

  const { error: emailError } = await resend.emails.send({
    from: 'Smart Intendance <noreply@smart-intendance.ru>',
    to: email,
    subject: 'Ссылка для входа в Smart Intendance',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="margin-bottom: 8px;">Вход в Smart Intendance</h2>
        <p style="color: #555; margin-bottom: 24px;">
          Нажмите кнопку ниже для входа. Ссылка действует <strong>15 минут</strong>.
        </p>
        <a href="${verifyUrl}"
           style="display: inline-block; padding: 12px 24px; background: #2563eb;
                  color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600;">
          Войти
        </a>
        <p style="color: #999; font-size: 12px; margin-top: 24px;">
          Если вы не запрашивали вход — просто проигнорируйте это письмо.
        </p>
      </div>
    `,
  })

  if (emailError) {
    console.error('[magic-link] Resend error:', JSON.stringify(emailError))
    return NextResponse.json({ error: `Email: ${JSON.stringify(emailError)}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
