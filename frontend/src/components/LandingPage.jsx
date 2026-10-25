import { 
  Activity, 
  ShieldCheck, 
  Clock, 
  Database, 
  Zap, 
  ArrowRight, 
  CheckCircle2, 
  Layers, 
  Sparkles,
  Heart,
  BarChart3,
  Server
} from 'lucide-react'

export default function LandingPage({ onLaunchCommandCenter }) {
  return (
    <div className="min-h-screen bg-[#FAFBFD] text-slate-900">

      {/* ── Top Announcement Bar ─────────────────────────────────────────── */}
      <div className="border-b border-slate-200/80 bg-white/70 backdrop-blur-md px-6 py-2.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span className="live-pulse" />
            <span className="font-semibold text-slate-800">VitalStream Platform v1.4</span>
            <span className="text-slate-400">|</span>
            <span>St. Jude Lakehouse Architecture Active</span>
          </div>
          <div className="hidden sm:flex items-center gap-4 text-slate-500">
            <span>SLA: &lt;5ms P95 Write Latency</span>
            <span>•</span>
            <span>ACID Concurrency: 100% Protected</span>
          </div>
        </div>
      </div>

      {/* ── Hero Section ─────────────────────────────────────────────────── */}
      <section className="relative pt-20 pb-24 px-6 overflow-hidden">
        {/* Soft background warm gradient blob */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-gradient-to-b from-blue-50/80 via-emerald-50/40 to-transparent blur-3xl -z-10 pointer-events-none" />

        <div className="max-w-5xl mx-auto text-center">
          {/* Tagline Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50/90 border border-blue-200/80 text-blue-700 text-xs font-semibold mb-6 shadow-sm">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Hospital Operating Room Monitoring</span>
          </div>

          {/* Main Title */}
          <h1 className="text-4xl sm:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.12] mb-6">
            Real-Time Hospital & <br className="hidden sm:block" />
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Operating Room
            </span> Monitoring.
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed mb-10 font-normal">
            A distributed big data system tracking patient vitals across 6 operating rooms in real time, with instant alert detection, safe recovery bed bookings, and medication allergy checks.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={onLaunchCommandCenter}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-blue-600 text-white font-semibold text-base shadow-lg shadow-blue-500/20 hover:bg-blue-700 hover:shadow-blue-500/30 transition-all flex items-center justify-center gap-2.5 group"
            >
              <span>Open Command Center</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>

            <a
              href="#architecture"
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold text-base hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
            >
              <Layers className="w-4 h-4 text-slate-500" />
              <span>View Architecture</span>
            </a>
          </div>

          {/* Live Trust Badges */}
          <div className="mt-14 pt-8 border-t border-slate-200/80 grid grid-cols-2 sm:grid-cols-4 gap-6 text-left">
            <div className="p-4 rounded-xl bg-white/80 border border-slate-200/60 shadow-sm">
              <div className="text-2xl font-bold text-slate-900 tabular">518k+</div>
              <div className="text-xs font-medium text-slate-500 mt-0.5">Vitals Streamed / Day</div>
            </div>
            <div className="p-4 rounded-xl bg-white/80 border border-slate-200/60 shadow-sm">
              <div className="text-2xl font-bold text-emerald-600 tabular">&lt; 5 ms</div>
              <div className="text-xs font-medium text-slate-500 mt-0.5">P95 Cassandra Latency</div>
            </div>
            <div className="p-4 rounded-xl bg-white/80 border border-slate-200/60 shadow-sm">
              <div className="text-2xl font-bold text-blue-600 tabular">100%</div>
              <div className="text-xs font-medium text-slate-500 mt-0.5">ACID Bed Concurrency</div>
            </div>
            <div className="p-4 rounded-xl bg-white/80 border border-slate-200/60 shadow-sm">
              <div className="text-2xl font-bold text-indigo-600 tabular">6 ORs</div>
              <div className="text-xs font-medium text-slate-500 mt-0.5">Partitioned Waveforms</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Architectural Pillars ─────────────────────────────────────────── */}
      <section id="architecture" className="py-20 px-6 bg-white border-y border-slate-200/80">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-600 mb-2">Core Engineering Capabilities</h2>
            <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Engineered for Zero Data Loss & Patient Safety
            </h3>
            <p className="text-slate-600 text-sm mt-3 leading-relaxed">
              Combining high-frequency distributed stream processing with strict transactional consistency guarantees.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Card 1 */}
            <div className="app-card p-6 flex flex-col justify-between">
              <div>
                <div className="w-11 h-11 rounded-lg bg-blue-50 border border-blue-200/70 flex items-center justify-center text-blue-600 mb-4">
                  <Activity className="w-5 h-5" />
                </div>
                <h4 className="text-base font-bold text-slate-900 mb-2">Kafka Ingestion</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Real VitalDB anesthesia recordings streamed across 6 dedicated Kafka partitions with partition keys preserving temporal order.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center text-xs font-medium text-blue-600">
                <span>Member 2 Pipeline</span>
              </div>
            </div>

            {/* Card 2 */}
            <div className="app-card p-6 flex flex-col justify-between">
              <div>
                <div className="w-11 h-11 rounded-lg bg-amber-50 border border-amber-200/70 flex items-center justify-center text-amber-600 mb-4">
                  <Zap className="w-5 h-5" />
                </div>
                <h4 className="text-base font-bold text-slate-900 mb-2">Flink Alert Engine</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  PyFlink stateful tumbling evaluation with 5-minute deduplication to prevent clinical alert fatigue, plus 10-minute escalation timers.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center text-xs font-medium text-amber-600">
                <span>Member 3 Pipeline</span>
              </div>
            </div>

            {/* Card 3 */}
            <div className="app-card p-6 flex flex-col justify-between">
              <div>
                <div className="w-11 h-11 rounded-lg bg-emerald-50 border border-emerald-200/70 flex items-center justify-center text-emerald-600 mb-4">
                  <Database className="w-5 h-5" />
                </div>
                <h4 className="text-base font-bold text-slate-900 mb-2">TWCS Cassandra</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  TimeWindowCompactionStrategy seals daily SSTables, delivering high-throughput append-only writes with sub-5ms P95 latency.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center text-xs font-medium text-emerald-600">
                <span>Member 4 Pipeline</span>
              </div>
            </div>

            {/* Card 4 */}
            <div className="app-card p-6 flex flex-col justify-between">
              <div>
                <div className="w-11 h-11 rounded-lg bg-indigo-50 border border-indigo-200/70 flex items-center justify-center text-indigo-600 mb-4">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h4 className="text-base font-bold text-slate-900 mb-2">ACID & Safety Guard</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  MongoDB WiredTiger atomic <code className="text-indigo-700 bg-indigo-50 px-1 rounded">findOneAndUpdate</code> bed reservation prevents race conditions, plus closed-loop drug allergy interception.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center text-xs font-medium text-indigo-600">
                <span>Branch 2A: Transactional Core</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Live Architecture Dataflow Diagram ─────────────────────────────── */}
      <section className="py-20 px-6 bg-[#FAFBFD]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center max-w-xl mx-auto mb-14">
            <h3 className="text-2xl font-bold text-slate-900">End-to-End System Topology</h3>
            <p className="text-xs text-slate-500 mt-2">How medical telemetry flows through our distributed architecture</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
              {/* Node 1 */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
                <div className="text-xs font-bold text-slate-500 uppercase">Input</div>
                <div className="text-sm font-bold text-slate-900 mt-1">VitalDB API</div>
                <div className="text-[11px] text-slate-500 mt-1">6,388 Surgical Cases</div>
              </div>

              <div className="hidden md:flex justify-center text-slate-400">→</div>

              {/* Node 2 */}
              <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 text-center">
                <div className="text-xs font-bold text-blue-600 uppercase">Stream Ingestion</div>
                <div className="text-sm font-bold text-slate-900 mt-1">Apache Kafka</div>
                <div className="text-[11px] text-blue-700 mt-1">vitals.raw × 6 ORs</div>
              </div>

              <div className="hidden md:flex justify-center text-slate-400">→</div>

              {/* Node 3 */}
              <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 text-center">
                <div className="text-xs font-bold text-amber-600 uppercase">Processing</div>
                <div className="text-sm font-bold text-slate-900 mt-1">Apache Flink</div>
                <div className="text-[11px] text-amber-700 mt-1">Deduplication + Timers</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8 pt-8 border-t border-slate-100">
              <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200">
                <div className="text-xs font-bold text-emerald-700 uppercase">Time-Series Lake</div>
                <div className="text-sm font-bold text-slate-900 mt-0.5">Cassandra 4.1</div>
                <div className="text-xs text-slate-600 mt-1">TWCS Compaction · 518k vitals/day</div>
              </div>

              <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-200">
                <div className="text-xs font-bold text-indigo-700 uppercase">Document & ACID</div>
                <div className="text-sm font-bold text-slate-900 mt-0.5">MongoDB 7.0</div>
                <div className="text-xs text-slate-600 mt-1">Atomic bed locks · Allergy maps</div>
              </div>

              <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200">
                <div className="text-xs font-bold text-blue-700 uppercase">Real-Time UI</div>
                <div className="text-sm font-bold text-slate-900 mt-0.5">FastAPI + React 18</div>
                <div className="text-xs text-slate-600 mt-1">WebSocket broadcast · uPlot</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-200 bg-white py-10 px-6 text-center text-xs text-slate-500">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800 text-sm">VitalStream</span>
            <span>— Perioperative Clinical Command Platform</span>
          </div>
          <div className="flex items-center gap-6">
            <span>VitalStream Engineering Suite</span>
            <span>•</span>
            <span>Big Data Analytics Project</span>
          </div>
        </div>
      </footer>

    </div>
  )
}
