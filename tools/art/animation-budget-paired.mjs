// Paired same-session timing gate (plan 07-16). RED stub: every name the first
// controls use is exported with no behaviour and a neutral result shape, so each
// control fails on its own assertion and not on a missing export or a missing
// property. The implementation follows.
export const PAIRED_CONTRACT = Object.freeze({});
export const PINNED_PATHS = Object.freeze([]);
export const TOOL_PATHS = Object.freeze([]);
export const REGISTRY_PATH = '';
export const EVIDENCE_DIR = '';
export const GENESIS = '';
export const FROZEN_SAMPLER = '';
export const SESSION_SETTINGS = Object.freeze({});
export function assertContract() {}
export function assertPins() {}
export function orderFor() {}
export function identityHash() {}
export function allowedSinceRegistration() {}
export function runGuard() {}
export function materializeArms() { return { sessionDirectory: '', arms: {}, difference: {} }; }
export function gitBlobId() {}
export function eventHash() { return ''; }
export function emptyRegistry() { return { events: [] }; }
export function appendEvent(registry, event) { return { ...registry, events: [...registry.events, { ...event }] }; }
export function verifyChain() { return { events: 0 }; }
export function registerSession(registry, entry) { return appendEvent(registry, { type: 'registered', ...entry }); }
export function countableSessions() {}
export function uncommittedEvents() {}
export function assertRunnable() {}
export function requiredSampleFields() {}
export function smokeReport() { return {}; }
export function evaluatePaired() { return { rule1: { comparisons: 0, violations: [] }, pairedBudgetPass: null }; }
