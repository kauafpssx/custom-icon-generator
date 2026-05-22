import { IncomingMessage, ServerResponse } from 'http';
import { handleApiRequest } from './_lib/handler';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  return handleApiRequest(req, res);
}
