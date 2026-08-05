import LoadingAnimation from "@/components/ui/loading-animation";

export default function MatchLoading() {
  return (
    <main className="w-full max-w-5xl mx-auto px-4 py-12 flex justify-center">
      <LoadingAnimation />
    </main>
  );
}
