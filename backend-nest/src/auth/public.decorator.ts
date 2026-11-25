import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'isPublic';

/** Marks a route as reachable without a bearer token (sign-in and password reset). */
export const Public = () => SetMetadata(IS_PUBLIC, true);
