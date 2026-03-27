'use client'

import { SignOutButton } from '@clerk/nextjs'

export function PulseSignOutButton() {
  return (
    <SignOutButton redirectUrl="/sign-in">
      <button
        type="button"
        className="inline-flex h-9 items-center justify-center rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-900 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-900"
      >
        Sign out
      </button>
    </SignOutButton>
  )
}

