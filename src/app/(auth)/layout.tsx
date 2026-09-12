import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-10 px-4 py-16">
      <Link href="/">
        <Logo wordmarkClassName="text-h5" markClassName="h-5 w-5" />
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
