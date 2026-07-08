import { InputForm } from "@/components/InputForm";
import { Sidebar } from "@/components/Sidebar";

export default function HomePage() {
  return (
    <div className="flex h-screen bg-navy">
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        <div className="min-h-screen flex flex-col items-center justify-start py-12 px-4">
          <div className="w-full max-w-2xl">
            <header className="text-center mb-10">
              <div className="inline-flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full bg-navy flex items-center justify-center border border-[#2a2a42]">
                  <span className="text-magenta font-bold text-xs">S</span>
                </div>
                <span className="text-[#a0a0b8] text-sm font-medium tracking-wide uppercase">START Munich</span>
              </div>
              <h1 className="text-3xl font-bold text-[#f1f1f5]">Newsletter Generator</h1>
              <p className="mt-2 text-[#a0a0b8] text-sm">Generate and manage the monthly START Munich community newsletter</p>
            </header>
            <InputForm />
          </div>
        </div>
      </main>
    </div>
  );
}
