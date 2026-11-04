import type { ZeroModule } from '../core/module.js';
import { catalogModule } from './catalog.js';
import { githubModule } from './github.js';
import { projectModule } from './project.js';
import { securityModule } from './security.js';
import { zeroModule } from './zero.js';

/** Add a module here and it is configurable, permission-gated, rate-limited and audited automatically. */
export const ALL_MODULES: ZeroModule[] = [zeroModule, projectModule, securityModule, githubModule, catalogModule];
