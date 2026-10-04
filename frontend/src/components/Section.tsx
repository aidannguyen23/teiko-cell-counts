import { ChevronDown } from 'lucide-react'
import { type ReactNode, useState } from 'react'

import { Card } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

// collapsible card. h2 wraps the button (not the other way) so its valid html + reads right in a screen reader
export function Section({
  title,
  description,
  defaultOpen = true,
  children,
}: {
  title: string
  description?: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <Card className="gap-0 overflow-visible py-0">
        <h2>
          <CollapsibleTrigger asChild>
            <button className="flex w-full items-start justify-between gap-4 rounded-xl px-5 py-4 text-left transition-colors hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
              <span className="space-y-0.5">
                <span className="block text-base font-medium">{title}</span>
                {description && <span className="block text-sm font-normal text-muted-foreground">{description}</span>}
              </span>
              <ChevronDown
                aria-hidden
                className={cn('mt-1 size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
              />
            </button>
          </CollapsibleTrigger>
        </h2>
        <CollapsibleContent>
          <div className="border-t px-5 py-5">{children}</div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
