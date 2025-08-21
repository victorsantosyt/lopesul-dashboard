import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default function Home() {
  // se já tiver token, manda para o dashboard
  const token = cookies().get("token")?.value;
  if (token) redirect("/dashboard");

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#F0F6FA] dark:bg-[#1a2233]">
      <div className="text-center">
        <h1 className="text-4xl font-bold font-inter text-[#002244] dark:text-white mb-6">
          Bem-vindo ao Lopesul Dashboard
        </h1>

        <Link
          href="/login"
          className="inline-flex items-center gap-2 rounded-lg px-5 py-3 font-semibold
                     bg-blue-600 text-white hover:bg-blue-700
                     focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400"
        >
          Entrar
        </Link>
      </div>
    </main>
  );
}
