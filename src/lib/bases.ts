/**
 * Major U.S. installations for the public "jobs near base" pages. Names are the current official names.
 * `near` lists the towns where most families live and work, used to put nearby jobs first.
 */
export type Base = { slug: string; name: string; branch: string; city: string; states: string[]; near: string[] };

export const BASES: Base[] = [
  { slug: 'camp-lejeune', name: 'Camp Lejeune', branch: 'Marine Corps', city: 'Jacksonville, NC', states: ['NC'], near: ['Jacksonville', 'Wilmington', 'New Bern', 'Swansboro', 'Havelock'] },
  { slug: 'fort-bragg', name: 'Fort Bragg', branch: 'Army', city: 'Fayetteville, NC', states: ['NC'], near: ['Fayetteville', 'Spring Lake', 'Raleigh', 'Southern Pines', 'Sanford'] },
  { slug: 'camp-pendleton', name: 'Camp Pendleton', branch: 'Marine Corps', city: 'Oceanside, CA', states: ['CA'], near: ['Oceanside', 'Carlsbad', 'San Diego', 'Temecula', 'Vista', 'Escondido'] },
  { slug: 'naval-base-san-diego', name: 'Naval Base San Diego', branch: 'Navy', city: 'San Diego, CA', states: ['CA'], near: ['San Diego', 'Chula Vista', 'National City', 'Coronado', 'El Cajon'] },
  { slug: 'naval-station-norfolk', name: 'Naval Station Norfolk', branch: 'Navy', city: 'Norfolk, VA', states: ['VA'], near: ['Norfolk', 'Virginia Beach', 'Chesapeake', 'Portsmouth', 'Newport News', 'Hampton', 'Suffolk'] },
  { slug: 'jblm', name: 'Joint Base Lewis-McChord', branch: 'Army and Air Force', city: 'Tacoma, WA', states: ['WA'], near: ['Tacoma', 'Lakewood', 'DuPont', 'Olympia', 'Seattle', 'Puyallup'] },
  { slug: 'fort-hood', name: 'Fort Hood', branch: 'Army', city: 'Killeen, TX', states: ['TX'], near: ['Killeen', 'Harker Heights', 'Copperas Cove', 'Temple', 'Belton', 'Austin'] },
  { slug: 'fort-campbell', name: 'Fort Campbell', branch: 'Army', city: 'Clarksville, TN', states: ['TN', 'KY'], near: ['Clarksville', 'Hopkinsville', 'Nashville', 'Oak Grove'] },
  { slug: 'joint-base-san-antonio', name: 'Joint Base San Antonio', branch: 'Army and Air Force', city: 'San Antonio, TX', states: ['TX'], near: ['San Antonio', 'Universal City', 'Schertz', 'New Braunfels'] },
  { slug: 'fort-carson', name: 'Fort Carson', branch: 'Army', city: 'Colorado Springs, CO', states: ['CO'], near: ['Colorado Springs', 'Fountain', 'Pueblo', 'Denver', 'Aurora'] },
  { slug: 'fort-stewart', name: 'Fort Stewart', branch: 'Army', city: 'Hinesville, GA', states: ['GA'], near: ['Hinesville', 'Savannah', 'Richmond Hill', 'Pooler'] },
  { slug: 'fort-benning', name: 'Fort Benning', branch: 'Army', city: 'Columbus, GA', states: ['GA', 'AL'], near: ['Columbus', 'Phenix City', 'Auburn'] },
  { slug: 'fort-gordon', name: 'Fort Gordon', branch: 'Army', city: 'Augusta, GA', states: ['GA', 'SC'], near: ['Augusta', 'Grovetown', 'Evans', 'Aiken', 'North Augusta'] },
  { slug: 'fort-bliss', name: 'Fort Bliss', branch: 'Army', city: 'El Paso, TX', states: ['TX', 'NM'], near: ['El Paso', 'Las Cruces', 'Horizon City'] },
  { slug: 'fort-meade', name: 'Fort Meade', branch: 'Army and joint commands', city: 'Fort Meade, MD', states: ['MD'], near: ['Columbia', 'Annapolis Junction', 'Odenton', 'Laurel', 'Hanover', 'Baltimore', 'Annapolis'] },
  { slug: 'washington-dc-area', name: 'The Pentagon and Washington, D.C. area', branch: 'All branches', city: 'Arlington, VA', states: ['VA', 'DC', 'MD'], near: ['Arlington', 'Alexandria', 'Washington', 'Fairfax', 'Reston', 'Herndon', 'McLean', 'Chantilly', 'Bethesda', 'Springfield'] },
  { slug: 'pearl-harbor-hickam', name: 'Joint Base Pearl Harbor-Hickam', branch: 'Navy and Air Force', city: 'Honolulu, HI', states: ['HI'], near: ['Honolulu', 'Pearl City', 'Kapolei', 'Aiea', 'Kailua'] },
  { slug: 'eglin-afb', name: 'Eglin Air Force Base', branch: 'Air Force', city: 'Fort Walton Beach, FL', states: ['FL'], near: ['Fort Walton Beach', 'Destin', 'Niceville', 'Crestview', 'Pensacola'] },
  { slug: 'nas-jacksonville', name: 'Naval Air Station Jacksonville', branch: 'Navy', city: 'Jacksonville, FL', states: ['FL'], near: ['Jacksonville', 'Orange Park', 'St. Augustine', 'Fernandina Beach'] },
  { slug: 'macdill-afb', name: 'MacDill Air Force Base', branch: 'Air Force', city: 'Tampa, FL', states: ['FL'], near: ['Tampa', 'St. Petersburg', 'Brandon', 'Clearwater', 'Lakeland'] },
  { slug: 'wright-patterson-afb', name: 'Wright-Patterson Air Force Base', branch: 'Air Force', city: 'Dayton, OH', states: ['OH'], near: ['Dayton', 'Beavercreek', 'Fairborn', 'Kettering', 'Springfield'] },
  { slug: 'nellis-afb', name: 'Nellis Air Force Base', branch: 'Air Force', city: 'Las Vegas, NV', states: ['NV'], near: ['Las Vegas', 'North Las Vegas', 'Henderson'] },
  { slug: 'fort-drum', name: 'Fort Drum', branch: 'Army', city: 'Watertown, NY', states: ['NY'], near: ['Watertown', 'Syracuse', 'Carthage'] },
  { slug: 'fort-riley', name: 'Fort Riley', branch: 'Army', city: 'Junction City, KS', states: ['KS'], near: ['Junction City', 'Manhattan', 'Topeka'] },
];

export const baseBySlug = (slug: string) => BASES.find((b) => b.slug === slug) ?? null;
