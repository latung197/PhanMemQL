import { createContext } from 'react';
import type { ConfirmOptions } from './ConfirmDialog';

// The context object lives alone in this file (type-only imports) so it keeps its identity when the dev server
// hot-reloads the provider's file; otherwise provider and hook could end up with two different context objects.

export type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

export const ConfirmContext = createContext<ConfirmFn | null>(null);
