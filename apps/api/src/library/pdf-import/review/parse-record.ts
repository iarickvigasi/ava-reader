import { z } from 'zod';
export const reviewVerdict = z.enum(['PASS', 'REVIEW', 'BLOCKED']);
export const reviewDecision = z.enum(['APPROVE', 'REJECT']);
