import type { AuthenticatedRequest } from '../../auth/authenticated-request';
export function translationCapability(request: AuthenticatedRequest) {
  const schema = request.headers['x-ava-reader-schema'];
  const build = request.headers['x-ava-reader-build'];
  return {
    schema: typeof schema === 'string' ? schema : '',
    build: typeof build === 'string' ? build : '',
  };
}
