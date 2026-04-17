import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const accessToken = request.cookies.get('accessToken')?.value;
  const userRole = request.cookies.get('userRole')?.value;

  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register');

  // If the user is not authenticated
  if (!accessToken) {
    if (isAuthPage) {
      return NextResponse.next(); // Allow access to auth pages
    }
    // Redirect any other protected route to the login page
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // If the user is authenticated
  if (isAuthPage) {
    // Redirect to the appropriate dashboard based on role
    switch (userRole) {
      case 'ADMIN':
        return NextResponse.redirect(new URL('/admin', request.url));
      case 'TEACHER':
        return NextResponse.redirect(new URL('/teacher', request.url));
      case 'STUDENT':
        return NextResponse.redirect(new URL('/student', request.url));
      default:
        // Fallback to homepage if role is not defined
        return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // Role-based route protection for dashboard access
  if (pathname.startsWith('/admin') && userRole !== 'ADMIN') {
    return NextResponse.redirect(new URL('/', request.url));
  }
  if (pathname.startsWith('/teacher') && userRole !== 'TEACHER') {
    return NextResponse.redirect(new URL('/', request.url));
  }
  if (pathname.startsWith('/student') && userRole !== 'STUDENT') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/login',
    '/register',
    '/admin/:path*',
    '/teacher/:path*',
    '/student/:path*',
  ],
};
