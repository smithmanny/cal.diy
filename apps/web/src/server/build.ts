/**
 * True in anything built with `vite build`, on both runtimes. Production-only safeguards key off
 * this rather than NODE_ENV, which a Workers deployment doesn't set unless someone remembers to.
 */
export const IS_PRODUCTION_BUILD: boolean = import.meta.env.PROD;
