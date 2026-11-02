import Link from "next/link"
import { ArrowRightIcon, type LucideIcon } from "lucide-react"

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type HomeSectionProps = {
  icon: LucideIcon
  title: string
  description: string
  href: string
  linkLabel: string
  footer?: React.ReactNode
  children: React.ReactNode
}

/** Shell for one topic summary on the home page. */
export function HomeSection({
  icon: Icon,
  title,
  description,
  href,
  linkLabel,
  footer,
  children,
}: HomeSectionProps) {
  return (
    <Card className="h-full bg-linear-to-t from-primary/5 to-card shadow-xs dark:bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Icon className="size-4" />
          </span>
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
        <CardAction>
          <Link
            href={href}
            className="inline-flex items-center gap-1 rounded-md text-sm font-medium text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {linkLabel}
            <ArrowRightIcon className="size-3.5" />
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">{children}</CardContent>
      {footer ? (
        <CardFooter className="text-xs text-muted-foreground">{footer}</CardFooter>
      ) : null}
    </Card>
  )
}

export function HomeSectionEmpty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
      {children}
    </div>
  )
}
