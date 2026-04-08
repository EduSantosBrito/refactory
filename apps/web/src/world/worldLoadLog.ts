function createTimestamp(): string {
  return new Date().toISOString();
}

const loggedEventKeys = new Set<string>();

export function logWorldLoadEvent(message: string): void {
  console.info(`[world] ${message}`, {
    timestamp: createTimestamp(),
  });
}

export function logWorldLoadEventOnce(
  key: string,
  message: string,
): void {
  if (loggedEventKeys.has(key)) {
    return;
  }

  loggedEventKeys.add(key);
  logWorldLoadEvent(message);
}
