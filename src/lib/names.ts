/** Names only LanceNest staff may use (mirrors the database rule, last updated in migration 0091). */
const RESERVED = /\blancenest|\blance[\s._-]+nest\b|\b(admin|administrator|moderator)\b|\b(support|trust\s*(&|and)?\s*safety|verification)\s+team\b/i;
export const RESERVED_NAME_MESSAGE = 'Names can’t include LanceNest, admin, or moderator.';
export const isReservedName = (name: string) => RESERVED.test(name);
