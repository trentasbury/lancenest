/** Photo IDs LanceNest accepts. Never military, VA or other federal agency ID cards (18 U.S.C. § 701). */
export const ID_TYPES = {
  drivers_license: 'Driver’s license',
  state_id: 'State ID card',
  passport: 'U.S. passport',
  passport_card: 'U.S. passport card',
} as const;

export type IdType = keyof typeof ID_TYPES;

export const idTypeLabel = (t: string | null | undefined) =>
  t && Object.prototype.hasOwnProperty.call(ID_TYPES, t) ? ID_TYPES[t as IdType] : 'Photo ID';
