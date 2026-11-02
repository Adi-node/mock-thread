// Idempotent topics seed: safe to run repeatedly (upsert by slug).
// Topic slugs are the plan's ~15 curated Codeforces tags (PLAN §5.2 decision 9);
// T007 (bank validation) may prune thin cells later — superset first is expected.
import "dotenv/config";
import { prisma } from "../src/client";

const TOPICS: Array<{ slug: string; name: string }> = [
  { slug: "two-pointers", name: "Two Pointers" },
  { slug: "binary-search", name: "Binary Search" },
  { slug: "greedy", name: "Greedy" },
  { slug: "dynamic-programming", name: "Dynamic Programming" },
  { slug: "graphs", name: "Graphs" },
  { slug: "trees", name: "Trees" },
  { slug: "strings", name: "Strings" },
  { slug: "math", name: "Math" },
  { slug: "sortings", name: "Sorting" },
  { slug: "data-structures", name: "Data Structures" },
  { slug: "divide-and-conquer", name: "Divide and Conquer" },
  { slug: "brute-force", name: "Brute Force" },
  { slug: "constructive-algorithms", name: "Constructive Algorithms" },
  { slug: "bit-manipulation", name: "Bit Manipulation" },
  { slug: "number-theory", name: "Number Theory" },
];

async function main() {
  for (const { slug, name } of TOPICS) {
    await prisma.topic.upsert({
      where: { slug },
      create: { id: slug, slug, name }, // Topic.id has no cuid default in §8.1 — use the slug; readable + idempotent
      update: {}, // nothing to update for now — re-runs are no-ops
    });
  }
  console.log(`Seeded ${TOPICS.length} topics`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
