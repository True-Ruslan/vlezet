import { notFound } from "next/navigation";
import { RecognitionBenchmarkHarness } from "../../components/recognition/recognition-benchmark-harness";

export default function RecognitionBenchmarkPage() {
  if (process.env.RECOGNITION_BENCHMARK_HARNESS !== "1") notFound();
  return <RecognitionBenchmarkHarness />;
}
