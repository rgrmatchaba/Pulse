import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getActiveSprint } from '@/lib/jira'

export async function GET() {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const tickets = await getActiveSprint()
    return NextResponse.json({ tickets })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}