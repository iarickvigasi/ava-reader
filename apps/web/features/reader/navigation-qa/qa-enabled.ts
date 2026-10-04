export function navigationQaEnabled(
  hostname: string,
  flag: string | undefined,
  bound: boolean,
) {
  return (
    flag === "1" &&
    bound &&
    ["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname)
  );
}
