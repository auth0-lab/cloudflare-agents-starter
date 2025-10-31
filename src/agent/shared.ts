// Approval string to be shared across frontend and backend
export const APPROVAL = {
  YES: "Yes, confirmed.",
  NO: "No, denied.",
} as const;

/**
 * Local type-safe wrappers for mixins with relaxed constraints
 *
 * These re-export the mixin functions from @auth0 packages with relaxed
 * type constraints that don't check for private fields. This allows flumix
 * to properly infer types without requiring manual declarations.
 */

import {
  AuthAgent as OriginalAuthAgent,
  OwnedAgent as OriginalOwnedAgent,
} from "@auth0/auth0-cloudflare-agents-api";
import { AsyncUserConfirmationResumer as OriginalAsyncUserConfirmationResumer } from "@auth0/ai-cloudflare";

// Helper type: Constructor without strict constraints
type AnyConstructor = new (...args: any[]) => any;

/**
 * AuthAgent mixin with relaxed constraints
 * Adds authentication functionality using JWT OAuth 2.0 Access Tokens
 */
export function AuthAgent<TBase extends AnyConstructor>(
  Base: TBase,
  options?: any
): ReturnType<typeof OriginalAuthAgent<any, TBase>> {
  return OriginalAuthAgent(Base as any, options) as any;
}

/**
 * OwnedAgent mixin with relaxed constraints
 * Ensures durable objects have an owner set during creation
 */
export function OwnedAgent<TBase extends AnyConstructor>(
  Base: TBase,
  options?: { debug?: (message: string, ctx: any) => void }
): ReturnType<typeof OriginalOwnedAgent<any, TBase>> {
  return OriginalOwnedAgent(Base as any, options) as any;
}

/**
 * AsyncUserConfirmationResumer mixin with relaxed constraints
 * Handles async user confirmation polling using Agent scheduling
 */
export function AsyncUserConfirmationResumer<TBase extends AnyConstructor>(
  Base: TBase
): ReturnType<typeof OriginalAsyncUserConfirmationResumer<TBase>> {
  return OriginalAsyncUserConfirmationResumer(Base as any) as any;
}
