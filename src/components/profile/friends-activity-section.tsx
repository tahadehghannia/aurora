import Link from "next/link";
import { CONTENT_ROUTE } from "@/types/content";
import type { FriendActivityItem } from "@/lib/taste/friends-activity";

interface FriendsActivitySectionProps {
  items: FriendActivityItem[];
}

function describe(item: FriendActivityItem): React.ReactNode {
  switch (item.kind) {
    case "rated":
      return (
        <>
          rated{" "}
          <Link href={`/${CONTENT_ROUTE[item.card!.kind]}/${item.card!.slug}`} className="text-foreground hover:underline">
            {item.card!.title}
          </Link>{" "}
          <span className="text-rating">{"★".repeat(Math.round(item.score ?? 0))}</span>
        </>
      );
    case "saved":
      return (
        <>
          added{" "}
          <Link href={`/${CONTENT_ROUTE[item.card!.kind]}/${item.card!.slug}`} className="text-foreground hover:underline">
            {item.card!.title}
          </Link>{" "}
          to their library
        </>
      );
    case "collection":
      return <>created a collection, &ldquo;{item.title}&rdquo;</>;
    case "playlist":
      return <>created a playlist, &ldquo;{item.title}&rdquo;</>;
  }
}

export function FriendsActivitySection({ items }: FriendsActivitySectionProps) {
  if (items.length === 0) {
    return (
      <section className="space-y-2">
        <h2 className="text-h6 font-semibold">Friends Activity</h2>
        <p className="text-body-sm text-muted-foreground">
          Follow a few taste neighbors to see what they&apos;re discovering.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <h2 className="text-h6 font-semibold">Friends Activity</h2>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item.id} className="text-body-sm text-muted-foreground">
            <span className="font-medium text-foreground">{item.userName}</span> {describe(item)}
          </li>
        ))}
      </ul>
    </section>
  );
}
