export default function ManutencaoPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F0F6FA] dark:bg-[#1a2233]">
      <div className="bg-white dark:bg-[#232e47] rounded-2xl p-8 shadow text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sistema em manutenção</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300">
          Estamos fazendo ajustes e voltaremos em breve. Tente novamente mais tarde.
        </p>
      </div>
    </div>
  );
}
