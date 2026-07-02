import {
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';

export interface CurrentUserData {
  id: string;
  email: string;
  fullName: string;
  role: string;
  emailVerified: boolean;
  memberId: string | null;
}

export const CurrentUser = createParamDecorator<
  keyof CurrentUserData | undefined
>((data, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<{
    user: CurrentUserData;
  }>();

  const user = request.user;

  if (!data) {
    return user;
  }

  return user?.[data];
});