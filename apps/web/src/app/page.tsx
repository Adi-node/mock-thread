import { Suspense } from "react";
import Link from "next/link";
import { env } from "@mt/shared";
import { prisma } from "@mt/db";

// Next 16 Cache Components: DB reads are runtime data — they live inside a
// <Suspense> boundary so the page's shell can prerender statically while the
// count fills in on the server at request time.
async function TopicCount() {
  const topicCount = await prisma.topic.count();
  return <p className="text-neutral-500">{topicCount} topics in the bank</p>;
}

function TopicCountFallback() {
  return <p className="text-neutral-500">loading topics…</p>;
}

export default function Home() {
  return (
    <>
      <main className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center gap-4">
        <h1 className="text-4xl text-neutral-100">MockThread</h1>
        <p className="text-neutral-400">Real-time peer-to-peer mock technical interviews</p>
        <Link href="/login" className="text-neutral-300 underline">
          Log in
        </Link>
        {/* temporary smoke indicator (C5): db round-trip proof; replaced in Milestone 2 */}
        {env.DATABASE_URL ? (
          <Suspense fallback={<TopicCountFallback />}>
            <TopicCount />
          </Suspense>
        ) : (
          <p className="text-neutral-500">db missing</p>
        )}
      </main>
    </>
  );
}
