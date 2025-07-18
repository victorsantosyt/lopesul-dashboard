import { NextResponse } from 'next/server';

export function middleware(request) {
  const token = request.cookies.get('token')?.value;
  const { pathname } = request.nextUrl;

  const isPublicRoute = pathname.startsWith('/login') || pathname.startsWith('/api');
  const isProtected = !isPublicRoute && !token;

  if (isProtected) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}
ç