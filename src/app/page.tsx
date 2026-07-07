import { InputForm } from "@/components/InputForm";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-start py-12 px-4">
      <div className="w-full max-w-2xl">
        <header className="text-center mb-10">
          <h1 className="text-3xl font-bold text-navy">START Munich</h1>
          <p className="mt-2 text-magenta font-medium">Newsletter Generator</p>
        </header>
        <InputForm />
      </div>
    </main>
  );
}
