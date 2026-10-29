"use client";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  
  function handleLogin() {
    router.push("/login");
  }

  return (
    <button onClick={handleLogin}>Log In</button>
  );
}
