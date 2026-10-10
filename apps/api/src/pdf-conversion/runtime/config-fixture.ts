export const testConfig = {
  enabled: true as const,
  docker: '/usr/local/bin/docker',
  dockerHost: 'unix:///tmp/docker.sock',
  image: `sha256:${'f'.repeat(64)}`,
  mode: 'development' as const,
  memoryBytes: 536870912,
  cpus: 1,
};
