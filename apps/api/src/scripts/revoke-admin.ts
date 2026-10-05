import { UserRole } from '@prisma/client';
import { runRoleCommand } from './run-role-command';

void runRoleCommand(UserRole.ADMIN, 'revoke');
