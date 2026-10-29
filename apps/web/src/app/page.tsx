import Link from "next/link";

export default function Home() {

  return (
    <>
      <main className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center gap-4">
        <h1 className="text-4xl text-neutral-100">MockThread</h1>
        <p  className="text-neutral-400">Real-time peer-to-peer mock technical interviews</p>
        <Link href="/login" className="text-neutral-300 underline">Log in</Link>
      </main>
    </>
  );
}
