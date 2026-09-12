'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import LoginScreen from '@/components/LoginScreen';

export default function Home() {
  const { token } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (token) router.replace('/chat');
  }, [token, router]);

  return <LoginScreen />;
}
