// Launch switches. Flip to true only after your attorney clears each item.
export const SHORTLISTS_ENABLED = false;        // Verified Shortlist + placement fee (employment-agency licensing review pending)
export const CONVERSION_FEES_ENABLED = false;   // contract-to-hire conversion fee (legal review pending; also add it back to the Terms and settle one rate)
// Freelance milestone payments through LanceNest (client funds → LanceNest's Stripe balance → transfer to the freelancer).
// Off until payments counsel reviews the fund flow. While off, posting, proposals, contracts and messaging still work,
// and the Terms, Trust, and Protected Payments pages say payments are arranged directly between the parties.
export const FREELANCE_PAYMENTS_ENABLED = false;
// "Continue with Google": shown only after the Google provider is set up in Supabase. Turn on by setting
// NEXT_PUBLIC_GOOGLE_SIGNIN=1 in Vercel and redeploying (the login and sign-up pages are pre-built).
export const GOOGLE_SIGNIN = process.env.NEXT_PUBLIC_GOOGLE_SIGNIN === '1';
// Trades that require a state/local license: hidden until license verification ships.
export const LICENSED_TRADES = ['HVAC & refrigeration', 'Electrical', 'Plumbing', 'Construction & remodeling', 'Roofing & exteriors'];
