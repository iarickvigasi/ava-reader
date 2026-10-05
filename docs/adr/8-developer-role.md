# Developer role and AVA profile

Status: accepted · Date: 2026-10-05

Developer contact is distinct from administration. Extend the existing single-role enum with
DEVELOPER; it grants contact-profile eligibility, not ADMIN permissions. Existing roles stay intact.
Role assignment remains an operator action; profile endpoints never accept role changes.

AVA display names may override Clerk names; Clerk remains the source of account identity and photos.
Store the override separately so background Clerk refresh cannot undo an AVA profile edit.
Telegram URLs belong to AVA profiles and are published only for DEVELOPER accounts.

Consequence: the current single-role model cannot grant ADMIN and DEVELOPER simultaneously.
A future requirement for combined responsibilities should introduce multi-role membership explicitly.
