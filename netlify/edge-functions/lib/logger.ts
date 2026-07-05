const PREFIX = "[siata-rain-sync]"

type LogMeta = Record<string, unknown>

function mergeMeta(meta?: LogMeta): string {
  return meta ? ` ${JSON.stringify(meta)}` : ""
}

export function logInfo(message: string, meta?: LogMeta): void {
  console.log(`${PREFIX} ${message}${mergeMeta(meta)}`)
}

export function logWarn(message: string, meta?: LogMeta): void {
  console.warn(`${PREFIX} ${message}${mergeMeta(meta)}`)
}

export function serializeError(error: unknown): LogMeta {
  if (!(error instanceof Error)) {
    return { errorType: typeof error, errorValue: String(error) }
  }

  const cause =
    error.cause instanceof Error
      ? {
          causeName: error.cause.name,
          causeMessage: error.cause.message,
          causeCode:
            typeof error.cause === "object" &&
            error.cause !== null &&
            "code" in error.cause
              ? String((error.cause as { code?: unknown }).code)
              : undefined,
        }
      : error.cause != null
        ? { cause: String(error.cause) }
        : {}

  return {
    errorName: error.name,
    errorMessage: error.message,
    ...cause,
    stack: error.stack?.split("\n").slice(0, 4).join(" | "),
  }
}

export function logError(
  message: string,
  error: unknown,
  meta?: LogMeta
): void {
  console.error(
    `${PREFIX} ${message}${mergeMeta({ ...meta, ...serializeError(error) })}`
  )
}

export async function timedStep<T>(
  label: string,
  run: () => Promise<T>,
  meta?: LogMeta
): Promise<T> {
  const startedAt = Date.now()
  logInfo(`${label} — start`, meta)

  try {
    const result = await run()
    logInfo(`${label} — ok`, { ...meta, durationMs: Date.now() - startedAt })
    return result
  } catch (error) {
    logError(`${label} — failed`, error, {
      ...meta,
      durationMs: Date.now() - startedAt,
    })
    throw error
  }
}
