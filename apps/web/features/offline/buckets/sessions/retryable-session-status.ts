export function retryableSessionStatus(status: number): boolean {
  return [401, 408, 425, 429].includes(status) || status >= 500;
}
